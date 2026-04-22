/**
 * Jobs entry point — schedules nightly cron tasks.
 *
 * Schedule (America/Toronto):
 *   23:00 Mon-Fri  — Price fetch (EOD)
 *   23:05 Daily    — FX rate fetch
 *   02:00 Daily    — Database backup
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

// Price fetch: 23:00 Mon-Fri
cron.schedule("0 23 * * 1-5", async () => {
  log.info("Starting nightly price fetch");
  try {
    const result = await fetchPrices();
    log.info(result, "Price fetch finished");
  } catch (err) {
    log.error({ err }, "Price fetch failed");
  }
}, { timezone: TZ });

// FX rate fetch: 23:05 daily
cron.schedule("5 23 * * *", async () => {
  log.info("Starting nightly FX fetch");
  try {
    const result = await fetchFxRates();
    log.info(result, "FX fetch finished");
  } catch (err) {
    log.error({ err }, "FX fetch failed");
  }
}, { timezone: TZ });

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
  prices: "23:00 Mon-Fri ET",
  fx: "23:05 daily ET",
  backup: "02:00 daily ET",
}, "Schedule");
