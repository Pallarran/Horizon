/**
 * Pension calculation engine — supports DB Formula, DB Statement, and DC plans.
 *
 * DB_FORMULA: years × accrualRate × salary, with early retirement reduction.
 * DB_STATEMENT: user-provided projected amount, optionally adjusted for retirement age.
 * DC: future value projection with 4% withdrawal rule.
 */

export type PensionPlanType = "DB_FORMULA" | "DB_STATEMENT" | "DC";

/* ── Input types ── */

interface BasePensionFields {
  retirementAge: number;
  bridgeBenefitCents?: number | null;
  bridgeEndAge?: number | null;
  indexationRate?: number | null;
}

export interface DbFormulaParams extends BasePensionFields {
  planType: "DB_FORMULA";
  startYear: number;
  retirementYear: number;
  salaryBasisCents: number;
  baseAccrualRate: number;
  normalRetirementAge: number;
  earlyRetirementReduction: number;
}

export interface DbStatementParams extends BasePensionFields {
  planType: "DB_STATEMENT";
  statementAnnualCents: number;
  statementRetirementAge: number;
  earlyRetirementReduction?: number | null;
  normalRetirementAge?: number | null;
}

export interface DcParams extends BasePensionFields {
  planType: "DC";
  currentBalanceCents: number;
  annualContributionCents: number;
  assumedGrowthRate: number;
  yearsToRetirement: number;
}

export type PensionParams = DbFormulaParams | DbStatementParams | DcParams;

/* ── Result type ── */

export interface PensionResult {
  planType: PensionPlanType;
  annualPensionCents: number;
  monthlyPensionCents: number;
  // DB_FORMULA specific
  yearsOfService?: number;
  preReductionCents?: number;
  reductionPercent?: number;
  // DC specific
  projectedBalanceCents?: number;
  // Bridge
  bridgeAnnualCents?: number;
  bridgeEndAge?: number;
  // Indexation
  indexationRate?: number;
}

/* ── Dispatch ── */

export function calculatePension(params: PensionParams): PensionResult {
  let result: PensionResult;

  switch (params.planType) {
    case "DB_FORMULA":
      result = calculateDbFormula(params);
      break;
    case "DB_STATEMENT":
      result = calculateDbStatement(params);
      break;
    case "DC":
      result = calculateDc(params);
      break;
  }

  // Attach bridge benefit info
  if (params.bridgeBenefitCents && params.bridgeBenefitCents > 0) {
    result.bridgeAnnualCents = params.bridgeBenefitCents;
    result.bridgeEndAge = params.bridgeEndAge ?? 65;
  }

  // Attach indexation rate
  if (params.indexationRate && params.indexationRate > 0) {
    result.indexationRate = params.indexationRate;
  }

  return result;
}

/* ── DB Formula calculator ── */

function calculateDbFormula(params: DbFormulaParams): PensionResult {
  const yearsOfService = params.retirementYear - params.startYear;
  const salaryDollars = params.salaryBasisCents / 100;

  const grossDollars = yearsOfService * params.baseAccrualRate * salaryDollars;

  const yearsEarly = Math.max(0, params.normalRetirementAge - params.retirementAge);
  const reductionPercent = Math.min(1, yearsEarly * params.earlyRetirementReduction);

  const annualDollars = grossDollars * (1 - reductionPercent);

  return {
    planType: "DB_FORMULA",
    annualPensionCents: Math.round(annualDollars * 100),
    monthlyPensionCents: Math.round((annualDollars / 12) * 100),
    yearsOfService,
    preReductionCents: Math.round(grossDollars * 100),
    reductionPercent,
  };
}

/* ── DB Statement calculator ── */

function calculateDbStatement(params: DbStatementParams): PensionResult {
  let annualCents = params.statementAnnualCents;

  // Adjust if retiring at a different age than the statement
  if (params.retirementAge !== params.statementRetirementAge) {
    const yearsOff = params.statementRetirementAge - params.retirementAge;
    if (yearsOff > 0 && params.earlyRetirementReduction) {
      // Retiring earlier than statement age — apply reduction
      const reduction = Math.min(1, yearsOff * params.earlyRetirementReduction);
      annualCents = Math.round(annualCents * (1 - reduction));
    }
    // If retiring later, no adjustment (statement amount is the baseline)
  }

  return {
    planType: "DB_STATEMENT",
    annualPensionCents: annualCents,
    monthlyPensionCents: Math.round(annualCents / 12),
  };
}

/* ── DC calculator (4% withdrawal rule) ── */

const WITHDRAWAL_RATE = 0.04;

function calculateDc(params: DcParams): PensionResult {
  const g = params.assumedGrowthRate;
  const y = params.yearsToRetirement;
  const balance = params.currentBalanceCents;
  const annual = params.annualContributionCents;

  // FV = balance × (1+g)^y + annual × [((1+g)^y - 1) / g]
  const growthFactor = Math.pow(1 + g, y);
  const projectedBalance = g > 0
    ? balance * growthFactor + annual * ((growthFactor - 1) / g)
    : balance + annual * y;

  const projectedBalanceCents = Math.round(projectedBalance);
  const annualIncome = Math.round(projectedBalance * WITHDRAWAL_RATE);

  return {
    planType: "DC",
    annualPensionCents: annualIncome,
    monthlyPensionCents: Math.round(annualIncome / 12),
    projectedBalanceCents,
  };
}
