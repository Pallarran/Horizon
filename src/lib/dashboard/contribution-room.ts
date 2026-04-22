/**
 * Contribution room summary for the dashboard card.
 * Delegates to the full computation engine from Phase 6.
 */
import type { ScopedPrisma } from "@/lib/db/scoped";
import { computeContributionTable } from "@/lib/contributions/compute";

export interface ContributionRoomData {
  year: number;
  reer: { limitCents: number; contributedCents: number; remainingCents: number };
  celi: { limitCents: number; contributedCents: number; remainingCents: number };
  crcd: { limitCents: number; contributedCents: number; remainingCents: number };
  reerCumulativeRemainingCents: number;
  celiCumulativeRemainingCents: number;
}

export async function computeContributionRoom(
  db: ScopedPrisma,
  birthYear?: number,
): Promise<ContributionRoomData> {
  const currentYear = new Date().getFullYear();

  // Use full engine if birthYear is available
  if (birthYear) {
    const rows = await computeContributionTable(db, birthYear);
    const currentRow = rows.find((r) => r.year === currentYear);

    if (currentRow) {
      return {
        year: currentYear,
        reer: {
          limitCents: currentRow.reerLimitCents,
          contributedCents: currentRow.reerContributionCents,
          remainingCents: currentRow.reerLimitCents - currentRow.reerContributionCents,
        },
        celi: {
          limitCents: currentRow.celiLimitCents,
          contributedCents: currentRow.celiContributionCents,
          remainingCents: currentRow.celiLimitCents - currentRow.celiContributionCents,
        },
        crcd: {
          limitCents: currentRow.crcdCraLimitCents,
          contributedCents: currentRow.crcdContributionCents,
          remainingCents: currentRow.crcdRemainingCents,
        },
        reerCumulativeRemainingCents: currentRow.reerCumulativeRoomCents,
        celiCumulativeRemainingCents: currentRow.celiCumulativeRoomCents,
      };
    }
  }

  // Fallback: get CRA limits for display when no contribution data exists
  const [reerLimit, celiLimit, crcdLimit] = await Promise.all([
    db.craLimit.findFirst({ where: { year: currentYear, type: "REER" } }),
    db.craLimit.findFirst({ where: { year: currentYear, type: "CELI" } }),
    db.craLimit.findFirst({ where: { year: currentYear, type: "CRCD" } }),
  ]);

  const reerLimitCents = reerLimit ? Number(reerLimit.limitCents) : 0;
  const celiLimitCents = celiLimit ? Number(celiLimit.limitCents) : 0;
  const crcdLimitCents = crcdLimit ? Number(crcdLimit.limitCents) : 500_000;

  return {
    year: currentYear,
    reer: { limitCents: reerLimitCents, contributedCents: 0, remainingCents: reerLimitCents },
    celi: { limitCents: celiLimitCents, contributedCents: 0, remainingCents: celiLimitCents },
    crcd: { limitCents: crcdLimitCents, contributedCents: 0, remainingCents: crcdLimitCents },
    reerCumulativeRemainingCents: reerLimitCents,
    celiCumulativeRemainingCents: celiLimitCents,
  };
}
