/**
 * Hero card computation — "Years to Freedom".
 *
 * Uses FIRE projection engine if a baseline scenario exists,
 * otherwise falls back to simple dividend growth estimate.
 */
import type { User } from "@/generated/prisma/client";
import type { ScopedPrisma } from "@/lib/db/scoped";
import type { IncomeStreamInput } from "@/lib/projections/fire";
import { projectFire } from "@/lib/projections/fire";

export interface HeroData {
  yearsToFreedom: number | null;
  coveragePercent: number;
  targetIncomeReplacementPercent: number;
  currentAge: number;
  targetRetirementAge: number;
}

/**
 * Compute hero metrics using the full FIRE engine if a baseline scenario exists.
 */
export async function computeHero(
  db: ScopedPrisma,
  user: User,
  annualizedDividendsCents: number,
  netWorthCents: number,
  incomeStreams: IncomeStreamInput[],
): Promise<HeroData> {
  const currentYear = new Date().getFullYear();
  const currentAge = currentYear - user.birthYear;
  const targetRetirementAge = user.targetRetirementAge;
  const targetReplacement = Number(user.targetIncomeReplacement);
  const targetIncomeCents = Number(user.currentSalaryCents) * targetReplacement;

  // Try to use baseline scenario for accurate projection
  const baseline = await db.scenario.findMany({ where: { isBaseline: true } });
  const baselineScenario = baseline[0];

  if (baselineScenario && annualizedDividendsCents > 0) {
    const result = projectFire(
      {
        currentAge,
        retirementAge: baselineScenario.retirementAge,
        currentPortfolioValueCents: netWorthCents,
        currentAnnualDividendsCents: annualizedDividendsCents,
        annualContributionCents: Number(baselineScenario.monthlyContributionCents) * 12,
        assumedPriceGrowth: Number(baselineScenario.assumedPriceGrowth),
        assumedDividendGrowth: Number(baselineScenario.assumedDividendGrowth),
        assumedInflation: Number(baselineScenario.assumedInflation),
        reinvestDividends: baselineScenario.reinvestDividends,
        incomeStreams,
      },
      targetIncomeCents,
    );

    const freedomAge = result.freedomAge;
    const yearsToFreedom = freedomAge !== null ? freedomAge - currentAge : null;

    // Current coverage from first projection year
    const currentYearProjection = result.projections[0];
    const coveragePercent = currentYearProjection
      ? currentYearProjection.coveragePercent
      : 0;

    return {
      yearsToFreedom: yearsToFreedom !== null
        ? Math.round(yearsToFreedom * 10) / 10
        : null,
      coveragePercent,
      targetIncomeReplacementPercent: targetReplacement,
      currentAge,
      targetRetirementAge,
    };
  }

  // Fallback: simple estimate
  const currentIncomeCents = annualizedDividendsCents;
  const coveragePercent =
    targetIncomeCents > 0 ? currentIncomeCents / targetIncomeCents : 0;

  let yearsToFreedom: number | null = null;
  if (currentIncomeCents > 0 && currentIncomeCents < targetIncomeCents) {
    const growthRate = 0.07;
    const ratio = targetIncomeCents / currentIncomeCents;
    yearsToFreedom = Math.round(Math.log(ratio) / Math.log(1 + growthRate) * 10) / 10;
  } else if (currentIncomeCents >= targetIncomeCents) {
    yearsToFreedom = 0;
  }

  return {
    yearsToFreedom,
    coveragePercent,
    targetIncomeReplacementPercent: targetReplacement,
    currentAge,
    targetRetirementAge,
  };
}
