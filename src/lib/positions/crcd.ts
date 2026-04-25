/**
 * Build positions from CRCDHolding records.
 *
 * CRCD positions are standalone — they don't come from transactions.
 * Each account's holdings are aggregated into a single position.
 */
import type { ScopedPrisma } from "@/lib/db/scoped";
import { prisma } from "@/lib/db/prisma";
import type { ComputedPosition } from "./types";
import type { SerializedPosition } from "./serialize";

/** Shared data fetched once for both serialized and computed variants. */
async function fetchCrcdData(db: ScopedPrisma) {
  const holdings = await db.crcdHolding.findMany();
  if (holdings.length === 0) return null;

  const crcdSecurity = await prisma.security.findUnique({
    where: { symbol_exchange: { symbol: "CRCD", exchange: "DESJARDINS" } },
  });

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

  const accountIds = [...new Set(holdings.map((h) => h.accountId))];
  const accounts = await prisma.account.findMany({
    where: { id: { in: accountIds } },
  });
  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  const byAccount = new Map<string, typeof holdings>();
  for (const h of holdings) {
    const arr = byAccount.get(h.accountId) ?? [];
    arr.push(h);
    byAccount.set(h.accountId, arr);
  }

  return { crcdSecurity, currentPriceCents, accountMap, byAccount };
}

/** Aggregate holdings for one account. */
function aggregateAccount(accountHoldings: { quantity: unknown; averagePriceCents: unknown }[]) {
  let totalQty = 0;
  let totalCostCents = 0;
  for (const h of accountHoldings) {
    const qty = Number(h.quantity);
    totalQty += qty;
    totalCostCents += Math.round(qty * Number(h.averagePriceCents));
  }
  const avgCostCents = totalQty > 0 ? Math.round(totalCostCents / totalQty) : 0;
  return { totalQty, totalCostCents, avgCostCents };
}

/**
 * Return CRCD positions as ComputedPosition[] (bigint fields).
 * Used by dashboard computations (net worth, allocation, etc.).
 */
export async function getCrcdComputedPositions(
  db: ScopedPrisma,
): Promise<ComputedPosition[]> {
  const data = await fetchCrcdData(db);
  if (!data) return [];

  const { crcdSecurity, currentPriceCents, accountMap, byAccount } = data;
  const positions: ComputedPosition[] = [];

  for (const [accountId, accountHoldings] of byAccount) {
    const account = accountMap.get(accountId);
    if (!account) continue;

    const { totalQty, totalCostCents, avgCostCents } = aggregateAccount(accountHoldings);
    const mvCents = currentPriceCents !== null ? Math.round(totalQty * currentPriceCents) : null;
    const gain = mvCents !== null ? mvCents - totalCostCents : null;

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
      totalCostCents: BigInt(totalCostCents),
      avgCostCents: BigInt(avgCostCents),
      totalCostCadCents: BigInt(totalCostCents),
      avgCostCadCents: BigInt(avgCostCents),
      currentPriceCents: currentPriceCents !== null ? BigInt(currentPriceCents) : null,
      marketValueCents: mvCents !== null ? BigInt(mvCents) : null,
      dayChangeCents: null,
      dayChangePercent: null,
      unrealizedGainCents: gain !== null ? BigInt(gain) : null,
      unrealizedGainPercent: gain !== null && totalCostCents > 0 ? gain / totalCostCents : null,
      annualDividendPerShareCents: null,
      expectedIncomeCents: null,
      yieldPercent: null,
      yieldOnCostPercent: null,
      totalDividendsReceivedCents: 0n,
      dividendGrowthYears: null,
      isDividendAristocrat: false,
      isDividendKing: false,
      isPaysMonthly: false,
      dividendFrequency: null,
    });
  }

  return positions;
}

/**
 * Return CRCD positions as SerializedPosition[] (number fields).
 * Used by the Holdings page client component.
 */
export async function getCrcdPositions(
  db: ScopedPrisma,
): Promise<SerializedPosition[]> {
  const data = await fetchCrcdData(db);
  if (!data) return [];

  const { crcdSecurity, currentPriceCents, accountMap, byAccount } = data;
  const positions: SerializedPosition[] = [];

  for (const [accountId, accountHoldings] of byAccount) {
    const account = accountMap.get(accountId);
    if (!account) continue;

    const { totalQty, totalCostCents, avgCostCents } = aggregateAccount(accountHoldings);
    const mvCents = currentPriceCents !== null ? Math.round(totalQty * currentPriceCents) : null;
    const gain = mvCents !== null ? mvCents - totalCostCents : null;

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
      totalCostCadCents: totalCostCents,
      avgCostCadCents: avgCostCents,
      currentPriceCents,
      marketValueCents: mvCents,
      dayChangeCents: null,
      dayChangePercent: null,
      unrealizedGainCents: gain,
      unrealizedGainPercent: gain !== null && totalCostCents > 0 ? gain / totalCostCents : null,
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
