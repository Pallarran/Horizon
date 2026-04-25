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
  /** Current coverage: today's income / target */
  coveragePercent: number;
  /** Projected coverage at retirement: projected income / target */
  retirementCoveragePercent: number;
  targetIncomeReplacementPercent: number;
  currentAge: number;
  targetRetirementAge: number;
  /** Retirement projection breakdown */
  portfolioAtRetirementCents: number;
  dividendIncomeAtRetirementCents: number;
  /** Sum of all defined-benefit pension plans at retirement */
  pensionIncomeCents: number;
  /** Sum of other income streams (government benefits, rental, etc.) at retirement */
  otherStreamIncomeCents: number;
  totalIncomeAtRetirementCents: number;
  targetIncomeCents: number;
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

  // Compute income breakdown at retirement age
  const yearsToRetirement = Math.max(0, targetRetirementAge - currentAge);

  function computeGroupedIncome(atAge: number, inflation: number): { pensionCents: number; otherCents: number } {
    const yearsFromNow = Math.max(0, atAge - currentAge);
    let pensionCents = 0;
    let otherCents = 0;
    for (const s of incomeStreams) {
      if (atAge < s.startAge) continue;
      if (s.endAge !== null && atAge > s.endAge) continue;
      const inflationFactor = s.inflationIndexed
        ? Math.pow(1 + inflation, yearsFromNow)
        : 1;
      const amount = Math.round(s.annualAmountCents * inflationFactor);
      if (s.isPension) {
        pensionCents += amount;
      } else {
        otherCents += amount;
      }
    }
    return { pensionCents, otherCents };
  }

  if (baselineScenario && annualizedDividendsCents > 0) {
    const assumedInflation = Number(baselineScenario.assumedInflation);
    const result = projectFire(
      {
        currentAge,
        retirementAge: baselineScenario.retirementAge,
        currentPortfolioValueCents: netWorthCents,
        currentAnnualDividendsCents: annualizedDividendsCents,
        annualContributionCents: Number(baselineScenario.monthlyContributionCents) * 12,
        assumedPriceGrowth: Number(baselineScenario.assumedPriceGrowth),
        assumedDividendGrowth: Number(baselineScenario.assumedDividendGrowth),
        assumedInflation,
        reinvestDividends: baselineScenario.reinvestDividends,
        incomeStreams,
      },
      targetIncomeCents,
    );

    const freedomAge = result.freedomAge;
    const yearsToFreedomVal = freedomAge !== null ? freedomAge - currentAge : null;

    // Current coverage from first projection year
    const currentYearProjection = result.projections[0];
    const coveragePercent = currentYearProjection
      ? currentYearProjection.coveragePercent
      : 0;

    // Extract retirement-year projection for the projection card
    const retProj = result.projections.find(
      (p) => p.age === targetRetirementAge,
    );

    const grouped = computeGroupedIncome(targetRetirementAge, assumedInflation);
    const totalAtRetirement = retProj?.totalIncomeCents ?? result.incomeAtRetirementCents;
    const retirementCoveragePercent = targetIncomeCents > 0 ? totalAtRetirement / targetIncomeCents : 0;

    return {
      yearsToFreedom: yearsToFreedomVal !== null
        ? Math.round(yearsToFreedomVal * 10) / 10
        : null,
      coveragePercent,
      retirementCoveragePercent,
      targetIncomeReplacementPercent: targetReplacement,
      currentAge,
      targetRetirementAge,
      portfolioAtRetirementCents: retProj?.portfolioValueCents ?? result.portfolioAtRetirementCents,
      dividendIncomeAtRetirementCents: retProj?.dividendIncomeCents ?? 0,
      pensionIncomeCents: grouped.pensionCents,
      otherStreamIncomeCents: grouped.otherCents,
      totalIncomeAtRetirementCents: totalAtRetirement,
      targetIncomeCents: Math.round(targetIncomeCents),
    };
  }

  // Fallback: simple estimate
  const fallbackInflation = 0.025;
  const portfolioGrowth = 0.07;
  const dividendGrowth = 0.05;

  // Compute current income from all sources (not just dividends)
  const currentGrouped = computeGroupedIncome(currentAge, 0); // current age, no inflation
  const currentIncomeCents = annualizedDividendsCents + currentGrouped.pensionCents + currentGrouped.otherCents;
  const coveragePercent =
    targetIncomeCents > 0 ? currentIncomeCents / targetIncomeCents : 0;

  let yearsToFreedom: number | null = null;
  if (currentIncomeCents > 0 && currentIncomeCents < targetIncomeCents) {
    const ratio = targetIncomeCents / currentIncomeCents;
    yearsToFreedom = Math.round(Math.log(ratio) / Math.log(1 + dividendGrowth) * 10) / 10;
  } else if (currentIncomeCents >= targetIncomeCents) {
    yearsToFreedom = 0;
  }

  // Fallback retirement projection using simple growth
  const fallbackPortfolio = Math.round(
    netWorthCents * Math.pow(1 + portfolioGrowth, yearsToRetirement),
  );
  const fallbackDividends = Math.round(
    annualizedDividendsCents * Math.pow(1 + dividendGrowth, yearsToRetirement),
  );
  const grouped = computeGroupedIncome(targetRetirementAge, fallbackInflation);
  const fallbackTotal = fallbackDividends + grouped.pensionCents + grouped.otherCents;
  const retirementCoveragePercent = targetIncomeCents > 0 ? fallbackTotal / targetIncomeCents : 0;

  return {
    yearsToFreedom,
    coveragePercent,
    retirementCoveragePercent,
    targetIncomeReplacementPercent: targetReplacement,
    currentAge,
    targetRetirementAge,
    portfolioAtRetirementCents: fallbackPortfolio,
    dividendIncomeAtRetirementCents: fallbackDividends,
    pensionIncomeCents: grouped.pensionCents,
    otherStreamIncomeCents: grouped.otherCents,
    totalIncomeAtRetirementCents: fallbackTotal,
    targetIncomeCents: Math.round(targetIncomeCents),
  };
}
