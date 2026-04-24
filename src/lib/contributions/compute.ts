/**
 * Contribution computation engine.
 *
 * Auto-computes contributions from DEPOSIT transactions grouped by account type + year.
 * REER room: cumulative (user-entered limit - deposits) — limit defaults to 0 until set
 * CELI room: cumulative (CRA limit - deposits)
 * CRCD: user-entered annual limit (0 = not participating), lifetime tracking toward $45K cap
 *
 * Savings goals carry forward from the previous year if not explicitly set.
 */
import type { ScopedPrisma } from "@/lib/db/scoped";

/** CRCD lifetime cumulative limit: $45,000 = 4,500,000 cents */
const CRCD_LIFETIME_LIMIT_CENTS = 4_500_000;

/** CRCD tax credit rate: 25% */
const CRCD_TAX_CREDIT_RATE = 0.25;

/** CRCD max annual tax credit: $1,250 = 125,000 cents */
const CRCD_MAX_ANNUAL_CREDIT_CENTS = 125_000;

export interface ContributionYearRow {
  year: number;
  age: number;

  // CRA limits (seed data — reference only)
  reerCraLimitCents: number;
  celiCraLimitCents: number;
  crcdCraLimitCents: number;

  // Effective limits (user input for REER/CRCD, CRA for CELI)
  reerLimitCents: number;   // 0 = not yet entered by user
  celiLimitCents: number;
  crcdLimitCents: number;   // 0 = user not participating in CRCD

  // Auto-computed from DEPOSIT transactions
  reerDepositCents: number;
  celiDepositCents: number;
  crcdDepositCents: number;
  margeDepositCents: number;
  cashDepositCents: number;
  otherDepositCents: number;
  totalDepositCents: number;

  // Cumulative room (forward propagation)
  reerCumulativeRoomCents: number;
  celiCumulativeRoomCents: number;
  crcdRemainingCents: number;
  crcdCumulativeInvestedCents: number;
  crcdLifetimeLimitCents: number;

  // CRCD tax credit (25% of annual deposit, max $1,250)
  crcdTaxCreditCents: number;

  // Per-year savings goal (carries forward from prior year if not set)
  savingsGoalCents: number;

  notes: string | null;
}

/**
 * Aggregate DEPOSIT transactions by account type and year.
 * Returns a Map with keys like "2024-REER" → total cents deposited.
 */
async function aggregateDepositsByTypeAndYear(
  db: ScopedPrisma,
  startYear: number,
  endYear: number,
): Promise<Map<string, number>> {
  const [accounts, deposits] = await Promise.all([
    db.account.findMany({ select: { id: true, type: true } }),
    db.transaction.findMany({
      where: {
        type: "DEPOSIT",
        date: {
          gte: new Date(`${startYear}-01-01`),
          lte: new Date(`${endYear}-12-31`),
        },
      },
    }),
  ]);

  const accountTypeMap = new Map(accounts.map((a) => [a.id, a.type]));
  const result = new Map<string, number>();

  for (const txn of deposits) {
    const acctType = accountTypeMap.get(txn.accountId) ?? "OTHER";
    const year = new Date(txn.date).getFullYear();
    const key = `${year}-${acctType}`;
    result.set(key, (result.get(key) ?? 0) + Math.abs(Number(txn.amountCents)));
  }

  return result;
}

/**
 * Build the full year-by-year contribution table.
 * Starts from age 18. Merges CRA seed limits with auto-computed deposits.
 */
