/**
 * Contribution room summary for the dashboard card.
 * Delegates to the full computation engine.
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
  savingsGoalCents: number;
  totalDepositCents: number;
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
          contributedCents: currentRow.reerDepositCents,
          remainingCents: currentRow.reerLimitCents - currentRow.reerDepositCents,
        },
        celi: {
          limitCents: currentRow.celiLimitCents,
          contributedCents: currentRow.celiDepositCents,
          remainingCents: currentRow.celiLimitCents - currentRow.celiDepositCents,
        },
        crcd: {
          limitCents: currentRow.crcdLimitCents,
          contributedCents: currentRow.crcdDepositCents,
          remainingCents: currentRow.crcdRemainingCents,
        },
        reerCumulativeRemainingCents: currentRow.reerCumulativeRoomCents,
        celiCumulativeRemainingCents: currentRow.celiCumulativeRoomCents,
        savingsGoalCents: currentRow.savingsGoalCents,
        totalDepositCents: currentRow.totalDepositCents,
      };
    }
  }

  // Fallback: REER/CRCD are user-entered (0 until set), CELI uses CRA limit
  const celiLimit = await db.craLimit.findFirst({
    where: { year: currentYear, type: "CELI" },
  });
  const celiLimitCents = celiLimit ? Number(celiLimit.limitCents) : 0;

  return {
    year: currentYear,
    reer: { limitCents: 0, contributedCents: 0, remainingCents: 0 },
    celi: { limitCents: celiLimitCents, contributedCents: 0, remainingCents: celiLimitCents },
    crcd: { limitCents: 0, contributedCents: 0, remainingCents: 0 },
    reerCumulativeRemainingCents: 0,
    celiCumulativeRemainingCents: celiLimitCents,
    savingsGoalCents: 0,
    totalDepositCents: 0,
  };
}
