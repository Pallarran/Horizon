/**
 * Database backup — pg_dump with rotation.
 *
 * Runs at 02:00 ET daily.
 * Retention: 7 daily, 4 weekly (Sunday), 12 monthly (1st).
 */
import { execSync } from "child_process";
import { existsSync, mkdirSync, readdirSync, unlinkSync, statSync } from "fs";
import { join } from "path";
import pino from "pino";

const log = pino({ name: "backup" });

const BACKUP_DIR = process.env.BACKUP_DIR ?? "./backups";

export async function runBackup() {
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dayOfWeek = now.getDay(); // 0 = Sunday
  const dayOfMonth = now.getDate();

  // Determine backup type
  let type = "daily";
  if (dayOfMonth === 1) type = "monthly";
  else if (dayOfWeek === 0) type = "weekly";

  const filename = `horizon_${type}_${dateStr}.sql.gz`;
  const filepath = join(BACKUP_DIR, filename);

  // Ensure backup directory exists
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
  }

  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error("DATABASE_URL not set");

    log.info({ filename, type }, "Starting backup");

    // pg_dump piped through gzip
    execSync(`pg_dump "${dbUrl}" | gzip > "${filepath}"`, {
      stdio: "pipe",
      timeout: 300_000, // 5 minutes
    });

    const stats = statSync(filepath);
    log.info({ filename, sizeBytes: stats.size }, "Backup complete");

    // Rotate old backups
    rotateBackups();

    return { filename, sizeBytes: stats.size, type };
  } catch (err) {
    log.error({ err }, "Backup failed");
    throw err;
  }
}

function rotateBackups() {
  if (!existsSync(BACKUP_DIR)) return;

  const files = readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("horizon_") && f.endsWith(".sql.gz"))
    .sort()
    .reverse(); // newest first

  const limits: Record<string, number> = {
    daily: 7,
    weekly: 4,
    monthly: 12,
  };

  const counts: Record<string, number> = { daily: 0, weekly: 0, monthly: 0 };

  for (const file of files) {
    const type = file.match(/horizon_(daily|weekly|monthly)_/)?.[1];
    if (!type) continue;

    counts[type]++;
    if (counts[type] > limits[type]) {
      const path = join(BACKUP_DIR, file);
      log.info({ file }, "Rotating old backup");
      unlinkSync(path);
    }
  }
}

// Allow running standalone
if (require.main === module) {
  runBackup().catch(console.error);
}
