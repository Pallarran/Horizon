import { requireAuth } from "@/lib/auth/middleware";
import { scopedPrisma } from "@/lib/db/scoped";
import { Header } from "@/components/layout/Header";
import { HoldingsPageClient } from "@/components/holdings/HoldingsPageClient";
import { getPositions } from "@/lib/positions/query";
import { serializePositions } from "@/lib/positions/serialize";
import {
  serializeSecurityProfile,
  type SecurityProfileMap,
} from "@/lib/positions/security-profile";

export const dynamic = "force-dynamic";

export default async function HoldingsPage() {
  const { user } = await requireAuth();
  const db = scopedPrisma(user.id);

  const [positions, accounts] = await Promise.all([
    getPositions(db),
    db.account.findMany({
      select: { id: true, name: true, currency: true },
      orderBy: { orderIndex: "asc" },
    }),
  ]);

  const serializedPositions = serializePositions(positions);

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
      <main className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">
        <HoldingsPageClient
          positions={serializedPositions}
          accounts={accounts}
          securityProfiles={securityProfiles}
          locale={user.locale}
        />
      </main>
    </>
  );
}
