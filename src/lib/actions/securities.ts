"use server";

import YahooFinance from "yahoo-finance2";
import type { AssetClass } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/middleware";
import { createSecuritySchema } from "@/lib/validators/account";
import { dollarsToCents } from "@/lib/money/arithmetic";

export interface SecurityActionState {
  error?: string;
  success?: boolean;
  securityId?: string;
}

export async function createSecurityAction(
  _prev: SecurityActionState,
  formData: FormData,
): Promise<SecurityActionState> {
  await requireAuth();

  const raw = {
    symbol: formData.get("symbol"),
    exchange: formData.get("exchange"),
    name: formData.get("name"),
    currency: formData.get("currency"),
    assetClass: formData.get("assetClass"),
    industry: formData.get("industry") || undefined,
    annualDividendDollars: formData.get("annualDividendDollars") || undefined,
    dividendFrequency: formData.get("dividendFrequency") || undefined,
    dividendGrowthYears: formData.get("dividendGrowthYears") || undefined,
  };

  const result = createSecuritySchema.safeParse(raw);
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid input" };
  }

  const { annualDividendDollars, ...rest } = result.data;

  // Check for duplicate
  const existing = await prisma.security.findUnique({
    where: { symbol_exchange: { symbol: rest.symbol, exchange: rest.exchange } },
  });
  if (existing) {
    return { error: `Security ${rest.symbol} on ${rest.exchange} already exists`, securityId: existing.id };
  }

  const security = await prisma.security.create({
    data: {
      ...rest,
      annualDividendCents: annualDividendDollars ? dollarsToCents(annualDividendDollars) : null,
    },
  });

  return { success: true, securityId: security.id };
}

export async function searchSecuritiesAction(query: string) {
  await requireAuth();

  if (!query || query.length < 1) return [];

  const results = await prisma.security.findMany({
    where: {
      OR: [
        { symbol: { contains: query.toUpperCase(), mode: "insensitive" } },
        { name: { contains: query, mode: "insensitive" } },
      ],
    },
    take: 10,
    orderBy: { symbol: "asc" },
  });

  return results.map((s) => ({
    id: s.id,
    symbol: s.symbol,
    name: s.name,
    exchange: s.exchange,
    currency: s.currency,
  }));
}

export async function getSecuritiesAction() {
  await requireAuth();
  return prisma.security.findMany({ orderBy: { symbol: "asc" } });
}

/**
 * Create a security manually (for delisted / unlisted tickers not on Yahoo).
 * Used by the import resolver when Yahoo search returns nothing.
 */
export async function createManualSecurityAction(data: {
  symbol: string;
  exchange: string;
  name: string;
  currency: string;
}): Promise<{ securityId: string; error?: string }> {
  await requireAuth();

  const { symbol, exchange, name, currency } = data;
  if (!symbol || !exchange || !name || !currency) {
    return { securityId: "", error: "All fields are required" };
  }

  const existing = await prisma.security.findUnique({
    where: { symbol_exchange: { symbol, exchange } },
  });
  if (existing) return { securityId: existing.id };

  const isCanadian = ["TSX", "NEO"].includes(exchange);
  const assetClass: AssetClass = isCanadian ? "CANADIAN_EQUITY" : "US_EQUITY";

  const security = await prisma.security.create({
    data: {
      symbol,
      exchange,
      name,
      currency,
      assetClass,
      dataSource: "MANUAL",
      delisted: true,
    },
  });

  return { securityId: security.id };
}

// --------------- Yahoo Finance helpers ---------------

/** Map our internal exchange codes to Yahoo Finance suffix */
function toYahooSymbol(symbol: string, exchange: string): string {
  switch (exchange) {
    case "TSX":
      return `${symbol}.TO`;
    case "NEO":
      return `${symbol}.NE`;
    default:
      return symbol;
  }
}

/**
 * Fetch industry, sector, valuation, and other profile data from Yahoo Finance
 * and persist to the Security record. Non-blocking, non-critical.
 */
async function fetchAndStoreYahooProfile(
  securityId: string,
  yahooSym: string,
): Promise<void> {
  try {
    const yf = new (
      YahooFinance as unknown as new (
        opts?: object,
      ) => InstanceType<typeof YahooFinance>
    )({ suppressNotices: ["yahooSurvey"] });

    const result = await yf.quoteSummary(yahooSym, {
      modules: ["assetProfile", "summaryDetail", "calendarEvents", "financialData"] as never,
    });

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const profile = result.assetProfile as Record<string, any> | undefined;
    const summary = result.summaryDetail as Record<string, any> | undefined;
    const calendar = result.calendarEvents as Record<string, any> | undefined;
    const financial = result.financialData as Record<string, any> | undefined;
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const data: Record<string, unknown> = {
      yahooProfileFetchedAt: new Date(),
    };

    // assetProfile
    if (profile) {
      if (profile.sector) data.sector = String(profile.sector);
      if (profile.industry) data.industry = String(profile.industry);
      if (profile.longBusinessSummary) data.longBusinessSummary = String(profile.longBusinessSummary);
      if (profile.website) data.website = String(profile.website);
      if (Number.isFinite(profile.fullTimeEmployees)) data.employeeCount = profile.fullTimeEmployees;
    }

    // summaryDetail
    if (summary) {
      if (Number.isFinite(summary.payoutRatio)) data.payoutRatio = summary.payoutRatio;
      if (Number.isFinite(summary.fiveYearAvgDividendYield)) data.fiveYearAvgDividendYield = summary.fiveYearAvgDividendYield;
      if (Number.isFinite(summary.trailingPE)) data.trailingPeRatio = summary.trailingPE;
      if (Number.isFinite(summary.fiftyTwoWeekHigh)) data.fiftyTwoWeekHighCents = BigInt(Math.round(summary.fiftyTwoWeekHigh * 100));
      if (Number.isFinite(summary.fiftyTwoWeekLow)) data.fiftyTwoWeekLowCents = BigInt(Math.round(summary.fiftyTwoWeekLow * 100));
      if (Number.isFinite(summary.marketCap)) data.marketCapCents = BigInt(Math.round(summary.marketCap * 100));
    }

    // calendarEvents
    if (calendar) {
      if (calendar.exDividendDate instanceof Date) data.exDividendDate = calendar.exDividendDate;
      const earningsDates = calendar.earnings?.earningsDate;
      if (Array.isArray(earningsDates) && earningsDates.length > 0 && earningsDates[0] instanceof Date) {
        data.nextEarningsDate = earningsDates[0];
      }
    }

    // financialData
    if (financial) {
      if (Number.isFinite(financial.debtToEquity)) data.debtToEquityRatio = financial.debtToEquity;
      if (Number.isFinite(financial.freeCashflow)) data.freeCashFlowCents = BigInt(Math.round(financial.freeCashflow * 100));
      if (Number.isFinite(financial.recommendationMean)) data.analystRecommendationMean = financial.recommendationMean;
      if (Number.isFinite(financial.numberOfAnalystOpinions)) data.numberOfAnalystOpinions = financial.numberOfAnalystOpinions;
    }

    await prisma.security.update({
      where: { id: securityId },
      data,
    });
  } catch {
    // Silently ignore — profile data is non-critical
  }
}

