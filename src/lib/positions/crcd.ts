/**
 * Build SerializedPosition[] from CRCDHolding records.
 *
 * CRCD positions are standalone — they don't come from transactions.
 * Each account's holdings are aggregated into a single position.
 */
import type { ScopedPrisma } from "@/lib/db/scoped";
import { prisma } from "@/lib/db/prisma";
import type { SerializedPosition } from "./serialize";

/**
 * Fetch CRCDHolding records and build positions for the Holdings page.
 * Groups holdings by accountId into one position per CRCD account.
 */
export async function getCrcdPositions(
  db: ScopedPrisma,
): Promise<SerializedPosition[]> {
  const holdings = await db.crcdHolding.findMany();
  if (holdings.length === 0) return [];

  // Find the CRCD security for current price
  const crcdSecurity = await prisma.security.findUnique({
    where: { symbol_exchange: { symbol: "CRCD", exchange: "DESJARDINS" } },
  });

  // Get current price from latest Price record, or fallback to manualPrice
  let currentPriceCents: number | null = null;
  if (crcdSecurity) {
    const latestPrice = await prisma.price.findFirst({
      where: { securityId: crcdSecurity.id },
      orderBy: { date: "desc" },
    });
    if (latestPrice) {
      currentPriceCents = Number(latestPrice.priceCents);
    } else if (crcdSecurity.manualPrice !== null) {
      currentPriceCents = Math.round(Number(crcdSecurity.manualPrice) * 100);
    }
  }

  // Get account info
  const accountIds = [...new Set(holdings.map((h) => h.accountId))];
  const accounts = await prisma.account.findMany({
    where: { id: { in: accountIds } },
  });
  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  // Group holdings by account
  const byAccount = new Map<string, typeof holdings>();
  for (const h of holdings) {
    const arr = byAccount.get(h.accountId) ?? [];
    arr.push(h);
    byAccount.set(h.accountId, arr);
  }

  const positions: SerializedPosition[] = [];

  for (const [accountId, accountHoldings] of byAccount) {
    const account = accountMap.get(accountId);
    if (!account) continue;

    // Aggregate: sum quantities, compute weighted average cost
    let totalQty = 0;
    let totalCostCents = 0;

    for (const h of accountHoldings) {
      const qty = Number(h.quantity);
      const cost = qty * Number(h.averagePriceCents);
      totalQty += qty;
      totalCostCents += Math.round(cost);
    }

    const avgCostCents = totalQty > 0 ? Math.round(totalCostCents / totalQty) : 0;
    const marketValueCents = currentPriceCents !== null
      ? Math.round(totalQty * currentPriceCents)
      : null;
    const unrealizedGainCents = marketValueCents !== null
      ? marketValueCents - totalCostCents
      : null;
    const unrealizedGainPercent = unrealizedGainCents !== null && totalCostCents > 0
      ? unrealizedGainCents / totalCostCents
      : null;

    positions.push({
      securityId: crcdSecurity?.id ?? "",
      accountId,
      symbol: "CRCD",
      name: "Capital régional et coopératif Desjardins",
      exchange: "DESJARDINS",
      currency: "CAD",
      assetClass: "CRCD_SHARE",
      sector: null,
      industry: null,
      accountName: account.name,
      accountType: account.type,
      quantity: totalQty,
      totalCostCents,
      avgCostCents,
      currentPriceCents,
      marketValueCents,
      dayChangeCents: null,
      dayChangePercent: null,
      unrealizedGainCents,
      unrealizedGainPercent,
      annualDividendPerShareCents: null,
      expectedIncomeCents: null,
      yieldPercent: null,
      yieldOnCostPercent: null,
      totalDividendsReceivedCents: 0,
      dividendGrowthYears: null,
      isDividendAristocrat: false,
      isDividendKing: false,
      isPaysMonthly: false,
      dividendFrequency: null,
    });
  }

  return positions;
}
