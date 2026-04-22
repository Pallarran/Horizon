/**
 * Serialized position for JSON transport to client components.
 * BigInt fields are converted to number (safe for cent amounts < 2^53).
 */
import type { ComputedPosition } from "./types";

export interface SerializedPosition {
  securityId: string;
  accountId: string;
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  assetClass: string;
  industry: string | null;
  accountName: string;
  accountType: string;
  quantity: number;
  totalCostCents: number;
  avgCostCents: number;
  currentPriceCents: number | null;
  marketValueCents: number | null;
  dayChangeCents: number | null;
  dayChangePercent: number | null;
  unrealizedGainCents: number | null;
  unrealizedGainPercent: number | null;
  annualDividendPerShareCents: number | null;
  expectedIncomeCents: number | null;
  yieldPercent: number | null;
  yieldOnCostPercent: number | null;
  dividendGrowthYears: number | null;
}

export function serializePosition(p: ComputedPosition): SerializedPosition {
  return {
    securityId: p.securityId,
    accountId: p.accountId,
    symbol: p.symbol,
    name: p.name,
    exchange: p.exchange,
    currency: p.currency,
    assetClass: p.assetClass,
    industry: p.industry,
    accountName: p.accountName,
    accountType: p.accountType,
    quantity: p.quantity,
    totalCostCents: Number(p.totalCostCents),
    avgCostCents: Number(p.avgCostCents),
    currentPriceCents: p.currentPriceCents !== null ? Number(p.currentPriceCents) : null,
    marketValueCents: p.marketValueCents !== null ? Number(p.marketValueCents) : null,
    dayChangeCents: p.dayChangeCents !== null ? Number(p.dayChangeCents) : null,
    dayChangePercent: p.dayChangePercent,
    unrealizedGainCents: p.unrealizedGainCents !== null ? Number(p.unrealizedGainCents) : null,
    unrealizedGainPercent: p.unrealizedGainPercent,
    annualDividendPerShareCents: p.annualDividendPerShareCents !== null ? Number(p.annualDividendPerShareCents) : null,
    expectedIncomeCents: p.expectedIncomeCents !== null ? Number(p.expectedIncomeCents) : null,
    yieldPercent: p.yieldPercent,
    yieldOnCostPercent: p.yieldOnCostPercent,
    dividendGrowthYears: p.dividendGrowthYears,
  };
}

export function serializePositions(positions: ComputedPosition[]): SerializedPosition[] {
  return positions.map(serializePosition);
}
