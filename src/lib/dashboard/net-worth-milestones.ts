/**
 * Net worth milestone tracking — progress toward $100K increments.
 *
 * Pure computation: takes current net worth + portfolio history,
 * returns progress toward the next milestone, trailing growth rate,
 * estimated date, and a list of milestones already crossed.
 */
import type { PortfolioHistoryPoint } from "./portfolio-history";

/** $100K in cents */
const STEP = 10_000_000;

export interface PassedMilestone {
  /** Milestone value in cents, e.g. 10_000_000 for $100K */
  thresholdCents: number;
  /** ISO date string when the milestone was first crossed */
  dateReached: string;
}

export interface MilestoneProgressData {
  /** Current net worth in cents */
  currentCents: number;
  /** Previous milestone threshold (floor), e.g. $700K = 70_000_000 */
  previousMilestoneCents: number;
  /** Next milestone threshold (ceiling), e.g. $800K = 80_000_000 */
  nextMilestoneCents: number;
  /** Progress 0..1 within the current $100K band */
  progressPercent: number;
  /** Estimated ISO date to reach next milestone, or null */
  estimatedDate: string | null;
  /** Trailing 12-month annualized growth rate (decimal, e.g. 0.15 = 15%) */
  trailingGrowthRate: number | null;
  /** Milestones already passed, oldest first */
  passedMilestones: PassedMilestone[];
}

export function computeNetWorthMilestones(
  currentNetWorthCents: number,
  portfolioHistory: PortfolioHistoryPoint[],
): MilestoneProgressData {
  // Floor and ceiling
  const floor = Math.max(0, Math.floor(currentNetWorthCents / STEP) * STEP);
  const ceiling = floor + STEP;
  const progress =
    currentNetWorthCents <= 0
      ? 0
      : Math.min(1, Math.max(0, (currentNetWorthCents - floor) / STEP));

  // Historical milestones from portfolio history
  const passedMilestones = findPassedMilestones(portfolioHistory, currentNetWorthCents);

  // Trailing growth rate
  const trailingGrowthRate = computeTrailingGrowth(portfolioHistory);

  // Estimated date to next milestone
  const estimatedDate = computeEstimatedDate(
    currentNetWorthCents,
    ceiling,
    trailingGrowthRate,
  );

  return {
    currentCents: currentNetWorthCents,
    previousMilestoneCents: floor,
    nextMilestoneCents: ceiling,
    progressPercent: progress,
    estimatedDate,
    trailingGrowthRate,
    passedMilestones,
  };
}

/**
 * Walk portfolio history chronologically, tracking the highest
 * $100K milestone crossed and recording first-crossing dates.
 */
function findPassedMilestones(
  history: PortfolioHistoryPoint[],
  currentCents: number,
): PassedMilestone[] {
  const passed: PassedMilestone[] = [];
  let highestReached = 0;

  for (const point of history) {
    const milestoneLevel = Math.floor(point.valueCents / STEP);
    while (highestReached < milestoneLevel) {
      highestReached++;
      passed.push({
        thresholdCents: highestReached * STEP,
        dateReached: point.date,
      });
    }
  }

  // Also account for current net worth being higher than last history point
  const currentLevel = Math.floor(currentCents / STEP);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  while (highestReached < currentLevel) {
    highestReached++;
    passed.push({
      thresholdCents: highestReached * STEP,
      dateReached: todayStr,
    });
  }

  return passed;
}

/**
 * Compute trailing annualized growth rate from portfolio history.
 * Compares earliest non-zero point to latest point.
 */
function computeTrailingGrowth(
  history: PortfolioHistoryPoint[],
): number | null {
  if (history.length < 2) return null;

  const earliest = history.find((p) => p.valueCents > 0);
  if (!earliest) return null;

  const latest = history[history.length - 1];
  if (latest.valueCents <= 0 || earliest.valueCents <= 0) return null;

  // Calculate months elapsed
  const d1 = new Date(earliest.date);
  const d2 = new Date(latest.date);
  const monthsElapsed =
    (d2.getFullYear() - d1.getFullYear()) * 12 +
    (d2.getMonth() - d1.getMonth());

  if (monthsElapsed < 1) return null;

  // Annualize: (latest/earliest)^(12/months) - 1
  const ratio = latest.valueCents / earliest.valueCents;
  return Math.pow(ratio, 12 / monthsElapsed) - 1;
}

/**
 * Estimate the date to reach the next milestone using trailing growth.
 */
function computeEstimatedDate(
  currentCents: number,
  targetCents: number,
  annualGrowthRate: number | null,
): string | null {
  if (annualGrowthRate === null || annualGrowthRate <= 0) return null;
  if (currentCents <= 0) return null;
  if (currentCents >= targetCents) return null;

  // Monthly growth factor
  const monthlyGrowth = Math.pow(1 + annualGrowthRate, 1 / 12);
  const monthsNeeded = Math.log(targetCents / currentCents) / Math.log(monthlyGrowth);

  const estimated = new Date();
  estimated.setMonth(estimated.getMonth() + Math.ceil(monthsNeeded));

  return `${estimated.getFullYear()}-${String(estimated.getMonth() + 1).padStart(2, "0")}-${String(estimated.getDate()).padStart(2, "0")}`;
}

/**
 * Format cents as a compact milestone label: $100K, $1M, $1.1M, etc.
 */
export function formatMilestone(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) {
    const m = dollars / 1_000_000;
    return m % 1 === 0 ? `${m.toFixed(0)}M$` : `${m.toFixed(1)}M$`;
  }
  const k = dollars / 1_000;
  return `${k.toFixed(0)}K$`;
}
