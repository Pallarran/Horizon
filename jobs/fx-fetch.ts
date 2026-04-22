/**
 * Nightly FX rate fetch — pulls USD/CAD exchange rate from Yahoo Finance.
 *
 * Runs at 23:05 ET daily.
 */
import YahooFinance from "yahoo-finance2";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pino from "pino";

const log = pino({ name: "fx-fetch" });
const yf = new (YahooFinance as unknown as new (opts?: object) => InstanceType<typeof YahooFinance>)({ suppressNotices: ["yahooSurvey"] });

function createPrisma() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
}

const FX_PAIRS = [
  { from: "USD", to: "CAD", yahooSymbol: "USDCAD=X" },
  { from: "CAD", to: "USD", yahooSymbol: "CADUSD=X" },
];

export async function fetchFxRates() {
  const prisma = createPrisma();

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let fetched = 0;
    let errors = 0;

    for (const pair of FX_PAIRS) {
      try {
        const quote = await yf.quote(pair.yahooSymbol);

        if (!quote || !quote.regularMarketPrice) {
          log.warn({ pair: pair.yahooSymbol }, "No FX rate returned");
          errors++;
          continue;
        }

        const rate = quote.regularMarketPrice;

        // Sanity check: USD/CAD should be between 0.5 and 3.0
        if (rate < 0.1 || rate > 10) {
          log.warn({ pair: pair.yahooSymbol, rate }, "FX rate out of range, rejected");
          errors++;
          continue;
        }

        await prisma.fxRate.upsert({
          where: {
            fromCurrency_toCurrency_date: {
              fromCurrency: pair.from,
              toCurrency: pair.to,
              date: today,
            },
          },
          create: {
            fromCurrency: pair.from,
            toCurrency: pair.to,
            date: today,
            rate,
            source: "yahoo",
          },
          update: { rate, source: "yahoo" },
        });

        fetched++;
        log.info({ pair: `${pair.from}/${pair.to}`, rate }, "FX rate fetched");
      } catch (err) {
        log.error({ pair: pair.yahooSymbol, err }, "Failed to fetch FX rate");
        errors++;
      }
    }

    log.info({ fetched, errors }, "FX fetch complete");
    return { fetched, errors };
  } finally {
    await prisma.$disconnect();
  }
}

// Allow running standalone
if (require.main === module) {
  fetchFxRates().catch(console.error);
}
