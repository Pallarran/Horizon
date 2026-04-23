/**
 * ACB (Adjusted Cost Base) position computation engine.
 *
 * Processes transactions in chronological order to compute:
 *   - Current share count
 *   - Total cost (ACB)
 *   - Average cost per share
 *
 * Rules (PRD §4.7):
 *   BUY/DRIP:  new_total = prev_total + (qty × price) + fees
 *              new_acb   = new_total / new_qty
 *   SELL:      acb per share unchanged
 *              realized_gain = (sell_price × qty) - (acb × qty) - fees
 *   SPLIT:     qty changes, total cost unchanged, acb recalculated
 */
import type { AcbState, ComputedPosition } from "./types";

interface TransactionRow {
  id: string;
  accountId: string;
  securityId: string | null;
  type: string;        // TransactionType enum value
  date: Date;
  quantity: number | null;  // Decimal → number
  priceCents: bigint | null;
  amountCents: bigint;
  feeCents: bigint;
}

interface SecurityInfo {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  assetClass: string;
  sector: string | null;
  industry: string | null;
  annualDividendCents: bigint | null;
  dividendGrowthYears: number | null;
  isDividendAristocrat: boolean;
  isDividendKing: boolean;
  isPaysMonthly: boolean;
  dividendFrequency: string | null;
}

interface AccountInfo {
  id: string;
  name: string;
  type: string;
}

interface PriceInfo {
  currentPriceCents: bigint;
  previousPriceCents: bigint | null;
}

/**
 * Compute ACB states from a chronologically-sorted list of transactions.
 * Returns a Map keyed by "securityId|accountId".
 */
export function computeAcbStates(transactions: TransactionRow[]): Map<string, AcbState> {
  const states = new Map<string, AcbState>();

  // Sort by date, then by id for deterministic ordering within same date
  const sorted = [...transactions].sort((a, b) => {
    const d = a.date.getTime() - b.date.getTime();
    return d !== 0 ? d : a.id.localeCompare(b.id);
  });

  for (const txn of sorted) {
    if (!txn.securityId) continue; // skip pure cash movements

    const key = `${txn.securityId}|${txn.accountId}`;
    const state: AcbState = states.get(key) ?? {
      securityId: txn.securityId,
      accountId: txn.accountId,
      quantity: 0,
      totalCostCents: 0n,
    };

    const qty = txn.quantity ?? 0;
    const price = txn.priceCents ?? 0n;
    const fee = txn.feeCents;

    switch (txn.type) {
      case "BUY":
      case "DRIP": {
        // Cost increases by (qty × price) + fees
        const cost = BigInt(Math.round(qty * Number(price))) + fee;
        state.quantity += qty;
        state.totalCostCents += cost;
        break;
      }

      case "SELL": {
        // ACB per share stays the same; remove proportional cost
        if (state.quantity > 0) {
          const acbPerShare = Number(state.totalCostCents) / state.quantity;
          const costRemoved = BigInt(Math.round(acbPerShare * qty));
          state.quantity -= qty;
          state.totalCostCents -= costRemoved;

          // Prevent floating-point drift from producing negative tiny values
          if (state.quantity <= 0) {
            state.quantity = 0;
            state.totalCostCents = 0n;
          }
        }
        break;
      }

      case "SPLIT": {
        // quantity changes by the split factor, total cost unchanged
        // amountCents encodes the new total quantity for this position
        // OR: quantity field holds the new shares received
        // Convention: quantity = additional shares received from split
        state.quantity += qty;
        // totalCostCents unchanged — ACB per share recalculated implicitly
        break;
      }

      // DIVIDEND, INTEREST, FEE, etc. — don't affect position/ACB
      default:
        break;
    }

    states.set(key, state);
  }

  return states;
}

/**
 * Build full ComputedPosition objects from ACB states + market data.
 */
export function buildPositions(
  states: Map<string, AcbState>,
  securities: Map<string, SecurityInfo>,
  accounts: Map<string, AccountInfo>,
  prices: Map<string, PriceInfo>,
): ComputedPosition[] {
  const positions: ComputedPosition[] = [];

  for (const [, state] of states) {
    if (state.quantity <= 0) continue; // skip closed positions

    const sec = securities.get(state.securityId);
    const acct = accounts.get(state.accountId);
    if (!sec || !acct) continue;

    const avgCostCents = state.quantity > 0
      ? BigInt(Math.round(Number(state.totalCostCents) / state.quantity))
      : 0n;

    const priceInfo = prices.get(state.securityId);
    const currentPriceCents = priceInfo?.currentPriceCents ?? null;
    const previousPriceCents = priceInfo?.previousPriceCents ?? null;

    // Market value
    const marketValueCents = currentPriceCents !== null
      ? BigInt(Math.round(state.quantity * Number(currentPriceCents)))
      : null;

    // Day change
    let dayChangeCents: bigint | null = null;
    let dayChangePercent: number | null = null;
    if (currentPriceCents !== null && previousPriceCents !== null) {
      const change = currentPriceCents - previousPriceCents;
      dayChangeCents = BigInt(Math.round(state.quantity * Number(change)));
      dayChangePercent = Number(previousPriceCents) > 0
        ? Number(change) / Number(previousPriceCents)
        : 0;
    }

    // Unrealized gain
    let unrealizedGainCents: bigint | null = null;
    let unrealizedGainPercent: number | null = null;
    if (marketValueCents !== null) {
      unrealizedGainCents = marketValueCents - state.totalCostCents;
      unrealizedGainPercent = Number(state.totalCostCents) > 0
        ? Number(unrealizedGainCents) / Number(state.totalCostCents)
        : 0;
    }

    // Income
    const annualDivPerShare = sec.annualDividendCents;
    let expectedIncomeCents: bigint | null = null;
    let yieldPercent: number | null = null;
    let yieldOnCostPercent: number | null = null;

    if (annualDivPerShare !== null) {
      expectedIncomeCents = BigInt(Math.round(state.quantity * Number(annualDivPerShare)));

      if (marketValueCents !== null && marketValueCents > 0n) {
        yieldPercent = Number(expectedIncomeCents) / Number(marketValueCents);
      }
      if (state.totalCostCents > 0n) {
        yieldOnCostPercent = Number(expectedIncomeCents) / Number(state.totalCostCents);
      }
    }

    positions.push({
      securityId: state.securityId,
      accountId: state.accountId,
      symbol: sec.symbol,
      name: sec.name,
      exchange: sec.exchange,
      currency: sec.currency,
      assetClass: sec.assetClass,
      sector: sec.sector,
      industry: sec.industry,
      accountName: acct.name,
      accountType: acct.type,
      quantity: state.quantity,
      totalCostCents: state.totalCostCents,
      avgCostCents,
      currentPriceCents,
      marketValueCents,
      dayChangeCents,
      dayChangePercent,
      unrealizedGainCents,
      unrealizedGainPercent,
      annualDividendPerShareCents: annualDivPerShare,
      expectedIncomeCents,
      yieldPercent,
      yieldOnCostPercent,
      dividendGrowthYears: sec.dividendGrowthYears,
      isDividendAristocrat: sec.isDividendAristocrat,
      isDividendKing: sec.isDividendKing,
      isPaysMonthly: sec.isPaysMonthly,
      dividendFrequency: sec.dividendFrequency,
    });
  }

  return positions;
}
