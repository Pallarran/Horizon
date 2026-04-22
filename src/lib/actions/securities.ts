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

  return { securityId: security.id };
}
