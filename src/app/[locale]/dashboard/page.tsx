import { requireAuth } from "@/lib/auth/middleware";
import { scopedPrisma } from "@/lib/db/scoped";
import { getPositions } from "@/lib/positions/query";
import { getCrcdComputedPositions } from "@/lib/positions/crcd";
import { computeNetWorth } from "@/lib/dashboard/net-worth";
import { computeDividendsSummary } from "@/lib/dashboard/dividends-summary";
import { computeDayMovers } from "@/lib/dashboard/day-movers";
import { computeHero } from "@/lib/dashboard/hero";
import { computeContributionRoom } from "@/lib/dashboard/contribution-room";
import { computeNetWorthMilestones, estimatePassedMilestones } from "@/lib/dashboard/net-worth-milestones";
import { computeDividendForecast } from "@/lib/dashboard/dividend-forecast";
import { computeDividendHistory } from "@/lib/dashboard/dividend-history";
import { computeTopYielders } from "@/lib/dashboard/top-yielders";
import { computeAllocation, computeAllocationByAssetClass } from "@/lib/dashboard/allocation";
import { getLastPriceDate } from "@/lib/dashboard/last-updated";
import { computePortfolioHistory } from "@/lib/dashboard/portfolio-history";
import { ensureSparklinePrices } from "@/lib/dashboard/ensure-sparkline-prices";
import { getIncomeStreams } from "@/lib/projections/income";
import { Header } from "@/components/layout/Header";
import { WealthHeroCard } from "@/components/dashboard/WealthHeroCard";
import { FreedomHeroCard } from "@/components/dashboard/FreedomHeroCard";
import { MilestoneBandCard } from "@/components/dashboard/MilestoneBandCard";
import { DividendIncomeCard } from "@/components/dashboard/DividendIncomeCard";
import { AllocationToggleCard } from "@/components/dashboard/AllocationToggleCard";
import { DayMoversStrip } from "@/components/dashboard/DayMoversStrip";
import { TopYieldersCard } from "@/components/dashboard/TopYieldersCard";
import { ContributionRoomCard } from "@/components/dashboard/ContributionRoomCard";
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

  // Cash totals — mirror portfolio/page.tsx logic so dashboard net worth
  // matches AccountsTab sum (positions + cash with CRCD adjustment).
  const allTxns = await db.transaction.findMany({
    select: { amountCents: true, currency: true },
  });
  let cashCadCents = 0;
  let cashUsdCents = 0;
  for (const txn of allTxns) {
    if (txn.currency === "USD") cashUsdCents += Number(txn.amountCents);
    else cashCadCents += Number(txn.amountCents);
  }
  // CRCD purchases aren't transactions — subtract holding cost from CAD cash
  for (const pos of crcdPositions) {
    cashCadCents -= Number(pos.totalCostCents);
  }

  // Batch 2: all independent data fetches in parallel
  const [netWorth, dividends, contributionRoom, incomeStreams, lastPriceDate, portfolioHistory] =
    await Promise.all([
      computeNetWorth(db, positions, cashCadCents, cashUsdCents),
      computeDividendsSummary(db, positions),
      computeContributionRoom(db, user.birthYear),
      getIncomeStreams(db, user.targetRetirementAge, user.birthYear),
      getLastPriceDate(db),
      computePortfolioHistory(db),
    ]);

  // Batch 3: everything that depends on batch 2 — all in parallel
  const [dividendForecast, dividendHistory, hero, { milestones: passedMilestones, annualizedGrowthRate: irrGrowthRate }] =
    await Promise.all([
      computeDividendForecast(db, positions, netWorth.usdCadRate, locale),
      computeDividendHistory(db, netWorth.usdCadRate),
      computeHero(db, user, dividends.annualizedCents, netWorth.netWorthCents, incomeStreams),
      estimatePassedMilestones(db, netWorth.netWorthCents, portfolioHistory),
    ]);

  const dayMovers = computeDayMovers(positions, 1);
  const topYielders = computeTopYielders(positions, netWorth.usdCadRate);
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
      <main className="mx-auto flex max-w-[1600px] flex-col gap-3.5 p-3.5 md:p-[22px] lg:px-8 lg:py-6">
        {/* Hero band — the two questions that matter: wealth & freedom */}
        <div className="grid gap-3.5 lg:grid-cols-[1.5fr_1fr]">
          <WealthHeroCard locale={locale} netWorth={netWorth} history={portfolioHistory} />
          <FreedomHeroCard locale={locale} hero={hero} tier={milestoneProgress.tier} />
        </div>

        {/* Milestone band — full-width motivational moment */}
        <MilestoneBandCard locale={locale} data={milestoneProgress} />

        {/* Detail row */}
        <div className="grid gap-3.5 lg:grid-cols-[1.15fr_1fr_1fr]">
          <DividendIncomeCard
            locale={locale}
            dividends={dividends}
            forecast={dividendForecast}
            history={dividendHistory}
          />
          <ContributionRoomCard locale={locale} room={contributionRoom} />
          <div className="flex flex-col gap-3.5">
            <AllocationToggleCard
              accountData={allocationByAccount.slices}
              accountTotalCents={allocationByAccount.totalCents}
              assetClassData={allocationByAssetClass.slices}
              assetClassTotalCents={allocationByAssetClass.totalCents}
              locale={locale}
            />
            <DayMoversStrip locale={locale} movers={dayMovers} />
            <TopYieldersCard locale={locale} yielders={topYielders} />
          </div>
        </div>

        {/* Footer */}
        <LastUpdatedIndicator
          lastPriceDate={lastPriceDateStr}
          usdCadRate={netWorth.usdCadRate}
          locale={locale}
        />
        <AutoPriceRefresh lastPriceDate={lastPriceDateStr} />
      </main>
    </>
  );
}
