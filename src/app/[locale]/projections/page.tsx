import { requireAuth } from "@/lib/auth/middleware";
import { scopedPrisma } from "@/lib/db/scoped";
import { getPositions } from "@/lib/positions/query";
import { computeNetWorth } from "@/lib/dashboard/net-worth";
import { computeDividendsSummary } from "@/lib/dashboard/dividends-summary";
import { Header } from "@/components/layout/Header";
import { ProjectionsPageClient } from "@/components/projections/ProjectionsPageClient";

export const dynamic = "force-dynamic";

export default async function ProjectionsPage() {
  const { user } = await requireAuth();
  const db = scopedPrisma(user.id);

  const positions = await getPositions(db);
  const [netWorth, dividends] = await Promise.all([
    computeNetWorth(db, positions),
    computeDividendsSummary(db, positions),
  ]);

  const portfolioValueCents = netWorth.netWorthCents;
  const annualDividendsCents = dividends.annualizedCents;

  // Weighted average yield
  const startingYield =
    portfolioValueCents > 0
      ? annualDividendsCents / portfolioValueCents
      : 0.035;

  const currentYear = new Date().getFullYear();
  const currentAge = currentYear - user.birthYear;
  const yearsToRetirement = Math.max(1, user.targetRetirementAge - currentAge);

  return (
    <>
      <Header displayName={user.displayName} isAdmin={user.isAdmin} />
      <main className="mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8">
        <ProjectionsPageClient
          portfolioValueCents={portfolioValueCents}
          startingYield={startingYield}
          yearsToRetirement={yearsToRetirement}
          locale={user.locale}
        />
      </main>
    </>
  );
}
