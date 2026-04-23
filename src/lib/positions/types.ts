/**
 * ComputedPosition — derived from transactions at query time.
 * NOT persisted; recalculated when needed.
 */
export interface ComputedPosition {
  securityId: string;
  accountId: string;

  // Security metadata (joined)
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  assetClass: string;
  sector: string | null;
  industry: string | null;

  // Account metadata (joined)
  accountName: string;
  accountType: string;

  // Position data
  quantity: number;           // shares held (Decimal → number)
  totalCostCents: bigint;     // total ACB in transaction currency
  avgCostCents: bigint;       // per-share ACB in transaction currency

  // Market data (requires latest price)
  currentPriceCents: bigint | null;
  marketValueCents: bigint | null;
  dayChangeCents: bigint | null;
  dayChangePercent: number | null;
  unrealizedGainCents: bigint | null;
  unrealizedGainPercent: number | null;

  // Income data (from security metadata)
  annualDividendPerShareCents: bigint | null;
  expectedIncomeCents: bigint | null;
  yieldPercent: number | null;
  yieldOnCostPercent: number | null;

  // Dividend growth
  dividendGrowthYears: number | null;

  // Dividend classification
  isDividendAristocrat: boolean;
  isDividendKing: boolean;
  isPaysMonthly: boolean;
  dividendFrequency: string | null;
}

/**
 * Intermediate ACB state tracked during position computation.
 */
export interface AcbState {
  securityId: string;
  accountId: string;
  quantity: number;       // current share count
  totalCostCents: bigint; // running ACB total
}
