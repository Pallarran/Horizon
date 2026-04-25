/**
 * Backfill fxRateAtDate on existing USD transactions.
 *
 * 1. Ensures historical FX rates exist in the FxRate table
 *    (fetches from Yahoo Finance if needed)
 * 2. Sets fxRateAtDate on all USD transactions that are missing it
 *
 * Idempotent — safe to re-run. Run with: npx tsx jobs/backfill-fx-rates.ts
 */
import "dotenv/config";
import YahooFinance from "yahoo-finance2";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pino from "pino";

const log = pino({ name: "backfill-fx-rates" });
const yf = new (YahooFinance as unknown as new (opts?: object) => InstanceType<typeof YahooFinance>)({
  suppressNotices: ["yahooSurvey"],
});

function createPrisma() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
}

/** Binary search for the closest FX rate on or before the target date. */
function findClosestRate(
  sorted: Array<{ time: number; rate: number }>,
  targetTime: number,
): number | null {
  if (sorted.length === 0) return null;

  let lo = 0;
  let hi = sorted.length - 1;
  let result = -1;

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid].time <= targetTime) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  // Exact or earlier date found
  if (result >= 0) return sorted[result].rate;
  // All rates are after this date — use the earliest available
  return sorted[0].rate;
}

export async function backfillFxRates() {
  const prisma = createPrisma();

  try {
    // 1. Find all USD transactions missing fxRateAtDate
    const usdTxns = await prisma.transaction.findMany({
      where: { currency: "USD", fxRateAtDate: null },
      select: { id: true, date: true },
      orderBy: { date: "asc" },
    });

    if (usdTxns.length === 0) {
      log.info("No USD transactions need backfill");
      return { updated: 0, fxRatesFetched: 0 };
    }

    log.info({ count: usdTxns.length }, "USD transactions to backfill");

    // 2. Determine date range needed
    const earliestTxn = usdTxns[0].date;
    const latestTxn = usdTxns[usdTxns.length - 1].date;

    // 3. Check what FX rates we already have
    const existingRates = await prisma.fxRate.findMany({
      where: {
        fromCurrency: "USD",
        toCurrency: "CAD",
        date: { gte: earliestTxn, lte: latestTxn },
      },
      orderBy: { date: "asc" },
    });

    log.info(
      { existing: existingRates.length, from: earliestTxn.toISOString().slice(0, 10), to: latestTxn.toISOString().slice(0, 10) },
      "Existing FX rates in range",
    );

    // 4. If we have gaps, fetch historical rates from Yahoo
    let fxRatesFetched = 0;
    const needsHistorical = existingRates.length === 0 ||
      existingRates[0].date.getTime() > earliestTxn.getTime();

    if (needsHistorical) {
      log.info("Fetching historical USD/CAD rates from Yahoo Finance...");
      try {
        // Fetch from 1 month before earliest transaction to ensure coverage
        const fetchStart = new Date(earliestTxn);
        fetchStart.setMonth(fetchStart.getMonth() - 1);

        const history = await yf.historical("USDCAD=X", {
          period1: fetchStart,
          period2: latestTxn,
          interval: "1d",
        });

        if (history && history.length > 0) {
          for (const bar of history) {
            if (!bar.close || bar.close <= 0) continue;

            const date = new Date(bar.date);
            date.setHours(0, 0, 0, 0);

            // Sanity check
            if (bar.close < 0.5 || bar.close > 3.0) continue;

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
                rate: bar.close,
                source: "yahoo-historical",
              },
              update: {},
            });
            fxRatesFetched++;
          }
          log.info({ fetched: fxRatesFetched }, "Historical FX rates seeded");
        }
      } catch (err) {
        log.error({ err }, "Failed to fetch historical FX rates — will use nearest available");
      }
    }

    // 5. Reload all FX rates (including freshly fetched ones)
    const allRates = await prisma.fxRate.findMany({
      where: { fromCurrency: "USD", toCurrency: "CAD" },
      orderBy: { date: "asc" },
    });

    const sortedRates = allRates.map((r) => ({
      time: r.date.getTime(),
      rate: Number(r.rate),
    }));

    if (sortedRates.length === 0) {
      log.warn("No FX rates available at all — cannot backfill");
      return { updated: 0, fxRatesFetched };
    }

    log.info({ totalRates: sortedRates.length }, "FX rate lookup table ready");

    // 6. Update each transaction with the closest FX rate
    let updated = 0;
    for (const txn of usdTxns) {
      const rate = findClosestRate(sortedRates, txn.date.getTime());
      if (rate === null) continue;

      await prisma.transaction.update({
        where: { id: txn.id },
        data: { fxRateAtDate: rate },
      });
      updated++;
    }

    log.info({ updated, fxRatesFetched }, "Backfill complete");
    return { updated, fxRatesFetched };
  } finally {
    await prisma.$disconnect();
  }
}

// Allow running standalone
if (require.main === module) {
  backfillFxRates().catch(console.error);
}
