import type { PensionParams } from "@/lib/pension/calculate";

export interface SerializedPension {
  id: string;
  name: string;
  planType: "DB_FORMULA" | "DB_STATEMENT" | "DC";
  isActive: boolean;
  startYear: number | null;
  baseAccrualRate: number | null;
  earlyRetirementReduction: number | null;
  normalRetirementAge: number | null;
  salaryBasisCents: number | null;
  statementAnnualCents: number | null;
  statementRetirementAge: number | null;
  bridgeBenefitCents: number | null;
  bridgeEndAge: number | null;
  indexationRate: number | null;
  currentBalanceCents: number | null;
  employeeContribRate: number | null;
  employerContribRate: number | null;
  dcSalaryCents: number | null;
  assumedGrowthRate: number | null;
}

export function buildCalcParams(
  pension: SerializedPension,
  retirementAge: number,
  birthYear: number,
): PensionParams | null {
  const currentYear = new Date().getFullYear();
  const currentAge = currentYear - birthYear;
  const yearsToRetirement = Math.max(0, retirementAge - currentAge);
  const retirementYear = currentYear + yearsToRetirement;

  const bridge = {
    bridgeBenefitCents: pension.bridgeBenefitCents,
    bridgeEndAge: pension.bridgeEndAge,
    indexationRate: pension.indexationRate,
  };

  switch (pension.planType) {
    case "DB_FORMULA": {
      if (!pension.startYear || !pension.salaryBasisCents || !pension.baseAccrualRate) return null;
      return {
        planType: "DB_FORMULA",
        startYear: pension.startYear,
        retirementYear,
        salaryBasisCents: pension.salaryBasisCents,
        baseAccrualRate: pension.baseAccrualRate,
        normalRetirementAge: pension.normalRetirementAge ?? 65,
        earlyRetirementReduction: pension.earlyRetirementReduction ?? 0.04,
        retirementAge,
        ...bridge,
      };
    }
    case "DB_STATEMENT": {
      if (!pension.statementAnnualCents || !pension.statementRetirementAge) return null;
      return {
        planType: "DB_STATEMENT",
        statementAnnualCents: pension.statementAnnualCents,
        statementRetirementAge: pension.statementRetirementAge,
        earlyRetirementReduction: pension.earlyRetirementReduction,
        retirementAge,
        ...bridge,
      };
    }
    case "DC": {
      if (!pension.currentBalanceCents || !pension.dcSalaryCents) return null;
      const salary = pension.dcSalaryCents;
      const empRate = pension.employeeContribRate ?? 0;
      const erRate = pension.employerContribRate ?? 0;
      return {
        planType: "DC",
        currentBalanceCents: pension.currentBalanceCents,
        annualContributionCents: Math.round(salary * (empRate + erRate)),
        assumedGrowthRate: pension.assumedGrowthRate ?? 0.05,
        yearsToRetirement,
        retirementAge,
      };
    }
  }
}
