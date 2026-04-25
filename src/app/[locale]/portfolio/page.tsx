import { requireAuth } from "@/lib/auth/middleware";
import { scopedPrisma } from "@/lib/db/scoped";
import { Header } from "@/components/layout/Header";
import { PortfolioPageClient } from "@/components/portfolio/PortfolioPageClient";
import { getPositions } from "@/lib/positions/query";
import { serializePositions } from "@/lib/positions/serialize";
import { getCrcdPositions } from "@/lib/positions/crcd";
import { getCrcdHoldingsAction } from "@/lib/actions/crcd-holdings";
import {
  serializeSecurityProfile,
  type SecurityProfileMap,
} from "@/lib/positions/security-profile";
import { computeAccountHistories } from "@/lib/dashboard/account-history";
import { computeContributionTable } from "@/lib/contributions/compute";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const { user } = await requireAuth();
  const db = scopedPrisma(user.id);

  // Fetch all data needed by Accounts, Holdings, and Contributions tabs in parallel
  const [positions, crcdPositions, accounts, fxRate, watchlistItems, crcdHoldings, accountHistories, allTxns, contributionRows, crcdHoldingsRaw] =
    await Promise.all([
      getPositions(db),
      getCrcdPositions(db),
      db.account.findMany({ orderBy: { orderIndex: "asc" } }),
      db.fxRate.findFirst({
        where: { fromCurrency: "USD", toCurrency: "CAD" },
        orderBy: { date: "desc" },
      }),
      db.watchlistItem.findMany({ select: { securityId: true } }),
      getCrcdHoldingsAction(),
      computeAccountHistories(db),
      db.transaction.findMany({
        select: { accountId: true, amountCents: true },
      }),
      computeContributionTable(db, user.birthYear),
      db.crcdHolding.findMany({ where: {} }),
    ]);

  const usdCadRate = fxRate ? Number(fxRate.rate) : 1;
  const serializedPositions = [...serializePositions(positions), ...crcdPositions];

  // Build security profile map for the position detail sheet
  const secIds = [...new Set(serializedPositions.map((p) => p.securityId))];
  const securities =
    secIds.length > 0
      ? await db.security.findMany({ where: { id: { in: secIds } } })
      : [];
  const securityProfiles: SecurityProfileMap = {};
  for (const s of securities) {
    securityProfiles[s.id] = serializeSecurityProfile(s);
  }

  // Compute cash balances for Accounts tab
  const cashBalances: Record<string, number> = {};
  for (const txn of allTxns) {
    cashBalances[txn.accountId] = (cashBalances[txn.accountId] ?? 0) + Number(txn.amountCents);
  }
  // CRCD purchases aren't transactions — subtract holding cost from cash
  for (const pos of crcdPositions) {
    cashBalances[pos.accountId] = (cashBalances[pos.accountId] ?? 0) - pos.totalCostCents;
  }

  // Serialize accounts: subset for Holdings tab, full for Accounts tab
  const accountsForHoldings = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    currency: a.currency,
  }));
  const accountsForAccounts = accounts.map((a) => ({
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
        <PortfolioPageClient
          positions={serializedPositions}
          accountsForHoldings={accountsForHoldings}
          securityProfiles={securityProfiles}
          usdCadRate={usdCadRate}
          watchedSecurityIds={watchlistItems.map((w) => w.securityId)}
          crcdHoldings={crcdHoldings}
          accountsForAccounts={accountsForAccounts}
          accountHistories={accountHistories}
          cashBalances={cashBalances}
          contributionRows={contributionRows}
          hasCrcdHoldings={crcdHoldingsRaw.length > 0}
          locale={user.locale}
        />
      </main>
    </>
  );
}
