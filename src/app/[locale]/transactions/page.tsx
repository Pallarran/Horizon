import { requireAuth } from "@/lib/auth/middleware";
import { scopedPrisma } from "@/lib/db/scoped";
import { Header } from "@/components/layout/Header";
import { ActivitiesTab } from "@/components/holdings/ActivitiesTab";
import { getTransactions } from "@/lib/actions/transactions";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const { user } = await requireAuth();
  const db = scopedPrisma(user.id);

  const [transactions, accounts] = await Promise.all([
    getTransactions(db),
    db.account.findMany({
      select: { id: true, name: true, currency: true },
      orderBy: { orderIndex: "asc" },
    }),
  ]);

  return (
    <>
      <Header displayName={user.displayName} isAdmin={user.isAdmin} />
      <main className="mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8">
        <ActivitiesTab
          transactions={transactions}
          accounts={accounts}
          locale={user.locale}
        />
      </main>
    </>
  );
}
