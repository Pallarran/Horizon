import { requireAuth } from "@/lib/auth/middleware";
import { scopedPrisma } from "@/lib/db/scoped";
import { Header } from "@/components/layout/Header";
import { AccountsTab } from "@/components/holdings/AccountsTab";
import { getPositions } from "@/lib/positions/query";
import { serializePositions } from "@/lib/positions/serialize";
import { getCrcdPositions } from "@/lib/positions/crcd";
import { computeAccountHistories } from "@/lib/dashboard/account-history";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const { user } = await requireAuth();
  const db = scopedPrisma(user.id);

  const [positions, crcdPositions, accounts, accountHistories, allTxns] = await Promise.all([
    getPositions(db),
    getCrcdPositions(db),
    db.account.findMany({ orderBy: { orderIndex: "asc" } }),
    computeAccountHistories(db),
    db.transaction.findMany({
      select: { accountId: true, amountCents: true },
    }),
  ]);

  const serializedPositions = [...serializePositions(positions), ...crcdPositions];
  const cashBalances: Record<string, number> = {};
  for (const txn of allTxns) {
    cashBalances[txn.accountId] = (cashBalances[txn.accountId] ?? 0) + Number(txn.amountCents);
  }
  // CRCD purchases aren't transactions — subtract holding cost from cash
  for (const pos of crcdPositions) {
    cashBalances[pos.accountId] = (cashBalances[pos.accountId] ?? 0) - pos.totalCostCents;
  }
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
      <main className="mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8">
        <AccountsTab
          accounts={serializedAccounts}
          positions={serializedPositions}
          accountHistories={accountHistories}
          cashBalances={cashBalances}
          locale={user.locale}
        />
      </main>
    </>
  );
}
