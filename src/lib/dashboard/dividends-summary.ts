/**
 * Dividend summary computation — annualized from positions,
 * YTD and prior-year from DIVIDEND transactions.
 */
import type { ScopedPrisma } from "@/lib/db/scoped";
import type { ComputedPosition } from "@/lib/positions/types";
import { convertCurrency } from "@/lib/money/arithmetic";
import { getLatestFxRate } from "@/lib/money/fx";
import { resolvePaymentMonths, getDefaultPaymentMonths } from "@/lib/dashboard/dividend-forecast";

export interface DividendsSummaryData {
  /** Annualized dividends based on current positions (CAD cents) */
  annualizedCents: number;
  /** Monthly average based on annualized (CAD cents) */
  monthlyAvgCents: number;
  /** Year-to-date actual dividend income (CAD cents) */
  ytdCents: number;
  /** Schedule-aware expected YTD dividends (CAD cents) */
  expectedYtdCents: number;
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

  // 2. Schedule-aware expected YTD — discover payment months per security
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-based
  const cutoff18m = new Date(now.getFullYear() - 1, now.getMonth() - 6, 1);
  const recentDivTxns = await db.transaction.findMany({
    where: { type: "DIVIDEND", date: { gte: cutoff18m } },
    select: { securityId: true, date: true },
  });

  const paymentCounts = new Map<string, Map<number, number>>();
  for (const txn of recentDivTxns) {
    if (!txn.securityId) continue;
    let counts = paymentCounts.get(txn.securityId);
    if (!counts) {
      counts = new Map();
      paymentCounts.set(txn.securityId, counts);
    }
    const m = txn.date.getMonth();
    counts.set(m, (counts.get(m) ?? 0) + 1);
  }

  let expectedYtdCents = 0n;
  for (const pos of positions) {
    if (pos.quantity <= 0 || !pos.expectedIncomeCents) continue;
    const isUsd = pos.currency === "USD";
    const annualCad = isUsd
      ? convertCurrency(pos.expectedIncomeCents, usdCadRate)
      : pos.expectedIncomeCents;

    const historicalCounts = paymentCounts.get(pos.securityId);
    const payMonths =
      historicalCounts && historicalCounts.size > 0
        ? resolvePaymentMonths(historicalCounts, pos.dividendFrequency)
        : getDefaultPaymentMonths(pos.dividendFrequency);

    const perPayment = Number(annualCad) / payMonths.length;
    const ytdPayments = payMonths.filter((m) => m <= currentMonth).length;
    expectedYtdCents += BigInt(Math.round(perPayment * ytdPayments));
  }

  // 3. YTD actual dividends from transactions
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
        type: { in: ["DIVIDEND", "ADJUSTMENT"] },
        date: { gte: ytdStart },
      },
      include: { security: true },
    }),
    db.transaction.findMany({
      where: {
        type: { in: ["DIVIDEND", "ADJUSTMENT"] },
        date: { gte: priorYearStart, lte: priorYearEnd },
      },
      include: { security: true },
    }),
    db.transaction.findMany({
      where: {
        type: { in: ["DIVIDEND", "ADJUSTMENT"] },
        date: { gte: priorYearStart, lte: priorYearSamePeriodEnd },
      },
      include: { security: true },
    }),
  ]);

  let ytdCents = 0n;
  for (const txn of ytdTxns) {
    const isUsd = txn.currency === "USD";
    const rate = isUsd && txn.fxRateAtDate != null ? Number(txn.fxRateAtDate) : usdCadRate;
    const amountCad = isUsd ? convertCurrency(txn.amountCents, rate) : txn.amountCents;
    // DIVIDEND: always positive; ADJUSTMENT: signed (negative = reversal)
    ytdCents += txn.type === "ADJUSTMENT" ? amountCad : (amountCad > 0n ? amountCad : -amountCad);
  }

  let priorYearCents = 0n;
  for (const txn of priorYearTxns) {
    const isUsd = txn.currency === "USD";
    const rate = isUsd && txn.fxRateAtDate != null ? Number(txn.fxRateAtDate) : usdCadRate;
    const amountCad = isUsd ? convertCurrency(txn.amountCents, rate) : txn.amountCents;
    priorYearCents += txn.type === "ADJUSTMENT" ? amountCad : (amountCad > 0n ? amountCad : -amountCad);
  }

  // 3. Prior year same period total (for YoY comparison)
  let priorYearSamePeriodCents = 0n;
  for (const txn of priorYearSamePeriodTxns) {
    const isUsd = txn.currency === "USD";
    const rate = isUsd && txn.fxRateAtDate != null ? Number(txn.fxRateAtDate) : usdCadRate;
    const amountCad = isUsd ? convertCurrency(txn.amountCents, rate) : txn.amountCents;
    priorYearSamePeriodCents += txn.type === "ADJUSTMENT" ? amountCad : (amountCad > 0n ? amountCad : -amountCad);
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
    expectedYtdCents: Number(expectedYtdCents),
    priorYearCents: Number(priorYearCents),
    ytdGrowthPercent,
  };
}

