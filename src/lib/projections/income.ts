/**
 * Income projection — combines all income sources at each age.
 * Used by the dashboard income composition chart and retirement planning.
 */
import type { ScopedPrisma } from "@/lib/db/scoped";
import type { IncomeStreamInput } from "./fire";
import { calculatePension } from "@/lib/pension/calculate";
import { buildCalcParams, type SerializedPension } from "@/lib/pension/build-params";

/**
 * Serialize a raw Prisma pension record to SerializedPension (bigint/Decimal → number).
 */
function serializePension(p: {
  id: string;
  name: string;
  planType: string;
  isActive: boolean;
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
}): SerializedPension {
  return {
    id: p.id,
    name: p.name,
    planType: p.planType as SerializedPension["planType"],
    isActive: p.isActive,
    startYear: p.startYear,
    baseAccrualRate: p.baseAccrualRate != null ? Number(p.baseAccrualRate) : null,
    earlyRetirementReduction: p.earlyRetirementReduction != null ? Number(p.earlyRetirementReduction) : null,
    normalRetirementAge: p.normalRetirementAge,
    salaryBasisCents: p.salaryBasisCents != null ? Number(p.salaryBasisCents) : null,
    statementAnnualCents: p.statementAnnualCents != null ? Number(p.statementAnnualCents) : null,
    statementRetirementAge: p.statementRetirementAge,
    bridgeBenefitCents: p.bridgeBenefitCents != null ? Number(p.bridgeBenefitCents) : null,
    bridgeEndAge: p.bridgeEndAge,
    indexationRate: p.indexationRate != null ? Number(p.indexationRate) : null,
    currentBalanceCents: p.currentBalanceCents != null ? Number(p.currentBalanceCents) : null,
    employeeContribRate: p.employeeContribRate != null ? Number(p.employeeContribRate) : null,
    employerContribRate: p.employerContribRate != null ? Number(p.employerContribRate) : null,
    dcSalaryCents: p.dcSalaryCents != null ? Number(p.dcSalaryCents) : null,
    assumedGrowthRate: p.assumedGrowthRate != null ? Number(p.assumedGrowthRate) : null,
  };
}

/**
 * Fetch and materialize all income streams for a user,
 * including computed pension amounts.
 */
export async function getIncomeStreams(
  db: ScopedPrisma,
  retirementAge: number,
  birthYear: number,
): Promise<IncomeStreamInput[]> {
  const [streams, pensions] = await Promise.all([
    db.incomeStream.findMany(),
    db.pension.findMany({ where: { isActive: true } }),
  ]);

  const result: IncomeStreamInput[] = [];
  const linkedPensionIds = new Set<string>();

  // Process income streams with pension links
  for (const stream of streams) {
    if (stream.computedFromPensionId) {
      linkedPensionIds.add(stream.computedFromPensionId);
      const pension = pensions.find((p) => p.id === stream.computedFromPensionId);
      if (pension) {
        const params = buildCalcParams(serializePension(pension), retirementAge, birthYear);
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

    const params = buildCalcParams(serializePension(pension), retirementAge, birthYear);
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
