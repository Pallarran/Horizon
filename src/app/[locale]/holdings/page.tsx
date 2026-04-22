import { requireAuth } from "@/lib/auth/middleware";
import { scopedPrisma } from "@/lib/db/scoped";
import { Header } from "@/components/layout/Header";
import { HoldingsPageClient } from "@/components/holdings/HoldingsPageClient";
import { getPositions } from "@/lib/positions/query";
import { serializePositions } from "@/lib/positions/serialize";
import { getTransactions } from "@/lib/actions/transactions";

export const dynamic = "force-dynamic";

export default async function HoldingsPage() {
  const { user } = await requireAuth();
  const db = scopedPrisma(user.id);

  const [positions, accounts, transactions] = await Promise.all([
    getPositions(db),
    db.account.findMany({ orderBy: { orderIndex: "asc" } }),
    getTransactions(db),
  ]);

  const serializedPositions = serializePositions(positions);
  const serializedAccounts = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    currency: a.currency,
    externalId: a.externalId,
  }));

  return (
    <>
      <Header displayName={user.displayName} isAdmin={user.isAdmin} />
      <main className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">
        <HoldingsPageClient
          positions={serializedPositions}
          accounts={serializedAccounts}
          transactions={transactions}
          locale={user.locale}
        />
      </main>
    </>
  );
}
