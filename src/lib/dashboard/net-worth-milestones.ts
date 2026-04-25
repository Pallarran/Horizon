/**
 * Net worth milestone tracking — progress toward $100K increments.
 *
 * Uses an IRR-like estimation to reconstruct historical portfolio values
 * from transaction capital flows, then walks the curve to find when
 * each $100K milestone was first crossed.
 */
import type { ScopedPrisma } from "@/lib/db/scoped";
import type { PortfolioHistoryPoint } from "./portfolio-history";

/** $100K in cents */
const STEP = 10_000_000;

// ---------------------------------------------------------------------------
// Tier / league system
// ---------------------------------------------------------------------------

export type TierName =
  | "iron"
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "emerald"
  | "diamond"
  | "master"
  | "grandmaster"
  | "challenger";

export interface MilestoneTier {
  name: TierName;
  /** Lower bound in cents */
  thresholdCents: number;
}

const TIERS: MilestoneTier[] = [
  { name: "challenger",   thresholdCents: 500_000_000 },  // $5M
  { name: "grandmaster",  thresholdCents: 300_000_000 },  // $3M
  { name: "master",       thresholdCents: 200_000_000 },  // $2M
  { name: "diamond",      thresholdCents: 150_000_000 },  // $1.5M
  { name: "emerald",      thresholdCents: 100_000_000 },  // $1M
  { name: "platinum",     thresholdCents:  75_000_000 },  // $750K
  { name: "gold",         thresholdCents:  50_000_000 },  // $500K
  { name: "silver",       thresholdCents:  25_000_000 },  // $250K
  { name: "bronze",       thresholdCents:  10_000_000 },  // $100K
  { name: "iron",         thresholdCents:           0 },  // $0
];

export function computeTier(netWorthCents: number): { current: MilestoneTier; next: MilestoneTier | null } {
  for (let i = 0; i < TIERS.length; i++) {
    if (netWorthCents >= TIERS[i].thresholdCents) {
      return { current: TIERS[i], next: i > 0 ? TIERS[i - 1] : null };
    }
  }
  return { current: TIERS[TIERS.length - 1], next: TIERS[TIERS.length - 2] };
}

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
  /** Current tier based on net worth */
  tier: MilestoneTier;
  /** Next tier to reach, or null if at max */
  nextTier: MilestoneTier | null;
}

export function computeNetWorthMilestones(
  currentNetWorthCents: number,
  portfolioHistory: PortfolioHistoryPoint[],
  passedMilestones: PassedMilestone[],
  /** Contribution-adjusted annualized growth rate from IRR, or null */
  irrGrowthRate: number | null,
): MilestoneProgressData {
  // Floor and ceiling
  const floor = Math.max(0, Math.floor(currentNetWorthCents / STEP) * STEP);
  const ceiling = floor + STEP;
  const progress =
    currentNetWorthCents <= 0
      ? 0
      : Math.min(1, Math.max(0, (currentNetWorthCents - floor) / STEP));

  // Use IRR-based rate (contribution-adjusted) if available, else fall back to naive trailing
  const trailingGrowthRate = irrGrowthRate ?? computeTrailingGrowth(portfolioHistory);

  // Tier
  const { current: tier, next: nextTier } = computeTier(currentNetWorthCents);

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
    tier,
    nextTier,
  };
}

// ---------------------------------------------------------------------------
// IRR-based milestone estimation
// ---------------------------------------------------------------------------

interface MonthlyFlow {
  /** Month offset from the earliest transaction (0-based) */
  monthOffset: number;
  /** Year of this month */
  year: number;
  /** Month (0-based) of this month */
  month: number;
  /** Net capital flow in cents (positive = money into portfolio) */
  flowCents: number;
}

/**
 * Estimate when each $100K milestone was first crossed by reconstructing
 * a historical portfolio value curve from transaction capital flows.
 *
 * Uses a modified IRR (bisection) to find the implied monthly growth rate,
 * then walks the estimated value curve month-by-month.
 */
export interface MilestoneEstimation {
  milestones: PassedMilestone[];
  /** Annualized growth rate from IRR (contribution-adjusted), or null */
  annualizedGrowthRate: number | null;
}

