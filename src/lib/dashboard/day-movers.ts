/**
 * Day movers — top gainers and losers from positions' daily price changes.
 * Groups by security (aggregates across accounts).
 */
import type { ComputedPosition } from "@/lib/positions/types";

export interface DayMover {
  symbol: string;
  name: string;
  changePercent: number;
  changeCents: number;
}

export interface DayMoversData {
  gainers: DayMover[];
  losers: DayMover[];
}

/**
 * Compute top 5 gainers and losers from daily price changes.
 * Aggregates by security symbol (merging multiple accounts holding same stock).
 */
export function computeDayMovers(
  positions: ComputedPosition[],
  limit: number = 5,
): DayMoversData {
  // Group by security symbol to avoid duplicates across accounts
  const bySymbol = new Map<
    string,
    { symbol: string; name: string; changePercent: number; changeCents: number }
  >();

  for (const pos of positions) {
    if (pos.quantity <= 0 || pos.dayChangePercent === null || pos.dayChangeCents === null) {
      continue;
    }

    const existing = bySymbol.get(pos.symbol);
    if (!existing) {
      bySymbol.set(pos.symbol, {
        symbol: pos.symbol,
        name: pos.name,
        changePercent: pos.dayChangePercent,
        changeCents: Number(pos.dayChangeCents),
      });
    } else {
      // Same stock in multiple accounts: % is identical, but dollar amount is quantity-weighted
      existing.changeCents += Number(pos.dayChangeCents);
    }
  }

  const all = [...bySymbol.values()].filter((m) => m.changePercent !== 0);

  const gainers = all
    .filter((m) => m.changePercent > 0)
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, limit);

  const losers = all
    .filter((m) => m.changePercent < 0)
    .sort((a, b) => a.changePercent - b.changePercent)
    .slice(0, limit);

  return { gainers, losers };
}
