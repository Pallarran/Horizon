import { requireAuth } from "@/lib/auth/middleware";
import { scopedPrisma } from "@/lib/db/scoped";
import { Header } from "@/components/layout/Header";
import { HoldingsPageClient } from "@/components/holdings/HoldingsPageClient";
import { getPositions } from "@/lib/positions/query";
import { serializePositions } from "@/lib/positions/serialize";
import { getCrcdPositions } from "@/lib/positions/crcd";
import { getCrcdHoldingsAction } from "@/lib/actions/crcd-holdings";
import {
  serializeSecurityProfile,
  type SecurityProfileMap,
} from "@/lib/positions/security-profile";

export const dynamic = "force-dynamic";

export default async function HoldingsPage() {
  const { user } = await requireAuth();
  const db = scopedPrisma(user.id);

  const [positions, crcdPositions, accounts, fxRate, watchlistItems, crcdHoldings] = await Promise.all([
    getPositions(db),
    getCrcdPositions(db),
    db.account.findMany({
      select: { id: true, name: true, currency: true },
      orderBy: { orderIndex: "asc" },
    }),
    db.fxRate.findFirst({
      where: { fromCurrency: "USD", toCurrency: "CAD" },
      orderBy: { date: "desc" },
    }),
    db.watchlistItem.findMany({
      select: { securityId: true },
    }),
    getCrcdHoldingsAction(),
  ]);

  const usdCadRate = fxRate ? Number(fxRate.rate) : 1;

  const serializedPositions = [...serializePositions(positions), ...crcdPositions];

  // Build security profile map for the detail sheet
  const secIds = [...new Set(serializedPositions.map((p) => p.securityId))];
  const securities = secIds.length > 0
    ? await db.security.findMany({ where: { id: { in: secIds } } })
    : [];
  const securityProfiles: SecurityProfileMap = {};
  for (const s of securities) {
    securityProfiles[s.id] = serializeSecurityProfile(s);
  }

  return (
    <>
      <Header displayName={user.displayName} isAdmin={user.isAdmin} />
      <main className="mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8">
        <HoldingsPageClient
          positions={serializedPositions}
          accounts={accounts}
          securityProfiles={securityProfiles}
          locale={user.locale}
          usdCadRate={usdCadRate}
          watchedSecurityIds={watchlistItems.map((w) => w.securityId)}
          crcdHoldings={crcdHoldings}
        />
      </main>
    </>
  );
}
