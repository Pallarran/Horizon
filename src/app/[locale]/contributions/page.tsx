import { requireAuth } from "@/lib/auth/middleware";
import { scopedPrisma } from "@/lib/db/scoped";
import { computeContributionTable } from "@/lib/contributions/compute";
import { Header } from "@/components/layout/Header";
import { ContributionsPageClient } from "@/components/contributions/ContributionsPageClient";

export const dynamic = "force-dynamic";

export default async function ContributionsPage() {
  const { user } = await requireAuth();
  const locale = user.locale;
  const db = scopedPrisma(user.id);

  const [rows, crcdHoldings] = await Promise.all([
    computeContributionTable(db, user.birthYear),
    db.crcdHolding.findMany({ where: {} }),
  ]);

  return (
    <>
      <Header displayName={user.displayName} isAdmin={user.isAdmin} />
      <main className="mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8">
        <ContributionsPageClient
          initialRows={rows}
          locale={locale}
          hasCrcdHoldings={crcdHoldings.length > 0}
        />
      </main>
    </>
  );
}
