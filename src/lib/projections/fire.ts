/**
 * FIRE projection engine — year-by-year portfolio and income projection.
 *
 * From PRD Appendix 11.3:
 *   Each year: portfolio grows by priceGrowth, dividends grow by dividendGrowth,
 *   contributions added, dividends optionally reinvested.
 *
 * Runs from current age through retirement + 30 years (or age 90).
 */

export interface FireParams {
  currentAge: number;
  retirementAge: number;
  currentPortfolioValueCents: number;
  currentAnnualDividendsCents: number;
  annualContributionCents: number;
  assumedPriceGrowth: number;       // e.g. 0.02
  assumedDividendGrowth: number;    // e.g. 0.01
  assumedInflation: number;         // e.g. 0.025
  reinvestDividends: boolean;
  /** Income streams: pension, QPP, OAS, etc. */
  incomeStreams: IncomeStreamInput[];
}

export interface IncomeStreamInput {
  name: string;
  startAge: number;
  endAge: number | null;  // null = lifetime
  annualAmountCents: number;
  inflationIndexed: boolean;
}

export interface ProjectionYear {
  age: number;
  year: number;
  /** Portfolio value at start of year (cents) */
  portfolioValueCents: number;
  /** Dividend income this year (cents) */
  dividendIncomeCents: number;
  /** Pension + other income streams this year (cents) */
  otherIncomeCents: number;
  /** Total passive income this year (cents) */
  totalIncomeCents: number;
  /** Contributions this year (cents, 0 after retirement) */
  contributionCents: number;
  /** Coverage: totalIncome / target income */
  coveragePercent: number;
}

export interface FireResult {
  projections: ProjectionYear[];
  /** Year when totalIncome >= target income (null if never) */
  freedomAge: number | null;
  /** Portfolio value at retirement age */
  portfolioAtRetirementCents: number;
  /** Annual income at retirement age */
  incomeAtRetirementCents: number;
}

export function projectFire(
  params: FireParams,
  targetIncomeCents: number,
): FireResult {
  const currentYear = new Date().getFullYear();
  const endAge = Math.max(params.retirementAge + 30, 90);
  const projections: ProjectionYear[] = [];

  let portfolioValue = params.currentPortfolioValueCents;
  let annualDividends = params.currentAnnualDividendsCents;
  let freedomAge: number | null = null;
  let portfolioAtRetirement = 0;
  let incomeAtRetirement = 0;

  for (let age = params.currentAge; age <= endAge; age++) {
    const year = currentYear + (age - params.currentAge);
    const isPreRetirement = age < params.retirementAge;

    // Contributions (only before retirement)
    const contribution = isPreRetirement ? params.annualContributionCents : 0;

    // Dividend income this year
    const dividendIncome = annualDividends;

    // Other income streams (pension, QPP, OAS, etc.)
    const yearsFromNow = age - params.currentAge;
    let otherIncome = 0;
    for (const stream of params.incomeStreams) {
      if (age >= stream.startAge && (stream.endAge === null || age <= stream.endAge)) {
        const inflationFactor = stream.inflationIndexed
          ? Math.pow(1 + params.assumedInflation, yearsFromNow)
          : 1;
        otherIncome += Math.round(stream.annualAmountCents * inflationFactor);
      }
    }

    const totalIncome = dividendIncome + otherIncome;
    const coveragePercent = targetIncomeCents > 0 ? totalIncome / targetIncomeCents : 0;

    projections.push({
      age,
      year,
      portfolioValueCents: Math.round(portfolioValue),
      dividendIncomeCents: Math.round(dividendIncome),
      otherIncomeCents: Math.round(otherIncome),
      totalIncomeCents: Math.round(totalIncome),
      contributionCents: Math.round(contribution),
      coveragePercent,
    });

    // Track freedom age
    if (freedomAge === null && totalIncome >= targetIncomeCents) {
      freedomAge = age;
    }

    // Track retirement snapshot
    if (age === params.retirementAge) {
      portfolioAtRetirement = Math.round(portfolioValue);
      incomeAtRetirement = Math.round(totalIncome);
    }

    // Grow portfolio for next year
    // Price growth applies to existing portfolio
    portfolioValue = portfolioValue * (1 + params.assumedPriceGrowth);
    // Add contributions
    portfolioValue += contribution;
    // Reinvest dividends if enabled
    if (params.reinvestDividends && isPreRetirement) {
      portfolioValue += dividendIncome;
    }

    // Grow dividends for next year
    annualDividends = annualDividends * (1 + params.assumedDividendGrowth);
  }

  return {
    projections,
    freedomAge,
    portfolioAtRetirementCents: portfolioAtRetirement,
    incomeAtRetirementCents: incomeAtRetirement,
  };
}
