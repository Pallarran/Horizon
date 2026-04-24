/**
 * Income projection — combines all income sources at each age.
 * Used by the dashboard income composition chart and retirement planning.
 */
import type { ScopedPrisma } from "@/lib/db/scoped";
import type { IncomeStreamInput } from "./fire";
import { calculatePension, type PensionParams } from "@/lib/pension/calculate";

/**
 * Fetch and materialize all income streams for a user,
 * including computed pension amounts.
 */
export async function getIncomeStreams(
  db: ScopedPrisma,
  retirementAge: number,
  birthYear?: number,
): Promise<IncomeStreamInput[]> {
  const [streams, pensions] = await Promise.all([
    db.incomeStream.findMany(),
    db.pension.findMany({ where: { isActive: true } }),
  ]);

  const result: IncomeStreamInput[] = [];
  const linkedPensionIds = new Set<string>();
  const currentYear = new Date().getFullYear();
  const currentAge = birthYear ? currentYear - birthYear : undefined;
  const yearsToRetirement = currentAge ? Math.max(0, retirementAge - currentAge) : 0;

  // Process income streams with pension links
  for (const stream of streams) {
    if (stream.computedFromPensionId) {
      linkedPensionIds.add(stream.computedFromPensionId);
      const pension = pensions.find((p) => p.id === stream.computedFromPensionId);
      if (pension) {
        const params = buildPensionParams(pension, retirementAge, currentYear, yearsToRetirement);
        if (params) {
          const calc = calculatePension(params);
          const indexRate = Number(pension.indexationRate ?? 0);
          result.push({
            name: stream.name,
            startAge: stream.startAge,
            endAge: stream.endAge,
            annualAmountCents: calc.annualPensionCents,
            inflationIndexed: indexRate > 0,
            customGrowthRate: indexRate > 0 ? indexRate : undefined,
            isPension: true,
          });
        }
      }
    } else if (stream.annualAmountCents) {
      result.push({
        name: stream.name,
        startAge: stream.startAge,
        endAge: stream.endAge,
        annualAmountCents: Number(stream.annualAmountCents),
        inflationIndexed: stream.inflationIndexed,
        isPension: stream.type === "PENSION",
      });
    }
  }

  // Include standalone pensions that don't have a linked income stream
  for (const pension of pensions) {
    if (linkedPensionIds.has(pension.id)) continue;

    const params = buildPensionParams(pension, retirementAge, currentYear, yearsToRetirement);
    if (!params) continue;

    const calc = calculatePension(params);
    const indexRate = Number(pension.indexationRate ?? 0);

    // Main pension income
    result.push({
      name: pension.name,
      startAge: retirementAge,
      endAge: null,
      annualAmountCents: calc.annualPensionCents,
      inflationIndexed: indexRate > 0,
      customGrowthRate: indexRate > 0 ? indexRate : undefined,
      isPension: true,
    });

    // Bridge benefit (temporary supplement)
    if (calc.bridgeAnnualCents && calc.bridgeEndAge) {
      result.push({
        name: `${pension.name} (bridge)`,
        startAge: retirementAge,
        endAge: calc.bridgeEndAge,
        annualAmountCents: calc.bridgeAnnualCents,
        inflationIndexed: false,
        isPension: true,
      });
    }
  }

  return result;
}

/**
 * Build calculator params from a Prisma pension record.
 */
function buildPensionParams(
  pension: {
    planType: string;
    startYear: number | null;
    baseAccrualRate: unknown;
    earlyRetirementReduction: unknown;
    normalRetirementAge: number | null;
    salaryBasisCents: bigint | null;
    statementAnnualCents: bigint | null;
    statementRetirementAge: number | null;
    bridgeBenefitCents: bigint | null;
    bridgeEndAge: number | null;
    indexationRate: unknown;
    currentBalanceCents: bigint | null;
    employeeContribRate: unknown;
    employerContribRate: unknown;
    dcSalaryCents: bigint | null;
    assumedGrowthRate: unknown;
  },
  retirementAge: number,
  currentYear: number,
  yearsToRetirement: number,
): PensionParams | null {
  const bridge = {
    bridgeBenefitCents: pension.bridgeBenefitCents ? Number(pension.bridgeBenefitCents) : null,
    bridgeEndAge: pension.bridgeEndAge,
    indexationRate: pension.indexationRate ? Number(pension.indexationRate) : null,
  };

  switch (pension.planType) {
    case "DB_FORMULA": {
      if (!pension.startYear || !pension.salaryBasisCents || !pension.baseAccrualRate) return null;
      return {
        planType: "DB_FORMULA",
        startYear: pension.startYear,
        retirementYear: currentYear + yearsToRetirement,
        salaryBasisCents: Number(pension.salaryBasisCents),
        baseAccrualRate: Number(pension.baseAccrualRate),
        normalRetirementAge: pension.normalRetirementAge ?? 65,
        earlyRetirementReduction: Number(pension.earlyRetirementReduction ?? 0.04),
        retirementAge,
        ...bridge,
      };
    }
    case "DB_STATEMENT": {
      if (!pension.statementAnnualCents || !pension.statementRetirementAge) return null;
      return {
        planType: "DB_STATEMENT",
        statementAnnualCents: Number(pension.statementAnnualCents),
        statementRetirementAge: pension.statementRetirementAge,
        earlyRetirementReduction: pension.earlyRetirementReduction
          ? Number(pension.earlyRetirementReduction)
          : null,
        retirementAge,
        ...bridge,
      };
    }
    case "DC": {
      if (!pension.currentBalanceCents || !pension.dcSalaryCents) return null;
      const salary = Number(pension.dcSalaryCents);
      const empRate = Number(pension.employeeContribRate ?? 0);
      const erRate = Number(pension.employerContribRate ?? 0);
      return {
        planType: "DC",
        currentBalanceCents: Number(pension.currentBalanceCents),
        annualContributionCents: Math.round(salary * (empRate + erRate)),
        assumedGrowthRate: Number(pension.assumedGrowthRate ?? 0.05),
        yearsToRetirement,
        retirementAge,
      };
    }
    default:
      return null;
  }
}
