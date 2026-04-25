/**
 * Dividend history — total dividend income per year from transactions.
 */
import type { ScopedPrisma } from "@/lib/db/scoped";
import { convertCurrency } from "@/lib/money/arithmetic";

export interface DividendHistoryPoint {
  year: number;
  totalCents: number;
}

/**
 * Compute yearly dividend income totals from DIVIDEND transactions.
 * All amounts converted to CAD using the provided USD/CAD rate.
 */
export async function computeDividendHistory(
  db: ScopedPrisma,
  usdCadRate: number,
): Promise<DividendHistoryPoint[]> {
  const txns = await db.transaction.findMany({
    where: { type: "DIVIDEND" },
    select: { date: true, amountCents: true, currency: true, fxRateAtDate: true },
  });

  const byYear = new Map<number, bigint>();

  for (const txn of txns) {
    const year = txn.date.getFullYear();
    const isUsd = txn.currency === "USD";
    const rate = isUsd && txn.fxRateAtDate != null ? Number(txn.fxRateAtDate) : usdCadRate;
    const amountCad = isUsd ? convertCurrency(txn.amountCents, rate) : txn.amountCents;
    const abs = amountCad > 0n ? amountCad : -amountCad;
    byYear.set(year, (byYear.get(year) ?? 0n) + abs);
  }

  return Array.from(byYear.entries())
    .sort(([a], [b]) => a - b)
    .map(([year, totalCents]) => ({ year, totalCents: Number(totalCents) }));
}
