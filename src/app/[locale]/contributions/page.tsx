import { requireAuth } from "@/lib/auth/middleware";
import { scopedPrisma } from "@/lib/db/scoped";
import { computeContributionTable } from "@/lib/contributions/compute";
import { Header } from "@/components/layout/Header";
import { ContributionTable } from "@/components/contributions/ContributionTable";
import { CurrentYearSummary } from "@/components/contributions/CurrentYearSummary";

export const dynamic = "force-dynamic";

export default async function ContributionsPage() {
  const { user } = await requireAuth();
  const locale = user.locale;
  const db = scopedPrisma(user.id);

  const rows = await computeContributionTable(db, user.birthYear);
  const currentYear = new Date().getFullYear();
  const currentYearRow = rows.find((r) => r.year === currentYear);

  return (
    <>
      <Header displayName={user.displayName} isAdmin={user.isAdmin} />
      <main className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">
        {currentYearRow && (
          <div className="mb-6">
            <CurrentYearSummary row={currentYearRow} locale={locale} />
          </div>
        )}

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <ContributionTable rows={rows} locale={locale} />
        </div>
      </main>
    </>
  );
}
