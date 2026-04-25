/**
 * Query layer: fetches transactions from DB, runs ACB engine,
 * enriches with price data, returns ComputedPosition[].
 */
import type { ScopedPrisma } from "@/lib/db/scoped";
import type { ComputedPosition } from "./types";
import { computeAcbStates, buildPositions } from "./compute";

/**
 * Compute all positions for the authenticated user.
 */
export async function getPositions(db: ScopedPrisma): Promise<ComputedPosition[]> {
  // 1. Fetch all transactions with security info
  const transactions = await db.transaction.findMany({
    orderBy: { date: "asc" },
    where: { securityId: { not: null } },
  });

  if (transactions.length === 0) return [];

  // 2. Compute ACB states (with FX rate for CAD cost basis)
  const acbStates = computeAcbStates(
    transactions.map((t) => ({
      id: t.id,
      accountId: t.accountId,
      securityId: t.securityId,
      type: t.type,
      date: t.date,
      quantity: t.quantity !== null ? Number(t.quantity) : null,
      priceCents: t.priceCents,
      amountCents: t.amountCents,
      feeCents: t.feeCents,
      currency: t.currency,
      fxRateAtDate: t.fxRateAtDate != null ? Number(t.fxRateAtDate) : null,
    })),
  );

  // 3. Gather unique security and account IDs from active positions
  const secIds = new Set<string>();
  const acctIds = new Set<string>();
  for (const [, state] of acbStates) {
    if (state.quantity > 0) {
      secIds.add(state.securityId);
      acctIds.add(state.accountId);
    }
  }

  if (secIds.size === 0) return [];

  // 4. Fetch securities, accounts, and latest prices
  const [securitiesRaw, accountsRaw, pricesRaw] = await Promise.all([
    db.security.findMany({ where: { id: { in: [...secIds] } } }),
    db.account.findMany({ where: { id: { in: [...acctIds] } } }),
    // Get recent prices per security for day-change calculation
    // Use a date window instead of a global take limit to ensure every security gets data
    db.price.findMany({
      where: {
        securityId: { in: [...secIds] },
        date: { gte: new Date(Date.now() - 10 * 86_400_000) },
      },
      orderBy: { date: "desc" },
    }),
  ]);

  // Build lookup maps
  const securities = new Map(
    securitiesRaw.map((s) => [
      s.id,
      {
        id: s.id,
        symbol: s.symbol,
        name: s.name,
        exchange: s.exchange,
        currency: s.currency,
        assetClass: s.assetClass,
        sector: s.sector,
        industry: s.industry,
        annualDividendCents: s.annualDividendCents,
        dividendGrowthYears: s.dividendGrowthYears,
        isDividendAristocrat: s.isDividendAristocrat,
        isDividendKing: s.isDividendKing,
        isPaysMonthly: s.isPaysMonthly,
        dividendFrequency: s.dividendFrequency,
      },
    ]),
  );

  const accounts = new Map(
    accountsRaw.map((a) => [a.id, { id: a.id, name: a.name, type: a.type }]),
  );

  // Build price map: securityId → { current, previous }
  const priceMap = new Map<string, { currentPriceCents: bigint; previousPriceCents: bigint | null }>();
  // Group prices by security, take first two (most recent)
  const pricesBySecId = new Map<string, { date: Date; priceCents: bigint }[]>();
  for (const p of pricesRaw) {
    const list = pricesBySecId.get(p.securityId) ?? [];
    list.push({ date: p.date, priceCents: p.priceCents });
    pricesBySecId.set(p.securityId, list);
  }
  for (const [secId, pList] of pricesBySecId) {
    // Already sorted desc from query
    const sorted = pList.sort((a, b) => b.date.getTime() - a.date.getTime());
    if (sorted.length > 0) {
      priceMap.set(secId, {
        currentPriceCents: sorted[0].priceCents,
        previousPriceCents: sorted.length > 1 ? sorted[1].priceCents : null,
      });
    }
  }

  // 5. Build positions
  return buildPositions(acbStates, securities, accounts, priceMap);
}

/**
 * Get transactions for a specific security+account, ordered chronologically.
 */
export async function getSecurityTransactions(
  db: ScopedPrisma,
  securityId: string,
  accountId?: string,
) {
  return db.transaction.findMany({
    where: {
      securityId,
      ...(accountId ? { accountId } : {}),
    },
    orderBy: { date: "desc" },
  });
}
