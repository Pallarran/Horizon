/**
 * Account history — computes monthly value snapshots per account for the past 12 months.
 *
 * Same temporal replay pattern as computePortfolioHistory, but partitioned by accountId.
 * Values are in each account's native currency (no FX conversion), matching how
 * account cards display market values.
 */
import type { ScopedPrisma } from "@/lib/db/scoped";
import type { PortfolioHistoryPoint } from "./portfolio-history";
import {
  generateSnapshotDates,
  findClosestOnOrBefore,
  formatDate,
} from "./portfolio-history";

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

  // 2. Batch-fetch prices (with 7-day buffer before earliest snapshot for weekends)
  const earliest = new Date(snapshotDates[0]);
  earliest.setDate(earliest.getDate() - 7);

  const allPrices = await db.price.findMany({
    where: {
      securityId: { in: securityIds },
      date: { gte: earliest },
    },
    orderBy: { date: "asc" },
    select: { securityId: true, date: true, priceCents: true },
  });

  // 3. Build price lookup
  const pricesBySecurity = new Map<
    string,
    Array<{ time: number; priceCents: bigint }>
  >();
  for (const p of allPrices) {
    const arr = pricesBySecurity.get(p.securityId) ?? [];
    arr.push({ time: p.date.getTime(), priceCents: p.priceCents });
    pricesBySecurity.set(p.securityId, arr);
  }

  // 4. Walk transactions, track positions per account
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

    // 5. Value each account at this snapshot
    for (const [acctId, acctPositions] of positions) {
      let totalCents = 0n;

      for (const [secId, qty] of acctPositions) {
        if (qty <= 0) continue;

        const prices = pricesBySecurity.get(secId);
        if (!prices) continue;

        const priceCents = findClosestOnOrBefore(prices, snapshotTime);
        if (priceCents === null) continue;

        totalCents += BigInt(Math.round(qty * Number(priceCents)));
      }

      if (!result[acctId]) result[acctId] = [];
      result[acctId].push({
        date: formatDate(snapshotDate),
        valueCents: Number(totalCents),
      });
    }
  }

  // 6. Trim leading zeros per account
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
