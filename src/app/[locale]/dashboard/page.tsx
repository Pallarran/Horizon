import { requireAuth } from "@/lib/auth/middleware";
import { scopedPrisma } from "@/lib/db/scoped";
import { getPositions } from "@/lib/positions/query";
import { getCrcdComputedPositions } from "@/lib/positions/crcd";
import { computeNetWorth } from "@/lib/dashboard/net-worth";
import { computeDividendsSummary } from "@/lib/dashboard/dividends-summary";
import { computeDividendHistory } from "@/lib/dashboard/dividend-history";
import { computeDayMovers } from "@/lib/dashboard/day-movers";
import { computeHero } from "@/lib/dashboard/hero";
import { computeContributionRoom } from "@/lib/dashboard/contribution-room";
import { computeNetWorthMilestones, estimatePassedMilestones } from "@/lib/dashboard/net-worth-milestones";
import { computeDividendForecast } from "@/lib/dashboard/dividend-forecast";
import { computeTopYielders } from "@/lib/dashboard/top-yielders";
import { computeAllocation, computeAllocationByAssetClass } from "@/lib/dashboard/allocation";
import { getLastPriceDate } from "@/lib/dashboard/last-updated";
import { computePortfolioHistory } from "@/lib/dashboard/portfolio-history";
import { ensureSparklinePrices } from "@/lib/dashboard/ensure-sparkline-prices";
import { getIncomeStreams } from "@/lib/projections/income";
import { Header } from "@/components/layout/Header";
import { KpiStrip } from "@/components/dashboard/KpiStrip";
import { AllocationTabs } from "@/components/dashboard/AllocationChart";
import { DividendsSummaryCard } from "@/components/dashboard/DividendsSummaryCard";
import { DayMoversCard } from "@/components/dashboard/DayMoversCard";
import { ContributionRoomCard } from "@/components/dashboard/ContributionRoomCard";
import { RetirementCard } from "@/components/dashboard/ProjectionTabs";
import { MilestoneProgressCard } from "@/components/dashboard/MilestoneProgressCard";
import { TopYieldersCard } from "@/components/dashboard/TopYieldersCard";
import { PortfolioSparklineCard } from "@/components/dashboard/PortfolioSparklineCard";
import { LastUpdatedIndicator } from "@/components/dashboard/LastUpdatedIndicator";
import { AutoPriceRefresh } from "@/components/dashboard/AutoPriceRefresh";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { user } = await requireAuth();
  const locale = user.locale;
  const db = scopedPrisma(user.id);

  // Compute all dashboard data server-side (merge transaction-based + CRCD positions)
  const [txnPositions, crcdPositions] = await Promise.all([
    getPositions(db),
    getCrcdComputedPositions(db),
  ]);
  const positions = [...txnPositions, ...crcdPositions];

  // Backfill sparkline prices (must complete before portfolio history computation)
  const uniqueSecurities = [
    ...new Map(
      txnPositions.map((p) => [
        p.securityId,
        { securityId: p.securityId, symbol: p.symbol, exchange: p.exchange, currency: p.currency },
      ]),
    ).values(),
  ];

  // Fire-and-forget: backfill sparkline prices in background (don't block render)
  ensureSparklinePrices(uniqueSecurities).catch(console.error);

  // Batch 2: all independent data fetches in parallel
  const [netWorth, dividends, contributionRoom, incomeStreams, lastPriceDate, portfolioHistory] =
    await Promise.all([
      computeNetWorth(db, positions),
      computeDividendsSummary(db, positions),
      computeContributionRoom(db, user.birthYear),
      getIncomeStreams(db, user.targetRetirementAge, user.birthYear),
      getLastPriceDate(db),
      computePortfolioHistory(db),
    ]);

  // Batch 3: everything that depends on batch 2 — all in parallel
  const [dividendHistory, dividendForecast, hero, { milestones: passedMilestones, annualizedGrowthRate: irrGrowthRate }] =
    await Promise.all([
      computeDividendHistory(db, netWorth.usdCadRate),
      computeDividendForecast(db, positions, netWorth.usdCadRate, locale),
      computeHero(db, user, dividends.annualizedCents, netWorth.netWorthCents, incomeStreams),
      estimatePassedMilestones(db, netWorth.netWorthCents, portfolioHistory),
    ]);

  const dayMovers = computeDayMovers(positions, 1);
  const topYielders = computeTopYielders(positions);
  const allocationByAccount = computeAllocation(positions, netWorth.usdCadRate);
  const allocationByAssetClass = computeAllocationByAssetClass(positions, netWorth.usdCadRate);

  const milestoneProgress = computeNetWorthMilestones(
    netWorth.netWorthCents,
    portfolioHistory,
    passedMilestones,
    irrGrowthRate,
  );

  const lastPriceDateStr = lastPriceDate?.toISOString() ?? null;

  return (
    <>
      <Header displayName={user.displayName} isAdmin={user.isAdmin} />
      <main className="mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8">
        {/* KPI Strip */}
        <div className="mb-4">
          <KpiStrip
            locale={locale}
            netWorth={netWorth}
            milestoneProgress={milestoneProgress}
          />
        </div>

        {/* Main content — 3 themed columns */}
        <div className="mb-4 grid gap-4 lg:grid-cols-3">
          {/* Col 1: Portfolio Portrait */}
          <div className="space-y-4">
            <PortfolioSparklineCard locale={locale} history={portfolioHistory} />
            <DayMoversCard locale={locale} movers={dayMovers} />
            <AllocationTabs
              accountData={allocationByAccount.slices}
              accountTotalCents={allocationByAccount.totalCents}
              assetClassData={allocationByAssetClass.slices}
              assetClassTotalCents={allocationByAssetClass.totalCents}
              locale={locale}
            />
          </div>

          {/* Col 2: Income & Contributions */}
          <div className="space-y-4">
            <ContributionRoomCard locale={locale} room={contributionRoom} />
            <DividendsSummaryCard
              locale={locale}
              dividends={dividends}
              forecast={dividendForecast}
              history={dividendHistory}
            />
          </div>

          {/* Col 3: Freedom & Growth */}
          <div className="space-y-4">
            <RetirementCard locale={locale} hero={hero} />
            <MilestoneProgressCard locale={locale} data={milestoneProgress} />
            <TopYieldersCard locale={locale} yielders={topYielders} />
          </div>
        </div>

        {/* Footer */}
        <LastUpdatedIndicator
          lastPriceDate={lastPriceDateStr}
          locale={locale}
        />
        <AutoPriceRefresh lastPriceDate={lastPriceDateStr} />
      </main>
    </>
  );
}
