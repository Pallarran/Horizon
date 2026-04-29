/**
 * Jobs entry point — schedules cron tasks.
 *
 * Schedule (America/Toronto):
 *   10:00, 12:00, 14:00, 16:00, 23:00 Mon-Fri — Price + FX fetch
 *   02:00 Daily — Database backup
 *
 * Run: npx tsx jobs/index.ts
 */
import "dotenv/config";
import cron from "node-cron";
import pino from "pino";
import { fetchPrices } from "./price-fetch";
import { fetchFxRates } from "./fx-fetch";
import { runBackup } from "./backup";

const log = pino({ name: "jobs" });

const TZ = "America/Toronto";

// Price + FX fetch: every 2h during market hours + EOD, Mon-Fri
for (const time of ["0 10", "0 12", "0 14", "0 16", "0 23"]) {
  cron.schedule(`${time} * * 1-5`, async () => {
    log.info("Starting price + FX fetch");
    try {
      const [prices, fx] = await Promise.all([fetchPrices(), fetchFxRates()]);
      log.info({ prices, fx }, "Price + FX fetch finished");
    } catch (err) {
      log.error({ err }, "Price + FX fetch failed");
    }
  }, { timezone: TZ });
}

// Backup: 02:00 daily
cron.schedule("0 2 * * *", async () => {
  log.info("Starting nightly backup");
  try {
    const result = await runBackup();
    log.info(result, "Backup finished");
  } catch (err) {
    log.error({ err }, "Backup failed");
  }
}, { timezone: TZ });

log.info("Job scheduler started. Waiting for scheduled tasks...");
log.info({
  pricesAndFx: "10:00, 12:00, 14:00, 16:00, 23:00 Mon-Fri ET",
  backup: "02:00 daily ET",
}, "Schedule");
