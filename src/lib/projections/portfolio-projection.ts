/**
 * Portfolio projection engine — monthly granularity, with/without DRIP.
 *
 * Mirrors the Excel "Projection" tab logic:
 *   - Share price compounds monthly at priceGrowthRate/12
 *   - Dividend per share compounds monthly at dividendGrowthRate/12
 *   - Contributions buy new shares each month
 *   - Two parallel tracks: without DRIP (dividends paid out) vs with DRIP
 */

export interface ProjectionParams {
  /** Current portfolio value in cents */
  startingValueCents: number;
  /** Weighted average annual dividend yield (e.g. 0.035 = 3.5%) */
  startingYield: number;
  /** Monthly contribution in cents */
  monthlyContributionCents: number;
  /** Annual price growth rate (e.g. 0.02 = 2%) */
  priceGrowthRate: number;
  /** Annual dividend growth rate (e.g. 0.01 = 1%) */
  dividendGrowthRate: number;
  /** Number of years to project */
  yearsToProject: number;
}

export interface ProjectionMonth {
  /** Months from start (0-based) */
  month: number;
  /** Year from start (0-based) */
  year: number;
  /** Calendar date */
  date: string;
  /** Portfolio value without DRIP (cents) */
  portfolioNoDripCents: number;
  /** Portfolio value with DRIP (cents) */
  portfolioDripCents: number;
  /** Monthly dividend income without DRIP (cents) */
  monthlyDivNoDripCents: number;
  /** Monthly dividend income with DRIP (cents) */
  monthlyDivDripCents: number;
}

export interface ProjectionYear {
  year: number;
  date: string;
  portfolioNoDripCents: number;
  portfolioDripCents: number;
  monthlyDivNoDripCents: number;
  monthlyDivDripCents: number;
  /** Cumulative dividends received without DRIP (cents) */
  cumulativeDivNoDripCents: number;
  /** Cumulative dividends received with DRIP (cents) */
  cumulativeDivDripCents: number;
}

export interface ProjectionResult {
  yearly: ProjectionYear[];
}

export function projectPortfolio(params: ProjectionParams): ProjectionResult {
  const {
    startingValueCents,
    startingYield,
    monthlyContributionCents,
    priceGrowthRate,
    dividendGrowthRate,
    yearsToProject,
  } = params;

  if (startingValueCents <= 0 || yearsToProject <= 0) {
    return { yearly: [] };
  }

  const monthlyPriceGrowth = priceGrowthRate / 12;
  const monthlyDivGrowth = dividendGrowthRate / 12;
  const totalMonths = yearsToProject * 12;

  // Derive initial share price and shares from portfolio value
  // We use a normalized model: startingSharePrice = 100 (arbitrary unit)
  const startingSharePrice = 100;
  const startingShares = startingValueCents / startingSharePrice;

  // Dividend per share = yield × price / 12 (monthly)
  const startingDivPerShare = (startingYield * startingSharePrice) / 12;

  let sharePrice = startingSharePrice;
  let divPerShare = startingDivPerShare;

  // Two tracks
  let sharesNoDrip = startingShares;
  let sharesDrip = startingShares;

  let cumulativeDivNoDrip = 0;
  let cumulativeDivDrip = 0;

  const now = new Date();
  const startYear = now.getFullYear();
  const startMonth = now.getMonth();

  const yearly: ProjectionYear[] = [];

  // Record year 0 starting point
  yearly.push({
    year: 0,
    date: `${startYear}`,
    portfolioNoDripCents: Math.round(sharesNoDrip * sharePrice),
    portfolioDripCents: Math.round(sharesDrip * sharePrice),
    monthlyDivNoDripCents: Math.round(sharesNoDrip * divPerShare),
    monthlyDivDripCents: Math.round(sharesDrip * divPerShare),
    cumulativeDivNoDripCents: 0,
    cumulativeDivDripCents: 0,
  });

  for (let m = 1; m <= totalMonths; m++) {
    // Grow share price and div per share
    sharePrice *= 1 + monthlyPriceGrowth;
    divPerShare *= 1 + monthlyDivGrowth;

    // Monthly dividend income
    const divIncomeNoDrip = sharesNoDrip * divPerShare;
    const divIncomeDrip = sharesDrip * divPerShare;

    cumulativeDivNoDrip += divIncomeNoDrip;
    cumulativeDivDrip += divIncomeDrip;

    // Buy shares with contributions
    sharesNoDrip += monthlyContributionCents / sharePrice;
    // Buy shares with contributions + reinvested dividends
    sharesDrip += (monthlyContributionCents + divIncomeDrip) / sharePrice;

    // Record yearly snapshot at end of each 12-month cycle
    if (m % 12 === 0) {
      const yearNum = m / 12;
      const calendarYear = startYear + yearNum;

      yearly.push({
        year: yearNum,
        date: `${calendarYear}`,
        portfolioNoDripCents: Math.round(sharesNoDrip * sharePrice),
        portfolioDripCents: Math.round(sharesDrip * sharePrice),
        monthlyDivNoDripCents: Math.round(sharesNoDrip * divPerShare),
        monthlyDivDripCents: Math.round(sharesDrip * divPerShare),
        cumulativeDivNoDripCents: Math.round(cumulativeDivNoDrip),
        cumulativeDivDripCents: Math.round(cumulativeDivDrip),
      });
    }
  }

  return { yearly };
}
