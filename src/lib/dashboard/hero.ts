/**
 * Hero card computation — "Years to Freedom".
 *
 * Always uses the FIRE projection engine (same as the retirement overview)
 * with baseline scenario assumptions when available, otherwise sensible defaults.
 */
import type { User } from "@/generated/prisma/client";
import type { ScopedPrisma } from "@/lib/db/scoped";
import type { IncomeStreamInput } from "@/lib/projections/fire";
import { projectFire } from "@/lib/projections/fire";
import { computeContributionTable } from "@/lib/contributions/compute";

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
 * Compute hero metrics using the FIRE engine.
 * Uses baseline scenario assumptions when available, same defaults as the
 * retirement overview otherwise (consistent with RetirementOverview).
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

  // Use baseline scenario assumptions, or same defaults as the retirement page
  const baseline = await db.scenario.findMany({ where: { isBaseline: true } });
  const baselineScenario = baseline[0] ?? null;

  // Determine contribution amount: baseline > historical average > fallback
  let monthlyContributionCents: number;
  if (baselineScenario) {
    monthlyContributionCents = Number(baselineScenario.monthlyContributionCents);
  } else {
    const contributionRows = await computeContributionTable(db, user.birthYear);
    const recentYears = contributionRows.filter(
      (r) => r.year >= currentYear - 3 && r.year < currentYear,
    );
    const avgAnnualContribCents = recentYears.length > 0
      ? recentYears.reduce((sum, r) => sum + r.totalDepositCents, 0) / recentYears.length
      : 0;
    monthlyContributionCents = avgAnnualContribCents > 0
      ? Math.round(avgAnnualContribCents / 12)
      : 300000;
  }

  const result = projectFire(
    {
      currentAge,
      retirementAge: targetRetirementAge,
      currentPortfolioValueCents: netWorthCents,
      currentAnnualDividendsCents: annualizedDividendsCents,
      annualContributionCents: monthlyContributionCents * 12,
      assumedPriceGrowth: baselineScenario ? Number(baselineScenario.assumedPriceGrowth) : 0.02,
      assumedDividendGrowth: baselineScenario ? Number(baselineScenario.assumedDividendGrowth) : 0.01,
      assumedInflation: baselineScenario ? Number(baselineScenario.assumedInflation) : 0.025,
      reinvestDividends: baselineScenario?.reinvestDividends ?? true,
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
    pensionIncomeCents: retProj?.pensionIncomeCents ?? 0,
    otherStreamIncomeCents: retProj?.otherIncomeCents ?? 0,
    totalIncomeAtRetirementCents: totalAtRetirement,
    targetIncomeCents: Math.round(targetIncomeCents),
  };
}
