import { requireAuth } from "@/lib/auth/middleware";
import { scopedPrisma } from "@/lib/db/scoped";
import { getPositions } from "@/lib/positions/query";
import { getCrcdComputedPositions } from "@/lib/positions/crcd";
import { computeNetWorth } from "@/lib/dashboard/net-worth";
import { computeDividendsSummary } from "@/lib/dashboard/dividends-summary";
import { Header } from "@/components/layout/Header";
import { RetirementPageClient } from "@/components/retirement/RetirementPageClient";

export const dynamic = "force-dynamic";

export default async function RetirementPage() {
  const { user } = await requireAuth();
  const locale = user.locale;
  const db = scopedPrisma(user.id);

  // Fetch positions first (needed by netWorth + dividends)
  const [txnPositions, crcdPositions] = await Promise.all([
    getPositions(db),
    getCrcdComputedPositions(db),
  ]);
  const positions = [...txnPositions, ...crcdPositions];

  // Fetch everything else in parallel
  const [pensionsRaw, streamsRaw, netWorth, dividends, baseline] =
    await Promise.all([
      db.pension.findMany({ where: { isActive: true } }),
      db.incomeStream.findMany(),
      computeNetWorth(db, positions),
      computeDividendsSummary(db, positions),
      db.scenario.findMany({ where: { isBaseline: true } }),
    ]);

  const baselineScenario = baseline[0] ?? null;

  // Serialize pensions (Decimal/BigInt → number)
  const pensions = pensionsRaw.map((p) => ({
    id: p.id,
    name: p.name,
    planType: p.planType as "DB_FORMULA" | "DB_STATEMENT" | "DC",
    isActive: p.isActive,
    startYear: p.startYear,
    baseAccrualRate: p.baseAccrualRate !== null ? Number(p.baseAccrualRate) : null,
    earlyRetirementReduction: p.earlyRetirementReduction !== null ? Number(p.earlyRetirementReduction) : null,
    normalRetirementAge: p.normalRetirementAge,
    salaryBasisCents: p.salaryBasisCents !== null ? Number(p.salaryBasisCents) : null,
    statementAnnualCents: p.statementAnnualCents !== null ? Number(p.statementAnnualCents) : null,
    statementRetirementAge: p.statementRetirementAge,
    bridgeBenefitCents: p.bridgeBenefitCents !== null ? Number(p.bridgeBenefitCents) : null,
    bridgeEndAge: p.bridgeEndAge,
    indexationRate: p.indexationRate !== null ? Number(p.indexationRate) : null,
    currentBalanceCents: p.currentBalanceCents !== null ? Number(p.currentBalanceCents) : null,
    employeeContribRate: p.employeeContribRate !== null ? Number(p.employeeContribRate) : null,
    employerContribRate: p.employerContribRate !== null ? Number(p.employerContribRate) : null,
    dcSalaryCents: p.dcSalaryCents !== null ? Number(p.dcSalaryCents) : null,
    assumedGrowthRate: p.assumedGrowthRate !== null ? Number(p.assumedGrowthRate) : null,
  }));

  // Serialize income streams
  const incomeStreams = streamsRaw.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    startAge: s.startAge,
    endAge: s.endAge,
    annualAmountCents: s.annualAmountCents !== null ? Number(s.annualAmountCents) : null,
    computedFromPensionId: s.computedFromPensionId,
    inflationIndexed: s.inflationIndexed,
    notes: s.notes,
  }));

  // Derive projection assumptions from baseline scenario or sensible defaults
  const currentYear = new Date().getFullYear();
  const currentAge = currentYear - user.birthYear;
  const yearsToRetirement = Math.max(0, user.targetRetirementAge - currentAge);

  // Compute starting yield for Projections tab
  const startingYield =
    netWorth.netWorthCents > 0
      ? dividends.annualizedCents / netWorth.netWorthCents
      : 0;

  return (
    <>
      <Header displayName={user.displayName} isAdmin={user.isAdmin} />
      <main className="mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8">
        <RetirementPageClient
          pensions={pensions}
          incomeStreams={incomeStreams}
          portfolioValueCents={netWorth.netWorthCents}
          annualDividendsCents={dividends.annualizedCents}
          salaryCents={Number(user.currentSalaryCents)}
          targetReplacement={Number(user.targetIncomeReplacement)}
          birthYear={user.birthYear}
          targetRetirementAge={user.targetRetirementAge}
          monthlyContributionCents={
            baselineScenario
              ? Number(baselineScenario.monthlyContributionCents)
              : 300000
          }
          assumedPriceGrowth={
            baselineScenario ? Number(baselineScenario.assumedPriceGrowth) : 0.02
          }
          assumedDividendGrowth={
            baselineScenario ? Number(baselineScenario.assumedDividendGrowth) : 0.01
          }
          assumedInflation={
            baselineScenario ? Number(baselineScenario.assumedInflation) : 0.025
          }
          reinvestDividends={baselineScenario?.reinvestDividends ?? true}
          startingYield={startingYield}
          yearsToRetirement={yearsToRetirement}
          locale={locale}
        />
      </main>
    </>
  );
}
