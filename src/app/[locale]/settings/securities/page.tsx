import { requireAuth } from "@/lib/auth/middleware";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db/prisma";
import { SecurityManagement } from "@/components/settings/SecurityManagement";

export default async function SecuritiesSettingsPage() {
  const { user } = await requireAuth();
  const t = await getTranslations("settings");

  const [securities, userTxns] = await Promise.all([
    prisma.security.findMany({
      orderBy: { symbol: "asc" },
      include: {
        _count: { select: { transactions: true } },
      },
    }),
    prisma.transaction.findMany({
      where: { account: { userId: user.id } },
      select: { securityId: true },
      distinct: ["securityId"],
    }),
  ]);

  const mySecurityIds = new Set(
    userTxns.map((t) => t.securityId).filter(Boolean),
  );

  const serialized = securities.map((s) => ({
    id: s.id,
    symbol: s.symbol,
    exchange: s.exchange,
    name: s.name,
    currency: s.currency,
    assetClass: s.assetClass,
    sector: s.sector,
    industry: s.industry,
    isDividendAristocrat: s.isDividendAristocrat,
    isDividendKing: s.isDividendKing,
    isPaysMonthly: s.isPaysMonthly,
    dataSource: s.dataSource,
    delisted: s.delisted,
    manualPrice: s.manualPrice != null ? Number(s.manualPrice) : null,
    notes: s.notes,
    importNames: s.importNames,
    annualDividendCents: s.annualDividendCents != null ? Number(s.annualDividendCents) : null,
    dividendFrequency: s.dividendFrequency,
    dividendGrowthYears: s.dividendGrowthYears,
    manualDividendOverride: s.manualDividendOverride,
    isMine: mySecurityIds.has(s.id),
    transactionCount: s._count.transactions,
  }));

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">{t("securities")}</h2>
      <SecurityManagement securities={serialized} />
    </div>
  );
}
