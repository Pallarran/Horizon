/**
 * Defined-benefit pension calculation — RRMD formula.
 *
 * From PRD §4.5 / Appendix 11.2:
 *   Base A: initialBaseYears × baseAccrualRate × salaryBasis
 *   Base B: max(0, yearsOfService - initialBaseYears) × baseAccrualRate × salaryBasis
 *   Pre-reduction: Base A + Base B
 *   Reduction: max(0, (normalRetirementAge - retirementAge) × reductionRate)
 *   Final: pre-reduction × (1 - reduction)
 *
 * Verification: 2 × 0.015 × 90000 + 27 × 0.015 × 90000 = 39150
 *              39150 × (1 - 0.40) = $23,490 ✓
 */

export interface PensionParams {
  startYear: number;
  retirementYear: number;
  salaryBasisCents: number;
  baseAccrualRate: number;       // e.g. 0.015
  initialBaseYears: number;       // e.g. 2
  normalRetirementAge: number;    // e.g. 65
  earlyRetirementReduction: number; // e.g. 0.04
  retirementAge: number;          // actual planned retirement age
}

export interface PensionResult {
  yearsOfService: number;
  baseACents: number;
  baseBCents: number;
  preReductionCents: number;
  reductionPercent: number;
  annualPensionCents: number;
  monthlyPensionCents: number;
}

export function calculatePension(params: PensionParams): PensionResult {
  const yearsOfService = params.retirementYear - params.startYear;
  const salaryDollars = params.salaryBasisCents / 100;

  // Base A: initial base years
  const baseADollars = params.initialBaseYears * params.baseAccrualRate * salaryDollars;

  // Base B: remaining years
  const remainingYears = Math.max(0, yearsOfService - params.initialBaseYears);
  const baseBDollars = remainingYears * params.baseAccrualRate * salaryDollars;

  const preReductionDollars = baseADollars + baseBDollars;

  // Early retirement reduction
  const yearsEarly = Math.max(0, params.normalRetirementAge - params.retirementAge);
  const reductionPercent = Math.min(1, yearsEarly * params.earlyRetirementReduction);

  const annualPensionDollars = preReductionDollars * (1 - reductionPercent);

  return {
    yearsOfService,
    baseACents: Math.round(baseADollars * 100),
    baseBCents: Math.round(baseBDollars * 100),
    preReductionCents: Math.round(preReductionDollars * 100),
    reductionPercent,
    annualPensionCents: Math.round(annualPensionDollars * 100),
    monthlyPensionCents: Math.round((annualPensionDollars / 12) * 100),
  };
}
