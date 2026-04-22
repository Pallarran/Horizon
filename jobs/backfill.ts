/**
 * Historical price backfill — fetches 5 years of daily prices
 * for all securities. Idempotent (upserts by securityId+date).
 *
 * Runs on-demand from admin settings or CLI.
 * Rate limited: 1 request per second per security.
 */
import YahooFinance from "yahoo-finance2";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pino from "pino";

const log = pino({ name: "backfill" });
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
      return symbol;
    default:
      return symbol;
  }
}

export async function backfillPrices(securityIds?: string[]) {
  const prisma = createPrisma();

  try {
    const where = securityIds?.length
      ? { dataSource: "YAHOO" as const, id: { in: securityIds } }
      : { dataSource: "YAHOO" as const };

    const securities = await prisma.security.findMany({ where });

    if (securities.length === 0) {
      log.info("No securities to backfill");
      return { total: 0, fetched: 0, errors: 0 };
    }

    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    fiveYearsAgo.setHours(0, 0, 0, 0);

    let totalInserted = 0;
    let errors = 0;

    for (const sec of securities) {
      try {
        const ySymbol = yahooSymbol(sec.symbol, sec.exchange);
        log.info({ symbol: sec.symbol, ySymbol }, "Backfilling...");

        const history = await yf.historical(ySymbol, {
          period1: fiveYearsAgo,
          interval: "1d",
        });

        if (!history || history.length === 0) {
          log.warn({ symbol: sec.symbol }, "No historical data returned");
          errors++;
          continue;
        }

        let inserted = 0;
        for (const bar of history) {
          if (!bar.close || bar.close <= 0) continue;

          const date = new Date(bar.date);
          date.setHours(0, 0, 0, 0);
          const priceCents = BigInt(Math.round(bar.close * 100));

          await prisma.price.upsert({
            where: {
              securityId_date: { securityId: sec.id, date },
            },
            create: {
              securityId: sec.id,
              date,
              priceCents,
              source: "yahoo-historical",
            },
            update: { priceCents },
          });
          inserted++;
        }

        totalInserted += inserted;
        log.info({ symbol: sec.symbol, days: inserted }, "Backfill complete");

        // Rate limit between securities
        await new Promise((r) => setTimeout(r, 1000));
      } catch (err) {
        log.error({ symbol: sec.symbol, err }, "Backfill failed");
        errors++;
      }
    }

    log.info({ securities: securities.length, totalInserted, errors }, "Backfill job complete");
    return { total: securities.length, fetched: totalInserted, errors };
  } finally {
    await prisma.$disconnect();
  }
}

// Allow running standalone: npx tsx jobs/backfill.ts [securityId...]
if (require.main === module) {
  const ids = process.argv.slice(2);
  backfillPrices(ids.length > 0 ? ids : undefined).catch(console.error);
}