// --------------- Yahoo Finance search + auto-create ---------------

export interface YahooSearchResult {
  yahooSymbol: string;
  symbol: string;
  exchange: string;
  name: string;
  quoteType: string;
  currency: string;
}

/** Map Yahoo exchange codes back to our exchange enum values */
function mapYahooExchange(
  yahooExchange: string,
  yahooSymbol: string,
): { symbol: string; exchange: string } {
  if (yahooSymbol.endsWith(".TO")) {
    return { symbol: yahooSymbol.replace(".TO", ""), exchange: "TSX" };
  }
  if (yahooSymbol.endsWith(".NE")) {
    return { symbol: yahooSymbol.replace(".NE", ""), exchange: "NEO" };
  }
  if (["NMS", "NGM", "NCM"].includes(yahooExchange)) {
    return { symbol: yahooSymbol, exchange: "NASDAQ" };
  }
  if (["NYQ", "NYS"].includes(yahooExchange)) {
    return { symbol: yahooSymbol, exchange: "NYSE" };
  }
  if (["CBO", "BZX"].includes(yahooExchange)) {
    return { symbol: yahooSymbol, exchange: "CBOE" };
  }
  return { symbol: yahooSymbol, exchange: "OTHER" };
}

/** Infer asset class from quoteType + exchange */
function inferAssetClass(
  quoteType: string,
  exchange: string,
): AssetClass {
  const isCanadian = ["TSX", "NEO"].includes(exchange);
  if (quoteType === "ETF") return "ETF";
  if (isCanadian) return "CANADIAN_EQUITY";
  return "US_EQUITY";
}

/**
 * Search Yahoo Finance for securities matching query.
 * Returns mapped results with our exchange codes.
 */
export async function searchYahooAction(
  query: string,
): Promise<YahooSearchResult[]> {
  await requireAuth();
  if (!query || query.length < 2) return [];

  try {
    const yf = new (
      YahooFinance as unknown as new (
        opts?: object,
      ) => InstanceType<typeof YahooFinance>
    )({ suppressNotices: ["yahooSurvey"] });

    const results = await yf.search(query, {
      quotesCount: 8,
      newsCount: 0,
    });

    return (results.quotes ?? [])
      .filter(
        (q): q is typeof q & { quoteType: string; exchange: string; symbol: string } =>
          "quoteType" in q &&
          "exchange" in q &&
          typeof q.symbol === "string" &&
          ["EQUITY", "ETF"].includes((q as { quoteType: string }).quoteType),
      )
      .map((q) => {
        const mapped = mapYahooExchange(q.exchange, q.symbol);
        const currency = ["TSX", "NEO"].includes(mapped.exchange) ? "CAD" : "USD";
        return {
          yahooSymbol: q.symbol,
          symbol: mapped.symbol,
          exchange: mapped.exchange,
          name:
            ("longname" in q && (q as { longname: string }).longname) ||
            ("shortname" in q && (q as { shortname: string }).shortname) ||
            q.symbol,
          quoteType: q.quoteType,
          currency,
        };
      });
  } catch {
    return [];
  }
}

/**
 * Find an existing security by symbol+exchange, or create it from Yahoo data.
 * Returns the securityId.
 */
export async function findOrCreateSecurityAction(data: {
  symbol: string;
  exchange: string;
  name: string;
  quoteType: string;
  currency: string;
}): Promise<{ securityId: string; error?: string }> {
  await requireAuth();

  const existing = await prisma.security.findUnique({
    where: {
      symbol_exchange: { symbol: data.symbol, exchange: data.exchange },
    },
  });
  if (existing) return { securityId: existing.id };

  const assetClass = inferAssetClass(data.quoteType, data.exchange);

  const security = await prisma.security.create({
    data: {
      symbol: data.symbol,
      exchange: data.exchange,
      name: data.name,
      currency: data.currency,
      assetClass,
      dataSource: "YAHOO",
    },
  });

  // Fire-and-forget: fetch profile data from Yahoo in the background
  fetchAndStoreYahooProfile(security.id, toYahooSymbol(data.symbol, data.exchange)).catch(() => {});

  return { securityId: security.id };
}