export async function computeContributionTable(
  db: ScopedPrisma,
  birthYear: number,
): Promise<ContributionYearRow[]> {
  const currentYear = new Date().getFullYear();
  const startYear = birthYear + 18;

  // Fetch CRA limits, user records, and deposit aggregates in parallel
  const [craLimits, userYears, depositMap] = await Promise.all([
    db.craLimit.findMany({
      where: { year: { gte: startYear, lte: currentYear } },
      orderBy: { year: "asc" },
    }),
    db.contributionYear.findMany({
      where: { year: { gte: startYear, lte: currentYear } },
      orderBy: { year: "asc" },
    }),
    aggregateDepositsByTypeAndYear(db, startYear, currentYear),
  ]);

  // Index CRA limits by year+type
  const craMap = new Map<string, bigint>();
  for (const limit of craLimits) {
    craMap.set(`${limit.year}-${limit.type}`, limit.limitCents);
  }

  // Index user years by year
  const userMap = new Map(userYears.map((y) => [y.year, y]));

  // Build rows with forward propagation
  const rows: ContributionYearRow[] = [];
  let reerCumulativeRoom = 0;
  let celiCumulativeRoom = 0;
  let crcdCumulativeInvested = 0;
  let previousGoal = 0;

  for (let year = startYear; year <= currentYear; year++) {
    const age = year - birthYear;
    const userYear = userMap.get(year);

    // CRA limits (reference only)
    const reerCraLimit = Number(craMap.get(`${year}-REER`) ?? 0n);
    const celiCraLimit = Number(craMap.get(`${year}-CELI`) ?? 0n);
    const crcdCraLimit = Number(craMap.get(`${year}-CRCD`) ?? 0n);

    // REER limit: user-entered only (0 = not yet entered)
    const reerLimit = userYear ? Number(userYear.reerLimitCents) : 0;

    // CELI limit: always CRA (same for everyone 18+)
    const celiLimit = age >= 18 && year >= 2009 ? celiCraLimit : 0;

    // CRCD limit: user-entered only (0 = not participating)
    const crcdLimit = userYear ? Number(userYear.crcdLimitCents) : 0;

    // Auto-computed deposits from transactions
    const reerDeposit = depositMap.get(`${year}-REER`) ?? 0;
    const celiDeposit = depositMap.get(`${year}-CELI`) ?? 0;
    const crcdDeposit = depositMap.get(`${year}-CRCD`) ?? 0;
    const margeDeposit = depositMap.get(`${year}-MARGE`) ?? 0;
    const cashDeposit = depositMap.get(`${year}-CASH`) ?? 0;
    const otherDeposit = depositMap.get(`${year}-OTHER`) ?? 0;
    const totalDeposit = reerDeposit + celiDeposit + crcdDeposit + margeDeposit + cashDeposit + otherDeposit;

    // Forward propagation of cumulative room
    reerCumulativeRoom += reerLimit - reerDeposit;
    celiCumulativeRoom += celiLimit - celiDeposit;

    // CRCD cumulative lifetime tracking
    crcdCumulativeInvested += crcdDeposit;

    // CRCD tax credit: 25% of annual deposit, max $1,250
    const crcdTaxCredit = crcdDeposit > 0
      ? Math.min(Math.round(crcdDeposit * CRCD_TAX_CREDIT_RATE), CRCD_MAX_ANNUAL_CREDIT_CENTS)
      : 0;

    // Savings goal: use user-set value, or carry forward from previous year
    const userGoal = userYear ? Number(userYear.savingsGoalCents) : 0;
    const savingsGoal = userGoal > 0 ? userGoal : previousGoal;
    previousGoal = savingsGoal;

    rows.push({
      year,
      age,
      reerCraLimitCents: reerCraLimit,
      celiCraLimitCents: celiCraLimit,
      crcdCraLimitCents: crcdCraLimit,
      reerLimitCents: reerLimit,
      celiLimitCents: celiLimit,
      crcdLimitCents: crcdLimit,
      reerDepositCents: reerDeposit,
      celiDepositCents: celiDeposit,
      crcdDepositCents: crcdDeposit,
      margeDepositCents: margeDeposit,
      cashDepositCents: cashDeposit,
      otherDepositCents: otherDeposit,
      totalDepositCents: totalDeposit,
      reerCumulativeRoomCents: reerCumulativeRoom,
      celiCumulativeRoomCents: celiCumulativeRoom,
      crcdRemainingCents: crcdLimit - crcdDeposit,
      crcdCumulativeInvestedCents: crcdCumulativeInvested,
      crcdLifetimeLimitCents: CRCD_LIFETIME_LIMIT_CENTS,
      crcdTaxCreditCents: crcdTaxCredit,
      savingsGoalCents: savingsGoal,
      notes: userYear?.notes ?? null,
    });
  }

  return rows;
}
