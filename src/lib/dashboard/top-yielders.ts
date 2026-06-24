/**
 * Top yielders — ranks positions by yield on cost (YOC).
 * Groups by security symbol (aggregates across accounts).
 * All income amounts converted to CAD.
 */
import type { ComputedPosition } from "@/lib/positions/types";
import { convertCurrency } from "@/lib/money/arithmetic";

export interface TopYielder {
  symbol: string;
  name: string;
  /** Blended yield on cost across all accounts holding this security */
  yieldOnCostPercent: number;
  /** Current yield based on market price */
  yieldPercent: number;
  /** Total annual expected income in CAD cents */
  annualIncomeCents: number;
}

export interface TopYieldersData {
  yielders: TopYielder[];
  /** Portfolio-wide current yield (CAD income ÷ CAD market value, all positions) */
  portfolioYieldPercent: number;
}

/**
 * Compute top yielders by blended yield on cost.
 * Groups positions by symbol, sums income and cost across accounts,
 * then ranks by YOC descending.
 */
export function computeTopYielders(
  positions: ComputedPosition[],
  usdCadRate: number,
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

  // Portfolio-wide totals (CAD) across all held positions, including non-payers,
  // so the blended current yield reflects the whole portfolio, not only top names.
  let portfolioIncomeCad = 0;
  let portfolioMarketValueCad = 0;

  for (const pos of positions) {
    const marketValueCents = pos.marketValueCents ?? 0n;
    if (pos.quantity > 0 && marketValueCents > 0n) {
      const incomeCents = pos.expectedIncomeCents ?? 0n;
      portfolioIncomeCad +=
        pos.currency === "USD" ? Number(convertCurrency(incomeCents, usdCadRate)) : Number(incomeCents);
      portfolioMarketValueCad +=
        pos.currency === "USD" ? Number(convertCurrency(marketValueCents, usdCadRate)) : Number(marketValueCents);
    }

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
    .map((s) => {
      const incomeCad = s.currency === "USD"
        ? Number(convertCurrency(s.totalIncomeCents, usdCadRate))
        : Number(s.totalIncomeCents);
      return {
        symbol: s.symbol,
        name: s.name,
        yieldOnCostPercent:
          Number(s.totalCostCents) > 0
            ? Number(s.totalIncomeCents) / Number(s.totalCostCents)
            : 0,
        yieldPercent: s.yieldPercent,
        annualIncomeCents: incomeCad,
      };
    })
    .filter((y) => y.yieldPercent > 0)
    .sort((a, b) => b.yieldPercent - a.yieldPercent)
    .slice(0, limit);

  const portfolioYieldPercent =
    portfolioMarketValueCad > 0 ? portfolioIncomeCad / portfolioMarketValueCad : 0;

  return { yielders, portfolioYieldPercent };
}
