import { requireAuth } from "@/lib/auth/middleware";
import { scopedPrisma } from "@/lib/db/scoped";
import { getPositions } from "@/lib/positions/query";
import { computeNetWorth } from "@/lib/dashboard/net-worth";
import { computeDividendsSummary } from "@/lib/dashboard/dividends-summary";
import { getIncomeStreams } from "@/lib/projections/income";
import { projectFire } from "@/lib/projections/fire";
import { Header } from "@/components/layout/Header";
import { PensionCalculator } from "@/components/retirement/PensionCalculator";
import { ScenarioComparison } from "@/components/retirement/ScenarioComparison";
import { IncomeStreamManager } from "@/components/retirement/IncomeStreamManager";
import { RetirementTabs } from "@/components/retirement/RetirementTabs";

export const dynamic = "force-dynamic";

export default async function RetirementPage() {
  const { user } = await requireAuth();
  const locale = user.locale;
  const db = scopedPrisma(user.id);
  const currentYear = new Date().getFullYear();
  const currentAge = currentYear - user.birthYear;

  // Fetch data in parallel
  const [positions, pensionsRaw, scenariosRaw, streamsRaw] = await Promise.all([
    getPositions(db),
    db.pension.findMany({ where: { isActive: true } }),
    db.scenario.findMany({ orderBy: { createdAt: "asc" } }),
    db.incomeStream.findMany(),
  ]);

  const [netWorth, dividends] = await Promise.all([
    computeNetWorth(db, positions),
    computeDividendsSummary(db, positions),
  ]);

  // Serialize pensions
  const pensions = pensionsRaw.map((p) => ({
    id: p.id,
    name: p.name,
    startYear: p.startYear,
    baseAccrualRate: Number(p.baseAccrualRate),
    initialBaseYears: p.initialBaseYears,
    earlyRetirementReduction: Number(p.earlyRetirementReduction),
    normalRetirementAge: p.normalRetirementAge,
    salaryBasisCents: Number(p.salaryBasisCents),
    isActive: p.isActive,
  }));

  // Serialize income streams
  const streams = streamsRaw.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    startAge: s.startAge,
    endAge: s.endAge,
    annualAmountCents: s.annualAmountCents ? Number(s.annualAmountCents) : null,
    computedFromPensionId: s.computedFromPensionId,
    inflationIndexed: s.inflationIndexed,
    notes: s.notes,
  }));

  // Get income stream inputs for projections
  const incomeStreamInputs = await getIncomeStreams(db, user.targetRetirementAge);

  // Serialize and run projections for each scenario
  const targetIncomeCents =
    Number(user.currentSalaryCents) * Number(user.targetIncomeReplacement);

  const scenarios = scenariosRaw.map((s) => {
    const scenario = {
      id: s.id,
      name: s.name,
      retirementAge: s.retirementAge,
      targetIncomeReplacement: Number(s.targetIncomeReplacement),
      assumedPriceGrowth: Number(s.assumedPriceGrowth),
      assumedDividendGrowth: Number(s.assumedDividendGrowth),
      assumedInflation: Number(s.assumedInflation),
      monthlyContributionCents: Number(s.monthlyContributionCents),
      reinvestDividends: s.reinvestDividends,
      isBaseline: s.isBaseline,
    };

    const projection = projectFire(
      {
        currentAge,
        retirementAge: scenario.retirementAge,
        currentPortfolioValueCents: netWorth.netWorthCents,
        currentAnnualDividendsCents: dividends.annualizedCents,
        annualContributionCents: scenario.monthlyContributionCents * 12,
        assumedPriceGrowth: scenario.assumedPriceGrowth,
        assumedDividendGrowth: scenario.assumedDividendGrowth,
        assumedInflation: scenario.assumedInflation,
        reinvestDividends: scenario.reinvestDividends,
        incomeStreams: incomeStreamInputs,
      },
      targetIncomeCents,
    );

    return { scenario, projection };
  });

  return (
    <>
      <Header displayName={user.displayName} isAdmin={user.isAdmin} />
      <main className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">
        <RetirementTabs
          pensionTab={
            <PensionCalculator
              pensions={pensions}
              locale={locale}
              retirementAge={user.targetRetirementAge}
              birthYear={user.birthYear}
            />
          }
          scenarioTab={
            <ScenarioComparison scenarios={scenarios} locale={locale} />
          }
          incomeTab={
            <IncomeStreamManager streams={streams} locale={locale} />
          }
        />
      </main>
    </>
  );
}
