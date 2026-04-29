/**
 * Portfolio history — computes monthly net worth snapshots for the past 12 months.
 *
 * Replays transactions chronologically to reconstruct positions at each snapshot
 * date, then values them using historical prices and FX rates.
 */
import type { ScopedPrisma } from "@/lib/db/scoped";
import { prisma } from "@/lib/db/prisma";
import { convertCurrency } from "@/lib/money/arithmetic";

export interface PortfolioHistoryPoint {
  date: string; // ISO date "2025-05-01"
  valueCents: number; // portfolio value in CAD cents
}

export async function computePortfolioHistory(
  db: ScopedPrisma,
): Promise<PortfolioHistoryPoint[]> {
  // 1. Generate snapshot dates: 1st of each month for past 12 months + today
  const snapshotDates = generateSnapshotDates();

  // 2. Fetch all transactions with security positions
  const transactions = await db.transaction.findMany({
    where: { securityId: { not: null } },
    orderBy: { date: "asc" },
    select: {
      id: true,
      securityId: true,
      type: true,
      date: true,
      quantity: true,
    },
  });

  if (transactions.length === 0) return [];

  // 3. Fetch security currencies
  const securities = await db.security.findMany({
    select: { id: true, currency: true },
  });
  const currencyMap = new Map(securities.map((s) => [s.id, s.currency]));

  // Collect all security IDs that appear in transactions
  const securityIds = [
    ...new Set(
      transactions
        .map((t) => t.securityId)
        .filter((id): id is string => id !== null),
    ),
  ];

  // 4. Batch-fetch prices (with 7-day buffer before earliest snapshot for weekends)
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

  // 5. Build lookup structures
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

  // 6. Walk transactions, snapshot positions at each date
  const positions = new Map<string, number>(); // securityId → total quantity
  let txnIdx = 0;
  const result: PortfolioHistoryPoint[] = [];

  for (const snapshotDate of snapshotDates) {
    const snapshotTime = snapshotDate.getTime();

    // Advance through transactions up to this snapshot date
    while (
      txnIdx < transactions.length &&
      transactions[txnIdx].date.getTime() <= snapshotTime
    ) {
      const txn = transactions[txnIdx];
      const secId = txn.securityId!;
      const qty = txn.quantity !== null ? Number(txn.quantity) : 0;
      const current = positions.get(secId) ?? 0;

      switch (txn.type) {
        case "BUY":
        case "DRIP":
          positions.set(secId, current + qty);
          break;
        case "SELL":
          positions.set(secId, Math.max(0, current - qty));
          break;
        case "SPLIT":
          positions.set(secId, current + qty);
          break;
      }

      txnIdx++;
    }

    // 7. Value the portfolio at this snapshot
    let totalCadCents = 0n;

    for (const [secId, qty] of positions) {
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

    result.push({
      date: formatDate(snapshotDate),
      valueCents: Number(totalCadCents),
    });
  }

  // Add CRCD holdings value — these aren't tracked via transactions.
  // Filter by purchaseYear so each snapshot only includes tranches that existed then.
  const crcdByYear = await computeCrcdValueByYear(db);
  if (crcdByYear.length > 0) {
    for (const point of result) {
      const snapshotYear = new Date(point.date).getUTCFullYear();
      let crcdCents = 0;
      for (const entry of crcdByYear) {
        if (entry.purchaseYear <= snapshotYear) {
          crcdCents += entry.valueCents;
        }
      }
      point.valueCents += crcdCents;
    }
  }

  // Trim leading zero-value points (months with no price data).
  // Keep trailing zeros — a genuine drop to $0 is meaningful.
  const firstNonZero = result.findIndex((p) => p.valueCents > 0);
  if (firstNonZero < 0) return []; // no data at all
  return result.slice(firstNonZero);
}

/** Compute CRCD holdings value grouped by purchase year (for time-weighted sparkline). */
async function computeCrcdValueByYear(
  db: ScopedPrisma,
): Promise<Array<{ purchaseYear: number; valueCents: number }>> {
  const holdings = await db.crcdHolding.findMany();
  if (holdings.length === 0) return [];

  // Get current price from CRCD security
  const crcdSecurity = await prisma.security.findUnique({
    where: { symbol_exchange: { symbol: "CRCD", exchange: "DESJARDINS" } },
  });

  let priceCents: number | null = null;
  if (crcdSecurity) {
    const latestPrice = await prisma.price.findFirst({
      where: { securityId: crcdSecurity.id },
      orderBy: { date: "desc" },
    });
    if (latestPrice) {
      priceCents = Number(latestPrice.priceCents);
    } else if (crcdSecurity.manualPrice !== null) {
      priceCents = Math.round(Number(crcdSecurity.manualPrice) * 100);
    }
  }

  // Group by purchaseYear
  const byYear = new Map<number, number>();
  for (const h of holdings) {
    const qty = Number(h.quantity);
    const perShareCents = priceCents ?? Number(h.averagePriceCents);
    const value = Math.round(qty * perShareCents);
    byYear.set(h.purchaseYear, (byYear.get(h.purchaseYear) ?? 0) + value);
  }

  return Array.from(byYear.entries()).map(([purchaseYear, valueCents]) => ({
    purchaseYear,
    valueCents,
  }));
}

// --- Helpers ---

export function generateSnapshotDates(): Date[] {
  const today = new Date();
  const dates: Date[] = [];

  // Last day of each of the past 12 months
  for (let i = 12; i >= 1; i--) {
    // Day 0 of the next month = last day of current month
    dates.push(new Date(today.getFullYear(), today.getMonth() - i + 1, 0));
  }
  // Current month: use today
  dates.push(today);

  return dates;
}

export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Binary search for the most recent entry on or before target time. */
export function findClosestOnOrBefore(
  sorted: Array<{ time: number; priceCents: bigint }>,
  targetTime: number,
): bigint | null {
  let lo = 0;
  let hi = sorted.length - 1;
  let result: bigint | null = null;

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid].time <= targetTime) {
      result = sorted[mid].priceCents;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return result;
}

/** Binary search for the most recent FX rate on or before target time. */
export function findClosestFxRate(
  sorted: Array<{ time: number; rate: number }>,
  targetTime: number,
): number {
  let lo = 0;
  let hi = sorted.length - 1;
  let result = 1.0; // fallback

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid].time <= targetTime) {
      result = sorted[mid].rate;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return result;
}
