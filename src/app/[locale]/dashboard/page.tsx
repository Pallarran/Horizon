import { requireAuth } from "@/lib/auth/middleware";
import { scopedPrisma } from "@/lib/db/scoped";
import { getPositions } from "@/lib/positions/query";
import { computeNetWorth } from "@/lib/dashboard/net-worth";
import { computeDividendsSummary } from "@/lib/dashboard/dividends-summary";
import { computeDividendHistory } from "@/lib/dashboard/dividend-history";
import { computeDayMovers } from "@/lib/dashboard/day-movers";
import { computeHero } from "@/lib/dashboard/hero";
import { computeContributionRoom } from "@/lib/dashboard/contribution-room";
import { computeMilestones } from "@/lib/dashboard/milestones";
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
import { RetirementCard, MilestonesCard } from "@/components/dashboard/ProjectionTabs";
import { PortfolioSparklineCard } from "@/components/dashboard/PortfolioSparklineCard";
import { LastUpdatedIndicator } from "@/components/dashboard/LastUpdatedIndicator";
import { AutoPriceRefresh } from "@/components/dashboard/AutoPriceRefresh";
import { FetchPricesButton } from "@/components/dashboard/FetchPricesButton";
import { BackfillProfilesButton } from "@/components/dashboard/BackfillProfilesButton";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { user } = await requireAuth();
  const locale = user.locale;
  const db = scopedPrisma(user.id);

  // Compute all dashboard data server-side
  const positions = await getPositions(db);

  // Ensure 1 year of historical prices exist for sparkline (one-time backfill)
  const uniqueSecurities = [
    ...new Map(
      positions.map((p) => [
        p.securityId,
        { securityId: p.securityId, symbol: p.symbol, exchange: p.exchange, currency: p.currency },
      ]),
    ).values(),
  ];
  await ensureSparklinePrices(uniqueSecurities);

  const [netWorth, dividends, contributionRoom, incomeStreams, lastPriceDate, portfolioHistory] =
    await Promise.all([
      computeNetWorth(db, positions),
      computeDividendsSummary(db, positions),
      computeContributionRoom(db, user.birthYear),
      getIncomeStreams(db, user.targetRetirementAge, user.birthYear),
      getLastPriceDate(db),
      computePortfolioHistory(db),
    ]);

  const [dividendHistory] = await Promise.all([
    computeDividendHistory(db, netWorth.usdCadRate),
  ]);

  const dayMovers = computeDayMovers(positions, 1);
  const allocationByAccount = computeAllocation(positions, netWorth.usdCadRate);
  const allocationByAssetClass = computeAllocationByAssetClass(positions, netWorth.usdCadRate);

  const hero = await computeHero(
    db,
    user,
    dividends.annualizedCents,
    netWorth.netWorthCents,
    incomeStreams,
  );

  const currentYear = new Date().getFullYear();
  const currentAge = currentYear - user.birthYear;
  const milestoneData = computeMilestones(
    currentAge,
    user.targetRetirementAge,
    netWorth.netWorthCents,
    dividends.annualizedCents,
  );

  const lastPriceDateStr = lastPriceDate?.toISOString() ?? null;

  return (
    <>
      <Header displayName={user.displayName} isAdmin={user.isAdmin} />
      <main className="mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8">
        {/* KPI Strip */}
        <div className="mb-6">
          <KpiStrip
            locale={locale}
            netWorth={netWorth}
            hero={hero}
          />
        </div>

        {/* Main content — 3 themed columns */}
        <div className="mb-6 grid gap-6 lg:grid-cols-3">
          {/* Col 1: Portfolio Portrait */}
          <div className="space-y-6">
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

          {/* Col 2: Contributions & Income */}
          <div className="space-y-6">
            <ContributionRoomCard locale={locale} room={contributionRoom} />
            <DividendsSummaryCard
              locale={locale}
              dividends={dividends}
              history={dividendHistory}
            />
          </div>

          {/* Col 3: Retirement & Projections */}
          <div className="space-y-6">
            <RetirementCard locale={locale} hero={hero} />
            <MilestonesCard locale={locale} milestones={milestoneData.milestones} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <LastUpdatedIndicator
            lastPriceDate={lastPriceDateStr}
            locale={locale}
          />
          <AutoPriceRefresh lastPriceDate={lastPriceDateStr} />
          {user.isAdmin && (
            <div className="flex gap-3">
              <FetchPricesButton />
              <BackfillProfilesButton />
            </div>
          )}
        </div>
      </main>
    </>
  );
}