export async function estimatePassedMilestones(
  db: ScopedPrisma,
  currentNetWorthCents: number,
  portfolioHistory: PortfolioHistoryPoint[],
): Promise<MilestoneEstimation> {
  if (currentNetWorthCents <= 0) return { milestones: [], annualizedGrowthRate: null };

  const currentLevel = Math.floor(currentNetWorthCents / STEP);
  if (currentLevel <= 0) return { milestones: [], annualizedGrowthRate: null };

  // 1. Fetch all BUY/SELL transactions (external capital flows only)
  const transactions = await db.transaction.findMany({
    where: { type: { in: ["BUY", "SELL"] } },
    orderBy: { date: "asc" },
    select: { date: true, type: true, amountCents: true },
  });

  // Fallback: not enough transaction data — use portfolioHistory walk
  if (transactions.length < 2) {
    return {
      milestones: fallbackFromHistory(portfolioHistory, currentNetWorthCents),
      annualizedGrowthRate: null,
    };
  }

  // 2. Convert transactions to monthly capital flows
  const firstDate = transactions[0].date;
  const firstYear = firstDate.getFullYear();
  const firstMonth = firstDate.getMonth();

  const flowMap = new Map<number, number>(); // monthOffset → total flow cents

  for (const txn of transactions) {
    const d = txn.date;
    const offset =
      (d.getFullYear() - firstYear) * 12 + (d.getMonth() - firstMonth);
    // BUY: amountCents < 0 → negate → positive (money into portfolio)
    // SELL: amountCents > 0 → negate → negative (money out of portfolio)
    const flow = -Number(txn.amountCents);
    flowMap.set(offset, (flowMap.get(offset) ?? 0) + flow);
  }

  // Build sorted array of monthly flows
  const monthlyFlows: MonthlyFlow[] = [];
  for (const [offset, flowCents] of flowMap) {
    const year = firstYear + Math.floor((firstMonth + offset) / 12);
    const month = (firstMonth + offset) % 12;
    monthlyFlows.push({ monthOffset: offset, year, month, flowCents });
  }
  monthlyFlows.sort((a, b) => a.monthOffset - b.monthOffset);

  // 3. Find current month offset
  const now = new Date();
  const totalMonths =
    (now.getFullYear() - firstYear) * 12 + (now.getMonth() - firstMonth);

  if (totalMonths <= 0) {
    return {
      milestones: fallbackFromHistory(portfolioHistory, currentNetWorthCents),
      annualizedGrowthRate: null,
    };
  }

  // 4. Bisect for monthly growth rate r
  const monthlyRate = bisectGrowthRate(
    monthlyFlows,
    totalMonths,
    currentNetWorthCents,
  );

  // 5. Reconstruct portfolio value curve month-by-month
  const estimatedValues: Array<{ monthOffset: number; valueCents: number }> =
    [];
  let flowIdx = 0;

  for (let m = 0; m <= totalMonths; m++) {
    // Add any flows that occur at this month
    while (
      flowIdx < monthlyFlows.length &&
      monthlyFlows[flowIdx].monthOffset <= m
    ) {
      flowIdx++;
    }

    // V(m) = Σ flow_i × (1+r)^(m - t_i) for all flows up to month m
    let value = 0;
    for (let i = 0; i < flowIdx; i++) {
      const elapsed = m - monthlyFlows[i].monthOffset;
      value +=
        monthlyFlows[i].flowCents * Math.pow(1 + monthlyRate, elapsed);
    }

    estimatedValues.push({ monthOffset: m, valueCents: Math.max(0, value) });
  }

  // 6. Override with actual portfolioHistory for the last ~12 months
  const historyMap = new Map<string, number>(); // "YYYY-MM" → valueCents
  for (const p of portfolioHistory) {
    const key = p.date.slice(0, 7); // "YYYY-MM"
    historyMap.set(key, p.valueCents);
  }

  for (const est of estimatedValues) {
    const year = firstYear + Math.floor((firstMonth + est.monthOffset) / 12);
    const month = ((firstMonth + est.monthOffset) % 12) + 1;
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const actual = historyMap.get(key);
    if (actual !== undefined) {
      est.valueCents = actual;
    }
  }

  // 7. Walk curve to find milestone crossings
  const passed: PassedMilestone[] = [];
  let highestReached = 0;

  for (const est of estimatedValues) {
    const level = Math.floor(est.valueCents / STEP);
    while (highestReached < level && highestReached < currentLevel) {
      highestReached++;
      const year =
        firstYear + Math.floor((firstMonth + est.monthOffset) / 12);
      const month = ((firstMonth + est.monthOffset) % 12) + 1;
      passed.push({
        thresholdCents: highestReached * STEP,
        dateReached: `${year}-${String(month).padStart(2, "0")}-01`,
      });
    }
  }

  // Account for current net worth crossing milestones not in the curve
  const todayStr = formatDateStr(now);
  while (highestReached < currentLevel) {
    highestReached++;
    passed.push({
      thresholdCents: highestReached * STEP,
      dateReached: todayStr,
    });
  }

  // Annualize the monthly IRR for use in milestone date estimation
  const annualizedGrowthRate = Math.pow(1 + monthlyRate, 12) - 1;

  return { milestones: passed, annualizedGrowthRate };
}

/**
 * Bisect for the monthly growth rate r such that:
 *   Σ flow_i × (1+r)^(T - t_i) ≈ currentNetWorthCents
 */
function bisectGrowthRate(
  flows: MonthlyFlow[],
  totalMonths: number,
  targetValue: number,
): number {
  let lo = -0.03; // ~-30% annualized
  let hi = 0.08; // ~+150% annualized

  const evaluate = (r: number): number => {
    let value = 0;
    for (const f of flows) {
      const elapsed = totalMonths - f.monthOffset;
      value += f.flowCents * Math.pow(1 + r, elapsed);
    }
    return value;
  };

  // Check if solution is in range
  const loVal = evaluate(lo);
  const hiVal = evaluate(hi);

  // If target is outside the range, clamp to the nearest boundary
  if (loVal > targetValue && hiVal > targetValue) return lo;
  if (loVal < targetValue && hiVal < targetValue) return hi;

  // Standard bisection — 60 iterations gives precision to ~1e-18
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const midVal = evaluate(mid);
    if (midVal < targetValue) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return (lo + hi) / 2;
}

/**
 * Fallback: walk portfolioHistory to find milestones (original behavior).
 * Used when transaction data is insufficient for IRR estimation.
 */
function fallbackFromHistory(
  history: PortfolioHistoryPoint[],
  currentCents: number,
): PassedMilestone[] {
  const passed: PassedMilestone[] = [];
  let highestReached = 0;

  for (const point of history) {
    const level = Math.floor(point.valueCents / STEP);
    while (highestReached < level) {
      highestReached++;
      passed.push({
        thresholdCents: highestReached * STEP,
        dateReached: point.date,
      });
    }
  }

  const currentLevel = Math.floor(currentCents / STEP);
  const todayStr = formatDateStr(new Date());
  while (highestReached < currentLevel) {
    highestReached++;
    passed.push({
      thresholdCents: highestReached * STEP,
      dateReached: todayStr,
    });
  }

  return passed;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

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

  return formatDateStr(estimated);
}

function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
