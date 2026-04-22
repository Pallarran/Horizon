/**
 * Milestone projections — simplified Phase 5 version.
 * Projects portfolio growth and income at key milestones.
 *
 * Assumptions (simplified, full FIRE engine in Phase 7):
 * - 7% annual portfolio growth
 * - 5% annual dividend growth
 * - Uses current dividend yield as base
 *
 * Milestones: 5y, 10y, 15y, 20y, at target retirement age, 25y, 30y
 */
export interface MilestoneRow {
  label: string;
  years: number;
  age: number;
  portfolioCents: number;
  incomeCents: number;
}

export interface MilestoneData {
  milestones: MilestoneRow[];
}

export function computeMilestones(
  currentAge: number,
  targetRetirementAge: number,
  portfolioValueCents: number,
  annualDividendsCents: number,
): MilestoneData {
  const growthRate = 0.07;
  const dividendGrowthRate = 0.05;

  const milestoneYears = [5, 10, 15, 20, 25, 30];
  const retirementYears = targetRetirementAge - currentAge;

  // Insert retirement age milestone if it doesn't coincide with a standard one
  const allYears = [...new Set([...milestoneYears, retirementYears])]
    .filter((y) => y > 0)
    .sort((a, b) => a - b);

  const milestones: MilestoneRow[] = allYears.map((years) => {
    const age = currentAge + years;
    const portfolioCents = Math.round(
      portfolioValueCents * Math.pow(1 + growthRate, years),
    );
    const incomeCents = Math.round(
      annualDividendsCents * Math.pow(1 + dividendGrowthRate, years),
    );

    const isRetirement = years === retirementYears && !milestoneYears.includes(years);
    const label = isRetirement ? `At ${age}` : `${years}y`;

    return { label, years, age, portfolioCents, incomeCents };
  });

  return { milestones };
}
