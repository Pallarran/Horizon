import { requireAuth } from "@/lib/auth/middleware";
import { scopedPrisma } from "@/lib/db/scoped";
import { prisma } from "@/lib/db/prisma";
import { Header } from "@/components/layout/Header";
import { WatchlistPageClient } from "@/components/watchlist/WatchlistPageClient";
import { getWatchlistAction } from "@/lib/actions/watchlist";
import {
  serializeSecurityProfile,
  type SecurityProfileMap,
} from "@/lib/positions/security-profile";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const { user } = await requireAuth();
  const db = scopedPrisma(user.id);

  const [items, fxRate] = await Promise.all([
    getWatchlistAction(),
    db.fxRate.findFirst({
      where: { fromCurrency: "USD", toCurrency: "CAD" },
      orderBy: { date: "desc" },
    }),
  ]);

  // Fetch latest 2 prices per watched security for current price + day change
  const secIds = [...new Set(items.map((i) => i.securityId))];
  const prices =
    secIds.length > 0
      ? await db.price.findMany({
          where: { securityId: { in: secIds } },
          orderBy: { date: "desc" },
          take: secIds.length * 2,
        })
      : [];

  // Build price map: securityId → { currentPriceCents, previousPriceCents }
  const priceMap: Record<
    string,
    { currentPriceCents: number; previousPriceCents: number | null }
  > = {};
  for (const secId of secIds) {
    const secPrices = prices
      .filter((p) => p.securityId === secId)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    priceMap[secId] = {
      currentPriceCents: secPrices[0] ? Number(secPrices[0].priceCents) : 0,
      previousPriceCents: secPrices[1] ? Number(secPrices[1].priceCents) : null,
    };
  }

  // Build security profile map for detail sheet
  const securityProfiles: SecurityProfileMap = {};
  if (secIds.length > 0) {
    const securities = await prisma.security.findMany({
      where: { id: { in: secIds } },
    });
    for (const sec of securities) {
      securityProfiles[sec.id] = serializeSecurityProfile(sec);
    }
  }

  return (
    <>
      <Header displayName={user.displayName} isAdmin={user.isAdmin} />
      <main className="mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8">
        <WatchlistPageClient
          items={items}
          priceMap={priceMap}
          securityProfiles={securityProfiles}
          locale={user.locale}
          usdCadRate={fxRate ? Number(fxRate.rate) : 1}
        />
      </main>
    </>
  );
}
