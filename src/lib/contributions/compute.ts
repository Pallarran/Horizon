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

export interface ContributionYearRow {
  year: number;
  age: number;

  // CRA limit (seed data — used for CELI room calculation)
  celiCraLimitCents: number;

  // Effective limits (user input for REER/CRCD, CRA for CELI)
  reerLimitCents: number;   // 0 = not yet entered by user
  celiLimitCents: number;
  crcdLimitCents: number;   // 0 = user not participating in CRCD

  // Auto-computed from DEPOSIT/WITHDRAWAL transactions
  reerDepositCents: number;
  celiDepositCents: number;
  celiWithdrawalCents: number;
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

  // Per-year savings goal (carries forward from prior year if not set)
  savingsGoalCents: number;

  notes: string | null;
}

/**
 * Aggregate DEPOSIT and WITHDRAWAL transactions by account type and year.
 * Returns two Maps with keys like "2024-CELI" → total cents.
 */
async function aggregateFlowsByTypeAndYear(
  db: ScopedPrisma,
  startYear: number,
  endYear: number,
): Promise<{ deposits: Map<string, number>; withdrawals: Map<string, number> }> {
  const [accounts, txns] = await Promise.all([
    db.account.findMany({ select: { id: true, type: true } }),
    db.transaction.findMany({
      where: {
        type: { in: ["DEPOSIT", "WITHDRAWAL"] },
        date: {
          gte: new Date(`${startYear}-01-01`),
          lte: new Date(`${endYear}-12-31`),
        },
      },
    }),
  ]);

  const accountTypeMap = new Map(accounts.map((a) => [a.id, a.type]));
  const deposits = new Map<string, number>();
  const withdrawals = new Map<string, number>();

  for (const txn of txns) {
    const acctType = accountTypeMap.get(txn.accountId) ?? "OTHER";
    const year = new Date(txn.date).getUTCFullYear();
    const key = `${year}-${acctType}`;
    const map = txn.type === "DEPOSIT" ? deposits : withdrawals;
    map.set(key, (map.get(key) ?? 0) + Math.abs(Number(txn.amountCents)));
  }

  return { deposits, withdrawals };
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

  // Fetch CRA limits, user records, and deposit/withdrawal aggregates in parallel
  const [craLimits, userYears, flows] = await Promise.all([
    db.craLimit.findMany({
      where: { year: { gte: startYear, lte: currentYear } },
      orderBy: { year: "asc" },
    }),
    db.contributionYear.findMany({
      where: { year: { gte: startYear, lte: currentYear } },
      orderBy: { year: "asc" },
    }),
    aggregateFlowsByTypeAndYear(db, startYear, currentYear),
  ]);
  const { deposits: depositMap, withdrawals: withdrawalMap } = flows;

  // Index CRA limits by year+type (only CELI is used for room calculation)
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
  let previousCeliWithdrawal = 0;

  for (let year = startYear; year <= currentYear; year++) {
    const age = year - birthYear;
    const userYear = userMap.get(year);

    // CELI CRA limit (drives room calculation)
    const celiCraLimit = Number(craMap.get(`${year}-CELI`) ?? 0n);

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

    // CELI withdrawal from THIS year (added back to room next year)
    const celiWithdrawal = withdrawalMap.get(`${year}-CELI`) ?? 0;

    // Forward propagation of cumulative room
    // CELI: withdrawals from previous year are added back to room
    reerCumulativeRoom += reerLimit - reerDeposit;
    celiCumulativeRoom += celiLimit - celiDeposit + previousCeliWithdrawal;
    previousCeliWithdrawal = celiWithdrawal;

    // CRCD cumulative lifetime tracking
    crcdCumulativeInvested += crcdDeposit;

    // Savings goal: use user-set value, or carry forward from previous year
    const userGoal = userYear ? Number(userYear.savingsGoalCents) : 0;
    const savingsGoal = userGoal > 0 ? userGoal : previousGoal;
    previousGoal = savingsGoal;

    rows.push({
      year,
      age,
      celiCraLimitCents: celiCraLimit,
      reerLimitCents: reerLimit,
      celiLimitCents: celiLimit,
      crcdLimitCents: crcdLimit,
      reerDepositCents: reerDeposit,
      celiDepositCents: celiDeposit,
      celiWithdrawalCents: celiWithdrawal,
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
      savingsGoalCents: savingsGoal,
      notes: userYear?.notes ?? null,
    });
  }

  return rows;
}
