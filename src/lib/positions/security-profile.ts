/**
 * SecurityProfile — extra metadata for the position detail sheet.
 * Kept separate from ComputedPosition to avoid bloating the pipeline.
 */

export interface SecurityProfile {
  sector: string | null;
  industry: string | null;
  longBusinessSummary: string | null;
  website: string | null;
  employeeCount: number | null;
  payoutRatio: number | null;
  fiveYearAvgDividendYield: number | null;
  exDividendDate: string | null;        // ISO string for JSON transport
  nextEarningsDate: string | null;      // ISO string for JSON transport
  debtToEquityRatio: number | null;
  freeCashFlowCents: number | null;
  analystRecommendationMean: number | null;
  numberOfAnalystOpinions: number | null;
  trailingPeRatio: number | null;
  fiftyTwoWeekHighCents: number | null;
  fiftyTwoWeekLowCents: number | null;
  marketCapCents: number | null;
}

export type SecurityProfileMap = Record<string, SecurityProfile>;

/** Convert NaN/Infinity to null — Yahoo Finance sometimes returns NaN for missing data */
function fin(v: number | null): number | null {
  return v !== null && Number.isFinite(v) ? v : null;
}

function finBig(v: bigint | null): number | null {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Serialize a Prisma security record into a SecurityProfile.
 */
export function serializeSecurityProfile(s: {
  sector: string | null;
  industry: string | null;
  longBusinessSummary: string | null;
  website: string | null;
  employeeCount: number | null;
  payoutRatio: number | null;
  fiveYearAvgDividendYield: number | null;
  exDividendDate: Date | null;
  nextEarningsDate: Date | null;
  debtToEquityRatio: number | null;
  freeCashFlowCents: bigint | null;
  analystRecommendationMean: number | null;
  numberOfAnalystOpinions: number | null;
  trailingPeRatio: number | null;
  fiftyTwoWeekHighCents: bigint | null;
  fiftyTwoWeekLowCents: bigint | null;
  marketCapCents: bigint | null;
}): SecurityProfile {
  return {
    sector: s.sector,
    industry: s.industry,
    longBusinessSummary: s.longBusinessSummary,
    website: s.website,
    employeeCount: fin(s.employeeCount),
    payoutRatio: fin(s.payoutRatio),
    fiveYearAvgDividendYield: fin(s.fiveYearAvgDividendYield),
    exDividendDate: s.exDividendDate?.toISOString() ?? null,
    nextEarningsDate: s.nextEarningsDate?.toISOString() ?? null,
    debtToEquityRatio: fin(s.debtToEquityRatio),
    freeCashFlowCents: finBig(s.freeCashFlowCents),
    analystRecommendationMean: fin(s.analystRecommendationMean),
    numberOfAnalystOpinions: fin(s.numberOfAnalystOpinions),
    trailingPeRatio: fin(s.trailingPeRatio),
    fiftyTwoWeekHighCents: finBig(s.fiftyTwoWeekHighCents),
    fiftyTwoWeekLowCents: finBig(s.fiftyTwoWeekLowCents),
    marketCapCents: finBig(s.marketCapCents),
  };
}
