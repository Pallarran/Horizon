/**
 * Net worth computation — sums all position market values in CAD.
 * USD positions are converted using the latest FX rate.
 */
import type { ScopedPrisma } from "@/lib/db/scoped";
import type { ComputedPosition } from "@/lib/positions/types";
import { convertCurrency } from "@/lib/money/arithmetic";
import { getLatestFxRate, getFxRateForDate } from "@/lib/money/fx";

export interface NetWorthData {
  /** Total net worth in CAD cents */
  netWorthCents: number;
  /** Total cost basis in CAD cents */
  totalCostCents: number;
  /** Unrealized gain/loss in CAD cents */
  unrealizedGainCents: number;
  /** Unrealized gain/loss as a decimal (e.g. 0.12 = 12%) */
  unrealizedGainPercent: number;
  /** Day change in CAD cents */
  dayChangeCents: number;
  /** Day change as a decimal */
  dayChangePercent: number;
  /** Latest USD→CAD FX rate used for conversion */
  usdCadRate: number;
}

/**
 * Compute net worth from positions, converting all to CAD.
 * Optional cash totals (in source currency cents) are added so the dashboard
 * net worth matches the AccountsTab sum (positions + cash with CRCD adjustment).
 */
export async function computeNetWorth(
  db: ScopedPrisma,
  positions: ComputedPosition[],
  cashCadCents = 0,
  cashUsdCents = 0,
): Promise<NetWorthData> {
  // Get latest USD→CAD FX rate (today) and the most recent rate from before today (yesterday)
  // so day change can include FX rate movement on USD holdings.
  const usdCadRate = await getLatestFxRate(db, "USD", "CAD");
  const yesterday = new Date();
  yesterday.setUTCHours(0, 0, 0, 0);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const usdCadRatePrev = (await getFxRateForDate(db, "USD", "CAD", yesterday)) ?? usdCadRate;

  let netWorthCents = 0n;
  let totalCostCents = 0n;
  let dayChangeCents = 0n;
  let prevNetWorthCents = 0n;

  for (const pos of positions) {
    if (pos.quantity <= 0) continue;

    const isUsd = pos.currency === "USD";
    const rate = isUsd ? usdCadRate : 1;
    const ratePrev = isUsd ? usdCadRatePrev : 1;

    // Market value — use current price when available, else fall back to CAD cost
    const mvCad = pos.marketValueCents !== null
      ? (isUsd ? convertCurrency(pos.marketValueCents, rate) : pos.marketValueCents)
      : pos.totalCostCadCents;
    netWorthCents += mvCad;

    // Cost basis (already in CAD from historical FX rates in ACB engine)
    totalCostCents += pos.totalCostCadCents;

    // Day change in CAD = today's CAD market value − yesterday's CAD market value.
    // For USD positions, yesterday's CAD value uses YESTERDAY's FX so the metric
    // reflects both price movement AND FX rate movement.
    if (pos.marketValueCents !== null && pos.dayChangeCents !== null) {
      const prevValueNative = pos.marketValueCents - pos.dayChangeCents;
      const prevCad = isUsd
        ? convertCurrency(prevValueNative, ratePrev)
        : prevValueNative;
      prevNetWorthCents += prevCad;
      dayChangeCents += mvCad - prevCad;
    } else if (pos.marketValueCents !== null) {
      // No previous price — assume no change for % calc, contributes 0 to day change.
      prevNetWorthCents += mvCad;
    }
  }

  // Cash: CAD cash adds straight; USD cash converts at today's FX (current) and
  // yesterday's FX (previous), so FX movement on USD cash contributes to day change.
  if (cashCadCents !== 0) {
    const cad = BigInt(cashCadCents);
    netWorthCents += cad;
    prevNetWorthCents += cad;
  }
  if (cashUsdCents !== 0) {
    const usd = BigInt(cashUsdCents);
    const cadToday = convertCurrency(usd, usdCadRate);
    const cadPrev = convertCurrency(usd, usdCadRatePrev);
    netWorthCents += cadToday;
    prevNetWorthCents += cadPrev;
    dayChangeCents += cadToday - cadPrev;
  }

  const unrealizedGainCents = netWorthCents - totalCostCents;
  const unrealizedGainPercent =
    Number(totalCostCents) > 0
      ? Number(unrealizedGainCents) / Number(totalCostCents)
      : 0;
  const dayChangePercent =
    Number(prevNetWorthCents) > 0
      ? Number(dayChangeCents) / Number(prevNetWorthCents)
      : 0;

  return {
    netWorthCents: Number(netWorthCents),
    totalCostCents: Number(totalCostCents),
    unrealizedGainCents: Number(unrealizedGainCents),
    unrealizedGainPercent,
    dayChangeCents: Number(dayChangeCents),
    dayChangePercent,
    usdCadRate,
  };
}

