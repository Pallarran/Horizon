import { requireAuth } from "@/lib/auth/middleware";
import { scopedPrisma } from "@/lib/db/scoped";
import { getPositions } from "@/lib/positions/query";
import { computeNetWorth } from "@/lib/dashboard/net-worth";
import { computeDividendsSummary } from "@/lib/dashboard/dividends-summary";
import { computeDayMovers } from "@/lib/dashboard/day-movers";
import { computeHero } from "@/lib/dashboard/hero";
import { computeContributionRoom } from "@/lib/dashboard/contribution-room";
import { computeMilestones } from "@/lib/dashboard/milestones";
import { computeIncomeComposition } from "@/lib/dashboard/income-composition";
import { getIncomeStreams } from "@/lib/projections/income";
import { Header } from "@/components/layout/Header";
import { HeroCard } from "@/components/dashboard/HeroCard";
import { DividendsSummaryCard } from "@/components/dashboard/DividendsSummaryCard";
import { DayMoversCard } from "@/components/dashboard/DayMoversCard";
import { ContributionRoomCard } from "@/components/dashboard/ContributionRoomCard";
import { IncomeCompositionChart } from "@/components/dashboard/IncomeCompositionChart";
import { MilestoneTable } from "@/components/dashboard/MilestoneTable";
import { FetchPricesButton } from "@/components/dashboard/FetchPricesButton";
import { BackfillProfilesButton } from "@/components/dashboard/BackfillProfilesButton";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { user } = await requireAuth();
  const locale = user.locale;
  const db = scopedPrisma(user.id);

  // Compute all dashboard data server-side
  const positions = await getPositions(db);

  const [netWorth, dividends, contributionRoom, incomeStreams] = await Promise.all([
    computeNetWorth(db, positions),
    computeDividendsSummary(db, positions),
    computeContributionRoom(db, user.birthYear),
    getIncomeStreams(db, user.targetRetirementAge),
  ]);

  const dayMovers = computeDayMovers(positions);
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

  const incomeComposition = computeIncomeComposition(
    currentAge,
    dividends.annualizedCents / 100,
    incomeStreams,
  );

  return (
    <>
      <Header displayName={user.displayName} isAdmin={user.isAdmin} />
      <main className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">
        {/* Row 1: Hero (full width) */}
        <div className="mb-6">
          <HeroCard locale={locale} hero={hero} netWorth={netWorth} />
        </div>

        {/* Row 2: Charts + Dividends */}
        <div className="mb-6 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <IncomeCompositionChart data={incomeComposition} />
            <MilestoneTable locale={locale} milestones={milestoneData.milestones} />
          </div>
          <div className="space-y-6">
            <DividendsSummaryCard locale={locale} dividends={dividends} />
            <ContributionRoomCard locale={locale} room={contributionRoom} />
          </div>
        </div>

        {/* Row 3: Day movers */}
        <div className="mb-6">
          <DayMoversCard locale={locale} movers={dayMovers} />
        </div>

        {user.isAdmin && (
          <div className="flex flex-wrap gap-3">
            <FetchPricesButton />
            <BackfillProfilesButton />
          </div>
        )}
      </main>
    </>
  );
}
