/**
 * Income projection — combines all income sources at each age.
 * Used by the dashboard income composition chart and retirement planning.
 */
import type { ScopedPrisma } from "@/lib/db/scoped";
import type { IncomeStreamInput } from "./fire";
import { calculatePension } from "@/lib/pension/calculate";

/**
 * Fetch and materialize all income streams for a user,
 * including computed pension amounts.
 */
export async function getIncomeStreams(
  db: ScopedPrisma,
  retirementAge: number,
): Promise<IncomeStreamInput[]> {
  const [streams, pensions] = await Promise.all([
    db.incomeStream.findMany(),
    db.pension.findMany({ where: { isActive: true } }),
  ]);

  const result: IncomeStreamInput[] = [];

  for (const stream of streams) {
    if (stream.computedFromPensionId) {
      // Computed from a pension — recalculate
      const pension = pensions.find((p) => p.id === stream.computedFromPensionId);
      if (pension) {
        const currentYear = new Date().getFullYear();
        const calc = calculatePension({
          startYear: pension.startYear,
          retirementYear: currentYear + (retirementAge - (currentYear - pension.startYear)),
          salaryBasisCents: Number(pension.salaryBasisCents),
          baseAccrualRate: Number(pension.baseAccrualRate),
          initialBaseYears: pension.initialBaseYears,
          normalRetirementAge: pension.normalRetirementAge,
          earlyRetirementReduction: Number(pension.earlyRetirementReduction),
          retirementAge,
        });

        result.push({
          name: stream.name,
          startAge: stream.startAge,
          endAge: stream.endAge,
          annualAmountCents: calc.annualPensionCents,
          inflationIndexed: stream.inflationIndexed,
        });
      }
    } else if (stream.annualAmountCents) {
      result.push({
        name: stream.name,
        startAge: stream.startAge,
        endAge: stream.endAge,
        annualAmountCents: Number(stream.annualAmountCents),
        inflationIndexed: stream.inflationIndexed,
      });
    }
  }

  return result;
}
