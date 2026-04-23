/**
 * Yahoo profile backfill — fetches industry, sector, valuation,
 * and other metadata from Yahoo Finance quoteSummary for all
 * securities missing this data.
 *
 * Runs on-demand from admin settings or CLI.
 * Rate limited: 1 request per second per security.
 */
import YahooFinance from "yahoo-finance2";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pino from "pino";

const log = pino({ name: "backfill-yahoo-profile" });
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

export async function backfillYahooProfiles(securityIds?: string[], force = false) {
  const prisma = createPrisma();

  try {
    // When specific IDs or force flag are provided, refresh even if already fetched
    const where = {
      dataSource: "YAHOO" as const,
      ...(securityIds?.length
        ? { id: { in: securityIds } }
        : force ? {} : { yahooProfileFetchedAt: null }),
    };

    const securities = await prisma.security.findMany({ where });

    if (securities.length === 0) {
      log.info("No securities to backfill");
      return { total: 0, updated: 0, skipped: 0, errors: 0 };
    }

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const sec of securities) {
      try {
        const ySymbol = yahooSymbol(sec.symbol, sec.exchange);
        log.info({ symbol: sec.symbol, ySymbol }, "Fetching profile...");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await yf.quoteSummary(ySymbol, {
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

        // assetProfile (skip for ETFs — they typically lack this)
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

        // Check if we got any meaningful data beyond the timestamp
        if (Object.keys(data).length <= 1) {
          log.info({ symbol: sec.symbol }, "No profile data available, skipping");
          skipped++;
        } else {
          await prisma.security.update({ where: { id: sec.id }, data });
          updated++;
          log.info({ symbol: sec.symbol, fields: Object.keys(data).length - 1 }, "Profile updated");
        }

        // Rate limit between securities
        await new Promise((r) => setTimeout(r, 1000));
      } catch (err) {
        log.error({ symbol: sec.symbol, err }, "Profile fetch failed");
        errors++;
      }
    }

    log.info({ total: securities.length, updated, skipped, errors }, "Backfill complete");
    return { total: securities.length, updated, skipped, errors };
  } finally {
    await prisma.$disconnect();
  }
}

// Allow running standalone: npx tsx jobs/backfill-yahoo-profile.ts [securityId...]
if (require.main === module) {
  const ids = process.argv.slice(2);
  backfillYahooProfiles(ids.length > 0 ? ids : undefined).catch(console.error);
}
