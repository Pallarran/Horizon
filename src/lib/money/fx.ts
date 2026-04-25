/**
 * FX rate lookup — shared helper for currency conversion.
 */
import type { ScopedPrisma } from "@/lib/db/scoped";

/**
 * Get the most recent FX rate for a currency pair.
 * Returns 1.0 for same-currency pairs.
 * Logs a warning and returns 1.0 when no FX data exists (USD treated as CAD).
 */
export async function getLatestFxRate(
  db: ScopedPrisma,
  from: string,
  to: string,
): Promise<number> {
  if (from === to) return 1;

  const rate = await db.fxRate.findFirst({
    where: { fromCurrency: from, toCurrency: to },
    orderBy: { date: "desc" },
  });

  if (!rate) {
    console.warn(
      `[FX] No ${from}→${to} rate found — falling back to 1.0. USD values will be treated as CAD.`,
    );
    return 1;
  }
  return Number(rate.rate);
}

/**
 * Get the FX rate closest to (on or before) the given date.
 * Returns null if no FX data exists at all.
 */
export async function getFxRateForDate(
  db: ScopedPrisma,
  from: string,
  to: string,
  date: Date,
): Promise<number | null> {
  if (from === to) return 1;

  // Try exact or closest prior date
  const rate = await db.fxRate.findFirst({
    where: { fromCurrency: from, toCurrency: to, date: { lte: date } },
    orderBy: { date: "desc" },
  });

  if (rate) return Number(rate.rate);

  // Fall back to earliest available rate (transaction predates FX data)
  const earliest = await db.fxRate.findFirst({
    where: { fromCurrency: from, toCurrency: to },
    orderBy: { date: "asc" },
  });

  return earliest ? Number(earliest.rate) : null;
}
