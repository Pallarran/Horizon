/**
 * Net worth computation — sums all position market values in CAD.
 * USD positions are converted using the latest FX rate.
 */
import type { ScopedPrisma } from "@/lib/db/scoped";
import type { ComputedPosition } from "@/lib/positions/types";
import { convertCurrency } from "@/lib/money/arithmetic";
import { getLatestFxRate } from "@/lib/money/fx";

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
 */
export async function computeNetWorth(
  db: ScopedPrisma,
  positions: ComputedPosition[],
): Promise<NetWorthData> {
  // Get latest USD→CAD FX rate
  const usdCadRate = await getLatestFxRate(db, "USD", "CAD");

  let netWorthCents = 0n;
  let totalCostCents = 0n;
  let dayChangeCents = 0n;
  let prevNetWorthCents = 0n;

  for (const pos of positions) {
    if (pos.quantity <= 0) continue;

    const isUsd = pos.currency === "USD";
    const rate = isUsd ? usdCadRate : 1;

    // Market value — use current price when available, else fall back to CAD cost
    const mvCad = pos.marketValueCents !== null
      ? (isUsd ? convertCurrency(pos.marketValueCents, rate) : pos.marketValueCents)
      : pos.totalCostCadCents;
    netWorthCents += mvCad;

    // Cost basis (already in CAD from historical FX rates in ACB engine)
    totalCostCents += pos.totalCostCadCents;

    // Day change (pos.dayChangeCents already includes quantity)
    if (pos.dayChangeCents !== null) {
      const dcCad = isUsd
        ? convertCurrency(pos.dayChangeCents, rate)
        : pos.dayChangeCents;
      dayChangeCents += dcCad;
    }

    // Previous day value for % calculation
    if (pos.marketValueCents !== null && pos.dayChangeCents !== null) {
      const prevValue = pos.marketValueCents - pos.dayChangeCents;
      const prevCad = isUsd ? convertCurrency(prevValue, rate) : prevValue;
      prevNetWorthCents += prevCad;
    } else if (pos.marketValueCents !== null) {
      const mvCad = isUsd
        ? convertCurrency(pos.marketValueCents, rate)
        : pos.marketValueCents;
      prevNetWorthCents += mvCad;
    }
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

