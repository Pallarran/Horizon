/**
 * Income composition data for the stacked area chart.
 * Projects income by source across ages.
 *
 * Uses IncomeStream records for pension/QPP/OAS amounts.
 */
import type { IncomeStreamInput } from "@/lib/projections/fire";

export interface IncomeCompositionPoint {
  age: number;
  dividends: number;
  pension: number;
  qpp: number;
  oas: number;
}

/**
 * Compute income composition chart data.
 * @param currentAge - User's current age
 * @param annualDividendsDollars - Current annualized dividends in dollars
 * @param incomeStreams - Materialized income streams
 * @param dividendGrowthRate - Assumed annual dividend growth (default 0.05)
 */
export function computeIncomeComposition(
  currentAge: number,
  annualDividendsDollars: number,
  incomeStreams: IncomeStreamInput[],
  dividendGrowthRate: number = 0.05,
): IncomeCompositionPoint[] {
  // Categorize streams
  let pensionStartAge = 999;
  let pensionAmount = 0;
  let qppStartAge = 999;
  let qppAmount = 0;
  let oasStartAge = 999;
  let oasAmount = 0;

  for (const s of incomeStreams) {
    const dollars = s.annualAmountCents / 100;
    const nameLower = s.name.toLowerCase();
    if (
      nameLower.includes("pension") ||
      nameLower.includes("rrmd") ||
      nameLower.includes("rregop")
    ) {
      pensionStartAge = s.startAge;
      pensionAmount += dollars;
    } else if (
      nameLower.includes("qpp") ||
      nameLower.includes("rrq") ||
      nameLower.includes("cpp")
    ) {
      qppStartAge = s.startAge;
      qppAmount += dollars;
    } else if (nameLower.includes("oas") || nameLower.includes("psv")) {
      oasStartAge = s.startAge;
      oasAmount += dollars;
    } else {
      // Other streams — add to pension bucket for simplicity
      if (dollars > 0 && s.startAge < pensionStartAge) {
        pensionStartAge = s.startAge;
      }
      pensionAmount += dollars;
    }
  }

  const points: IncomeCompositionPoint[] = [];

  // Generate data points from current age to age 80, every 5 years
  const ages = new Set<number>();
  for (let age = currentAge; age <= 80; age += 5) {
    ages.add(age);
  }
  for (const keyAge of [55, 60, 65, 70, 75, 80]) {
    if (keyAge > currentAge) ages.add(keyAge);
  }
  const sortedAges = [...ages].sort((a, b) => a - b);

  for (const age of sortedAges) {
    const yearsOut = age - currentAge;
    const dividends = Math.round(
      annualDividendsDollars * Math.pow(1 + dividendGrowthRate, yearsOut),
    );
    const pension = age >= pensionStartAge ? pensionAmount : 0;
    const qpp = age >= qppStartAge ? qppAmount : 0;
    const oas = age >= oasStartAge ? oasAmount : 0;

    points.push({ age, dividends, pension, qpp, oas });
  }

  return points;
}
