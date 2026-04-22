/**
 * Full contribution room computation engine.
 *
 * REER room: previous cumulative room + new CRA limit - contributions
 * CELI room: previous cumulative room + new CRA limit - contributions + prior year withdrawals
 * CRCD: annual limit - contributions (no carry-forward)
 *
 * Changes to historical years propagate forward automatically.
 */
import type { ScopedPrisma } from "@/lib/db/scoped";
import { prisma } from "@/lib/db/prisma";

export interface ContributionYearRow {
  id: string | null; // null if not yet persisted
  year: number;
  age: number;

  // CRA limits (from seed data)
  reerCraLimitCents: number;
  celiCraLimitCents: number;
  crcdCraLimitCents: number;

  // User-entered limits (may differ from CRA — e.g. CRA notice of assessment)
  reerLimitCents: number;
  celiLimitCents: number;

  // Contributions
  reerContributionCents: number;
  celiContributionCents: number;
  margeContributionCents: number;
  crcdContributionCents: number;

  // Computed cumulative remaining room
  reerCumulativeRoomCents: number;
  celiCumulativeRoomCents: number;
  crcdRemainingCents: number;

  notes: string | null;
}

/**
 * Build the full year-by-year contribution table.
 * Merges CRA seed limits with user ContributionYear records.
 */
export async function computeContributionTable(
  db: ScopedPrisma,
  birthYear: number,
): Promise<ContributionYearRow[]> {
  const currentYear = new Date().getFullYear();

  // CELI started in 2009, user must be 18+ to contribute
  const celiEligibleYear = Math.max(2009, birthYear + 18);
  // REER: use 2009 as our start (seed data starts there)
  const startYear = Math.min(celiEligibleYear, 2009);

  // Fetch CRA limits and user records in parallel
  const [craLimits, userYears] = await Promise.all([
    db.craLimit.findMany({
      where: { year: { gte: startYear, lte: currentYear } },
      orderBy: { year: "asc" },
    }),
    db.contributionYear.findMany({
      where: { year: { gte: startYear, lte: currentYear } },
      orderBy: { year: "asc" },
    }),
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

  for (let year = startYear; year <= currentYear; year++) {
    const age = year - birthYear;
    const userYear = userMap.get(year);

    const reerCraLimit = Number(craMap.get(`${year}-REER`) ?? 0n);
    const celiCraLimit = Number(craMap.get(`${year}-CELI`) ?? 0n);
    const crcdCraLimit = Number(craMap.get(`${year}-CRCD`) ?? 0n);

    // Use user-entered limit if available, otherwise CRA limit
    const reerLimit = userYear ? Number(userYear.reerLimitCents) : reerCraLimit;
    const celiLimit = userYear ? Number(userYear.celiLimitCents) : celiCraLimit;

    const reerContribution = userYear ? Number(userYear.reerContributionCents) : 0;
    const celiContribution = userYear ? Number(userYear.celiContributionCents) : 0;
    const margeContribution = userYear ? Number(userYear.margeContributionCents) : 0;
    const crcdContribution = userYear ? Number(userYear.crcdContributionCents) : 0;

    // Forward propagation
    reerCumulativeRoom += reerLimit - reerContribution;
    celiCumulativeRoom += celiLimit - celiContribution;

    rows.push({
      id: userYear?.id ?? null,
      year,
      age,
      reerCraLimitCents: reerCraLimit,
      celiCraLimitCents: celiCraLimit,
      crcdCraLimitCents: crcdCraLimit,
      reerLimitCents: reerLimit,
      celiLimitCents: celiLimit,
      reerContributionCents: reerContribution,
      celiContributionCents: celiContribution,
      margeContributionCents: margeContribution,
      crcdContributionCents: crcdContribution,
      reerCumulativeRoomCents: reerCumulativeRoom,
      celiCumulativeRoomCents: celiCumulativeRoom,
      crcdRemainingCents: crcdCraLimit - crcdContribution,
      notes: userYear?.notes ?? null,
    });
  }

  return rows;
}

/**
 * Upsert a single contribution year and return the recomputed table.
 * Uses raw prisma for the upsert (composite unique needs real userId).
 */
export async function upsertContributionYear(
  db: ScopedPrisma,
  userId: string,
  birthYear: number,
  data: {
    year: number;
    reerLimitCents: number;
    reerContributionCents: number;
    celiLimitCents: number;
    celiContributionCents: number;
    margeContributionCents: number;
    crcdContributionCents: number;
    notes?: string | null;
  },
): Promise<ContributionYearRow[]> {
  const age = data.year - birthYear;

  await prisma.contributionYear.upsert({
    where: { userId_year: { userId, year: data.year } },
    create: {
      userId,
      year: data.year,
      age,
      reerLimitCents: BigInt(data.reerLimitCents),
      reerContributionCents: BigInt(data.reerContributionCents),
      celiLimitCents: BigInt(data.celiLimitCents),
      celiContributionCents: BigInt(data.celiContributionCents),
      margeContributionCents: BigInt(data.margeContributionCents),
      crcdContributionCents: BigInt(data.crcdContributionCents),
      notes: data.notes ?? null,
    },
    update: {
      reerLimitCents: BigInt(data.reerLimitCents),
      reerContributionCents: BigInt(data.reerContributionCents),
      celiLimitCents: BigInt(data.celiLimitCents),
      celiContributionCents: BigInt(data.celiContributionCents),
      margeContributionCents: BigInt(data.margeContributionCents),
      crcdContributionCents: BigInt(data.crcdContributionCents),
      notes: data.notes ?? null,
    },
  });

  // Return recomputed table (changes propagate forward)
  return computeContributionTable(db, birthYear);
}
