/**
 * Nightly price fetch — pulls EOD close prices from Yahoo Finance
 * for all securities in the database.
 *
 * Runs at 23:00 ET Mon-Fri (after markets close).
 */
import YahooFinance from "yahoo-finance2";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pino from "pino";

const log = pino({ name: "price-fetch" });
const yf = new (YahooFinance as unknown as new (opts?: object) => InstanceType<typeof YahooFinance>)({ suppressNotices: ["yahooSurvey"] });

function createPrisma() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
}

/** Map our exchange codes to Yahoo Finance suffix */
function yahooSymbol(symbol: string, exchange: string): string {
  switch (exchange) {
    case "TSX":
      return `${symbol}.TO`;
    case "NEO":
      return `${symbol}.NE`;
    case "CBOE":
      // CBOE-listed ETFs like IEFA don't need a suffix for Yahoo
      return symbol;
    default:
      // NYSE, NASDAQ — no suffix needed
      return symbol;
  }
}

export async function fetchPrices() {
  const prisma = createPrisma();

  try {
    // Get all securities that use Yahoo as data source
    const securities = await prisma.security.findMany({
      where: { dataSource: "YAHOO" },
    });

    if (securities.length === 0) {
      log.info("No securities to fetch prices for");
      return { fetched: 0, errors: 0 };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let fetched = 0;
    let errors = 0;

    for (const sec of securities) {
      try {
        const ySymbol = yahooSymbol(sec.symbol, sec.exchange);
        const quote = await yf.quote(ySymbol);

        if (!quote || !quote.regularMarketPrice) {
          log.warn({ symbol: sec.symbol, ySymbol }, "No price returned");
          errors++;
          continue;
        }

        const priceCents = BigInt(Math.round(quote.regularMarketPrice * 100));

        // Validate: reject negative or > 10x previous close
        if (priceCents <= 0n) {
          log.warn({ symbol: sec.symbol, price: quote.regularMarketPrice }, "Negative price rejected");
          errors++;
          continue;
        }

        const lastPrice = await prisma.price.findFirst({
          where: { securityId: sec.id },
          orderBy: { date: "desc" },
        });

        if (lastPrice && priceCents > lastPrice.priceCents * 10n) {
          log.warn(
            { symbol: sec.symbol, newPrice: Number(priceCents), lastPrice: Number(lastPrice.priceCents) },
            "Price > 10x previous close, rejected",
          );
          errors++;
          continue;
        }

        await prisma.price.upsert({
          where: {
            securityId_date: { securityId: sec.id, date: today },
          },
          create: {
            securityId: sec.id,
            date: today,
            priceCents,
            source: "yahoo",
          },
          update: { priceCents, source: "yahoo" },
        });

        // Also update Security.annualDividendCents if available from quote
        if (quote.trailingAnnualDividendRate && quote.trailingAnnualDividendRate > 0) {
          await prisma.security.update({
            where: { id: sec.id },
            data: {
              annualDividendCents: BigInt(Math.round(quote.trailingAnnualDividendRate * 100)),
            },
          });
        }

        fetched++;
        log.info({ symbol: sec.symbol, price: quote.regularMarketPrice }, "Price fetched");

        // Rate limit: 1 request per second
        await sleep(1000);
      } catch (err) {
        log.error({ symbol: sec.symbol, err }, "Failed to fetch price");
        errors++;
      }
    }

    log.info({ fetched, errors, total: securities.length }, "Price fetch complete");
    return { fetched, errors };
  } finally {
    await prisma.$disconnect();
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Allow running standalone
if (require.main === module) {
  fetchPrices().catch(console.error);
}
