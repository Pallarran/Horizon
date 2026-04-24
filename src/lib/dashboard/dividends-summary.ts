/**
 * Dividend summary computation — annualized from positions,
 * YTD and prior-year from DIVIDEND transactions.
 */
import type { ScopedPrisma } from "@/lib/db/scoped";
import type { ComputedPosition } from "@/lib/positions/types";
import { convertCurrency } from "@/lib/money/arithmetic";

export interface DividendsSummaryData {
  /** Annualized dividends based on current positions (CAD cents) */
  annualizedCents: number;
  /** Monthly average based on annualized (CAD cents) */
  monthlyAvgCents: number;
  /** Year-to-date actual dividend income (CAD cents) */
  ytdCents: number;
  /** Prior full year actual dividend income (CAD cents) */
  priorYearCents: number;
  /** YoY growth rate as decimal (e.g. 0.10 = 10%) */
  ytdGrowthPercent: number;
}

export async function computeDividendsSummary(
  db: ScopedPrisma,
  positions: ComputedPosition[],
): Promise<DividendsSummaryData> {
  // 1. Annualized from current positions
  const usdCadRate = await getLatestFxRate(db, "USD", "CAD");

  let annualizedCents = 0n;
  for (const pos of positions) {
    if (pos.quantity <= 0 || !pos.expectedIncomeCents) continue;
    const isUsd = pos.currency === "USD";
    const incomeCad = isUsd
      ? convertCurrency(pos.expectedIncomeCents, usdCadRate)
      : pos.expectedIncomeCents;
    annualizedCents += incomeCad;
  }

  const monthlyAvgCents = Number(annualizedCents) / 12;

  // 2. YTD actual dividends from transactions
  const now = new Date();
  const ytdStart = new Date(now.getFullYear(), 0, 1);
  const priorYearStart = new Date(now.getFullYear() - 1, 0, 1);
  const priorYearEnd = new Date(now.getFullYear() - 1, 11, 31);

  // Same-period cutoff for prior year (Jan 1 → same month/day last year)
  const priorYearSamePeriodEnd = new Date(
    now.getFullYear() - 1,
    now.getMonth(),
    now.getDate(),
  );

  const [ytdTxns, priorYearTxns, priorYearSamePeriodTxns] = await Promise.all([
    db.transaction.findMany({
      where: {
        type: "DIVIDEND",
        date: { gte: ytdStart },
      },
      include: { security: true },
    }),
    db.transaction.findMany({
      where: {
        type: "DIVIDEND",
        date: { gte: priorYearStart, lte: priorYearEnd },
      },
      include: { security: true },
    }),
    db.transaction.findMany({
      where: {
        type: "DIVIDEND",
        date: { gte: priorYearStart, lte: priorYearSamePeriodEnd },
      },
      include: { security: true },
    }),
  ]);

  let ytdCents = 0n;
  for (const txn of ytdTxns) {
    const isUsd = txn.currency === "USD";
    const amountCad = isUsd
      ? convertCurrency(txn.amountCents, usdCadRate)
      : txn.amountCents;
    // DIVIDEND amountCents is positive (money arrives)
    ytdCents += amountCad > 0n ? amountCad : -amountCad;
  }

  let priorYearCents = 0n;
  for (const txn of priorYearTxns) {
    const isUsd = txn.currency === "USD";
    const amountCad = isUsd
      ? convertCurrency(txn.amountCents, usdCadRate)
      : txn.amountCents;
    priorYearCents += amountCad > 0n ? amountCad : -amountCad;
  }

  // 3. Prior year same period total (for YoY comparison)
  let priorYearSamePeriodCents = 0n;
  for (const txn of priorYearSamePeriodTxns) {
    const isUsd = txn.currency === "USD";
    const amountCad = isUsd
      ? convertCurrency(txn.amountCents, usdCadRate)
      : txn.amountCents;
    priorYearSamePeriodCents += amountCad > 0n ? amountCad : -amountCad;
  }

  // 4. YoY growth — compare YTD to same period last year
  const ytdGrowthPercent =
    Number(priorYearSamePeriodCents) > 0
      ? (Number(ytdCents) - Number(priorYearSamePeriodCents)) /
        Number(priorYearSamePeriodCents)
      : 0;

  return {
    annualizedCents: Number(annualizedCents),
    monthlyAvgCents: Math.round(monthlyAvgCents),
    ytdCents: Number(ytdCents),
    priorYearCents: Number(priorYearCents),
    ytdGrowthPercent,
  };
}

async function getLatestFxRate(
  db: ScopedPrisma,
  from: string,
  to: string,
): Promise<number> {
  if (from === to) return 1;
  const rate = await db.fxRate.findFirst({
    where: { fromCurrency: from, toCurrency: to },
    orderBy: { date: "desc" },
  });
  if (!rate) return 1;
  return Number(rate.rate);
}
