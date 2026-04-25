/**
 * Ensures the Price table has ~1 year of historical data for the given
 * securities. On first dashboard load this fetches from Yahoo Finance
 * and stores results; subsequent loads skip (just a quick DB check).
 *
 * Also backfills USD→CAD FX rates for the same period.
 */
import YahooFinance from "yahoo-finance2";
import { prisma } from "@/lib/db/prisma";

const yf = new (
  YahooFinance as unknown as new (
    opts?: object,
  ) => InstanceType<typeof YahooFinance>
)({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

/** Map exchange codes to Yahoo Finance ticker suffix. */
function yahooSymbol(symbol: string, exchange: string): string {
  switch (exchange) {
    case "TSX":
      return `${symbol}.TO`;
    case "NEO":
      return `${symbol}.NE`;
    default:
      return symbol;
  }
}

interface SecurityInfo {
  securityId: string;
  symbol: string;
  exchange: string;
  currency: string;
}

/**
 * Check which securities lack price data going back far enough and
 * backfill from Yahoo Finance. Idempotent — safe to call on every render.
 *
 * Must cover the full range used by generateSnapshotDates() which creates
 * first-of-month dates going back 12 months. We fetch from 13 months ago
 * (1st of month) so portfolio-history always has price data at the first
 * snapshot — preventing an artificial spike from month 1 to month 2.
 */
export async function ensureSparklinePrices(
  securities: SecurityInfo[],
): Promise<void> {
  if (securities.length === 0) return;

  // Align with generateSnapshotDates(): snapshots start at month-12 (1st).
  // Fetch from month-13 (1st) to ensure prices exist before the first snapshot.
  const checkThreshold = new Date();
  checkThreshold.setMonth(checkThreshold.getMonth() - 13);
  checkThreshold.setDate(1);
  checkThreshold.setHours(0, 0, 0, 0);

  const fetchStart = new Date();
  fetchStart.setMonth(fetchStart.getMonth() - 13);
  fetchStart.setDate(1);
  fetchStart.setHours(0, 0, 0, 0);

  // 1. Check earliest price per security
  const securityIds = securities.map((s) => s.securityId);
  const earliestPrices = await prisma.price.groupBy({
    by: ["securityId"],
    where: { securityId: { in: securityIds } },
    _min: { date: true },
  });

  const earliestMap = new Map(
    earliestPrices.map((e) => [e.securityId, e._min.date]),
  );

  // 2. Filter to securities that need backfill
  const needsBackfill = securities.filter((sec) => {
    const earliest = earliestMap.get(sec.securityId);
    // No prices at all, or earliest is more recent than our threshold
    return !earliest || earliest > checkThreshold;
  });

  if (needsBackfill.length === 0) return;

  // 3. Fetch 1 year of daily prices for each missing security
  let hasUsd = false;

  for (const sec of needsBackfill) {
    if (sec.currency === "USD") hasUsd = true;

    try {
      const ySymbol = yahooSymbol(sec.symbol, sec.exchange);
      const result = await yf.chart(ySymbol, {
        period1: fetchStart.toISOString(),
        interval: "1d" as const,
      });

      const quotes = result?.quotes;
      if (!quotes || quotes.length === 0) continue;

      for (const bar of quotes) {
        if (!bar.close || bar.close <= 0 || !bar.date) continue;

        const date = new Date(bar.date);
        date.setHours(0, 0, 0, 0);
        const priceCents = BigInt(Math.round(bar.close * 100));

        await prisma.price.upsert({
          where: {
            securityId_date: { securityId: sec.securityId, date },
          },
          create: {
            securityId: sec.securityId,
            date,
            priceCents,
            source: "yahoo-historical",
          },
          update: { priceCents },
        });
      }

      // Rate limit between securities
      await new Promise((r) => setTimeout(r, 1000));
    } catch {
      // Skip security on error — sparkline will show partial data
      continue;
    }
  }

  // 4. Backfill USD→CAD FX rates if any USD securities exist
  if (hasUsd) {
    await ensureFxRates(fetchStart);
  }
}

/** Backfill USD/CAD FX rates if missing. */
async function ensureFxRates(fetchStart: Date): Promise<void> {
  const earliestFx = await prisma.fxRate.findFirst({
    where: { fromCurrency: "USD", toCurrency: "CAD" },
    orderBy: { date: "asc" },
    select: { date: true },
  });

  if (earliestFx?.date && earliestFx.date <= fetchStart) return;

  try {
    const result = await yf.chart("USDCAD=X", {
      period1: fetchStart.toISOString(),
      interval: "1d" as const,
    });

    const quotes = result?.quotes;
    if (!quotes || quotes.length === 0) return;

    for (const bar of quotes) {
      if (!bar.close || bar.close <= 0 || !bar.date) continue;

      const date = new Date(bar.date);
      date.setHours(0, 0, 0, 0);
      const rate = bar.close;

      // USD → CAD
      await prisma.fxRate.upsert({
        where: {
          fromCurrency_toCurrency_date: {
            fromCurrency: "USD",
            toCurrency: "CAD",
            date,
          },
        },
        create: {
          fromCurrency: "USD",
          toCurrency: "CAD",
          date,
          rate,
          source: "yahoo-historical",
        },
        update: { rate },
      });

      // CAD → USD (inverse)
      await prisma.fxRate.upsert({
        where: {
          fromCurrency_toCurrency_date: {
            fromCurrency: "CAD",
            toCurrency: "USD",
            date,
          },
        },
        create: {
          fromCurrency: "CAD",
          toCurrency: "USD",
          date,
          rate: 1 / rate,
          source: "yahoo-historical",
        },
        update: { rate: 1 / rate },
      });
    }
  } catch {
    // FX backfill failed — sparkline will use fallback rate
  }
}
