/**
 * Account history — computes monthly value snapshots per account for the past 12 months.
 *
 * Same temporal replay pattern as computePortfolioHistory, but partitioned by accountId.
 * All values converted to CAD using historical FX rates.
 */
import type { ScopedPrisma } from "@/lib/db/scoped";
import type { PortfolioHistoryPoint } from "./portfolio-history";
import {
  generateSnapshotDates,
  findClosestOnOrBefore,
  findClosestFxRate,
  formatDate,
} from "./portfolio-history";
import { convertCurrency } from "@/lib/money/arithmetic";

export async function computeAccountHistories(
  db: ScopedPrisma,
): Promise<Record<string, PortfolioHistoryPoint[]>> {
  const snapshotDates = generateSnapshotDates();

  // 1. Fetch all transactions with security positions (need accountId)
  const transactions = await db.transaction.findMany({
    where: { securityId: { not: null } },
    orderBy: { date: "asc" },
    select: {
      id: true,
      accountId: true,
      securityId: true,
      type: true,
      date: true,
      quantity: true,
    },
  });

  if (transactions.length === 0) return {};

  // Collect unique security IDs
  const securityIds = [
    ...new Set(
      transactions
        .map((t) => t.securityId)
        .filter((id): id is string => id !== null),
    ),
  ];

  // 2. Fetch security currencies
  const securities = await db.security.findMany({
    where: { id: { in: securityIds } },
    select: { id: true, currency: true },
  });
  const currencyMap = new Map(securities.map((s) => [s.id, s.currency]));

  // 3. Batch-fetch prices and FX rates (with 7-day buffer before earliest snapshot for weekends)
  const earliest = new Date(snapshotDates[0]);
  earliest.setDate(earliest.getDate() - 7);

  const [allPrices, allFxRates] = await Promise.all([
    db.price.findMany({
      where: {
        securityId: { in: securityIds },
        date: { gte: earliest },
      },
      orderBy: { date: "asc" },
      select: { securityId: true, date: true, priceCents: true },
    }),
    db.fxRate.findMany({
      where: {
        fromCurrency: "USD",
        toCurrency: "CAD",
        date: { gte: earliest },
      },
      orderBy: { date: "asc" },
      select: { date: true, rate: true },
    }),
  ]);

  // 4. Build lookup structures
  const pricesBySecurity = new Map<
    string,
    Array<{ time: number; priceCents: bigint }>
  >();
  for (const p of allPrices) {
    const arr = pricesBySecurity.get(p.securityId) ?? [];
    arr.push({ time: p.date.getTime(), priceCents: p.priceCents });
    pricesBySecurity.set(p.securityId, arr);
  }

  const fxRateEntries = allFxRates.map((r) => ({
    time: r.date.getTime(),
    rate: Number(r.rate),
  }));

  // 5. Walk transactions, track positions per account
  // accountId → securityId → quantity
  const positions = new Map<string, Map<string, number>>();
  let txnIdx = 0;
  const result: Record<string, PortfolioHistoryPoint[]> = {};

  for (const snapshotDate of snapshotDates) {
    const snapshotTime = snapshotDate.getTime();

    // Advance through transactions up to this snapshot date
    while (
      txnIdx < transactions.length &&
      transactions[txnIdx].date.getTime() <= snapshotTime
    ) {
      const txn = transactions[txnIdx];
      const secId = txn.securityId!;
      const acctId = txn.accountId;
      const qty = txn.quantity !== null ? Number(txn.quantity) : 0;

      if (!positions.has(acctId)) positions.set(acctId, new Map());
      const acctPositions = positions.get(acctId)!;
      const current = acctPositions.get(secId) ?? 0;

      switch (txn.type) {
        case "BUY":
        case "DRIP":
          acctPositions.set(secId, current + qty);
          break;
        case "SELL":
          acctPositions.set(secId, Math.max(0, current - qty));
          break;
        case "SPLIT":
          acctPositions.set(secId, current + qty);
          break;
      }

      txnIdx++;
    }

    // 6. Value each account at this snapshot (converted to CAD)
    for (const [acctId, acctPositions] of positions) {
      let totalCadCents = 0n;

      for (const [secId, qty] of acctPositions) {
        if (qty <= 0) continue;

        const prices = pricesBySecurity.get(secId);
        if (!prices) continue;

        const priceCents = findClosestOnOrBefore(prices, snapshotTime);
        if (priceCents === null) continue;

        const valueCents = BigInt(Math.round(qty * Number(priceCents)));
        const currency = currencyMap.get(secId) ?? "CAD";

        if (currency === "USD") {
          const fxRate = findClosestFxRate(fxRateEntries, snapshotTime);
          totalCadCents += convertCurrency(valueCents, fxRate);
        } else {
          totalCadCents += valueCents;
        }
      }

      if (!result[acctId]) result[acctId] = [];
      result[acctId].push({
        date: formatDate(snapshotDate),
        valueCents: Number(totalCadCents),
      });
    }
  }

  // 7. Trim leading zeros per account
  for (const acctId of Object.keys(result)) {
    const history = result[acctId];
    const firstNonZero = history.findIndex((p) => p.valueCents > 0);
    if (firstNonZero < 0) {
      result[acctId] = [];
    } else {
      result[acctId] = history.slice(firstNonZero);
    }
  }

  return result;
}
