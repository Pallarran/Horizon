/**
 * Top yielders — ranks positions by yield on cost (YOC).
 * Groups by security symbol (aggregates across accounts).
 * Pure computation, no DB access.
 */
import type { ComputedPosition } from "@/lib/positions/types";

export interface TopYielder {
  symbol: string;
  name: string;
  /** Blended yield on cost across all accounts holding this security */
  yieldOnCostPercent: number;
  /** Current yield based on market price */
  yieldPercent: number;
  /** Total annual expected income in original currency (cents) */
  annualIncomeCents: number;
  currency: string;
}

export interface TopYieldersData {
  yielders: TopYielder[];
}

/**
 * Compute top yielders by blended yield on cost.
 * Groups positions by symbol, sums income and cost across accounts,
 * then ranks by YOC descending.
 */
export function computeTopYielders(
  positions: ComputedPosition[],
  limit: number = 5,
): TopYieldersData {
  // Group by symbol — aggregate across accounts
  const bySymbol = new Map<
    string,
    {
      symbol: string;
      name: string;
      totalIncomeCents: bigint;
      totalCostCents: bigint;
      yieldPercent: number;
      currency: string;
    }
  >();

  for (const pos of positions) {
    if (
      pos.quantity <= 0 ||
      !pos.expectedIncomeCents ||
      pos.expectedIncomeCents <= 0n ||
      pos.totalCostCents <= 0n
    ) {
      continue;
    }

    const existing = bySymbol.get(pos.symbol);
    if (existing) {
      existing.totalIncomeCents += pos.expectedIncomeCents;
      existing.totalCostCents += pos.totalCostCents;
    } else {
      bySymbol.set(pos.symbol, {
        symbol: pos.symbol,
        name: pos.name,
        totalIncomeCents: pos.expectedIncomeCents,
        totalCostCents: pos.totalCostCents,
        yieldPercent: pos.yieldPercent ?? 0,
        currency: pos.currency,
      });
    }
  }

  const yielders: TopYielder[] = [...bySymbol.values()]
    .map((s) => ({
      symbol: s.symbol,
      name: s.name,
      yieldOnCostPercent:
        Number(s.totalCostCents) > 0
          ? Number(s.totalIncomeCents) / Number(s.totalCostCents)
          : 0,
      yieldPercent: s.yieldPercent,
      annualIncomeCents: Number(s.totalIncomeCents),
      currency: s.currency,
    }))
    .filter((y) => y.yieldOnCostPercent > 0)
    .sort((a, b) => b.yieldOnCostPercent - a.yieldOnCostPercent)
    .slice(0, limit);

  return { yielders };
}
