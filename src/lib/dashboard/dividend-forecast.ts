/**
 * Dividend forecast — projects expected dividend income per month
 * for the next 12 months, using actual transaction history to determine
 * payment months and current position income for amounts.
 */
import type { ScopedPrisma } from "@/lib/db/scoped";
import type { ComputedPosition } from "@/lib/positions/types";
import { convertCurrency } from "@/lib/money/arithmetic";

export interface ForecastMonth {
  /** Calendar month 0-11 */
  month: number;
  /** Calendar year */
  year: number;
  /** Short month label, e.g. "May" */
  label: string;
  /** Aggregated expected income for this month (CAD cents) */
  totalCents: number;
  /** Whether this is the current calendar month */
  isCurrentMonth: boolean;
}

export interface DividendForecastData {
  /** 12 entries starting from the current month */
  months: ForecastMonth[];
  /** Sum of all 12 months (CAD cents) */
  annualTotalCents: number;
}

/**
 * Compute a 12-month forward dividend forecast.
 *
 * 1. Query DIVIDEND transactions from the last 18 months to learn payment patterns
 * 2. For each held position with expected income, distribute income across payment months
 * 3. Aggregate per calendar month for the next 12 months
 */
export async function computeDividendForecast(
  db: ScopedPrisma,
  positions: ComputedPosition[],
  usdCadRate: number,
  locale: string = "en-CA",
): Promise<DividendForecastData> {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // 1. Query recent DIVIDEND transactions to discover payment months per security
  const cutoff = new Date(currentYear - 1, currentMonth - 6, 1); // ~18 months ago
  const dividendTxns = await db.transaction.findMany({
    where: {
      type: "DIVIDEND",
      date: { gte: cutoff },
    },
    select: { securityId: true, date: true },
  });

  // Group by securityId → month occurrence counts (0-11 → count)
  const paymentCountsBySecurityId = new Map<string, Map<number, number>>();
  for (const txn of dividendTxns) {
    if (!txn.securityId) continue;
    let counts = paymentCountsBySecurityId.get(txn.securityId);
    if (!counts) {
      counts = new Map();
      paymentCountsBySecurityId.set(txn.securityId, counts);
    }
    const m = txn.date.getMonth();
    counts.set(m, (counts.get(m) ?? 0) + 1);
  }

  // 2. Build a 12-month bucket (indexed 0-11 from current month forward)
  const buckets = new Array<number>(12).fill(0);

  for (const pos of positions) {
    if (pos.quantity <= 0 || !pos.expectedIncomeCents || pos.expectedIncomeCents <= 0n) {
      continue;
    }

    // Convert to CAD
    const annualCad =
      pos.currency === "USD"
        ? Number(convertCurrency(pos.expectedIncomeCents, usdCadRate))
        : Number(pos.expectedIncomeCents);

    // Determine payment months for this security
    const historicalCounts = paymentCountsBySecurityId.get(pos.securityId);
    const payMonths = historicalCounts && historicalCounts.size > 0
      ? resolvePaymentMonths(historicalCounts, pos.dividendFrequency)
      : getDefaultPaymentMonths(pos.dividendFrequency);

    const perPayment = annualCad / payMonths.length;

    // Assign income to the 12-month forward window
    for (const payMonth of payMonths) {
      const offset = (payMonth - currentMonth + 12) % 12;
      buckets[offset] += perPayment;
    }
  }

  // 3. Build output with locale-aware month labels
  const monthFmt = new Intl.DateTimeFormat(locale, { month: "short" });
  const months: ForecastMonth[] = buckets.map((totalCents, i) => {
    const m = (currentMonth + i) % 12;
    const y = currentYear + Math.floor((currentMonth + i) / 12);
    return {
      month: m,
      year: y,
      label: monthFmt.format(new Date(y, m, 1)),
      totalCents: Math.round(totalCents),
      isCurrentMonth: i === 0,
    };
  });

  const annualTotalCents = months.reduce((sum, m) => sum + m.totalCents, 0);

  return { months, annualTotalCents };
}

/**
 * Resolve observed payment months to expected count.
 * When date drift causes more observed months than the frequency implies
 * (e.g., 5 months for a quarterly payer), keep only the top N by occurrence count.
 */
function resolvePaymentMonths(
  counts: Map<number, number>,
  frequency: string | null,
): number[] {
  const expectedCount = getExpectedPaymentCount(frequency, counts.size);
  if (counts.size <= expectedCount) {
    return [...counts.keys()];
  }
  // Keep the N months with the highest occurrence count
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, expectedCount)
    .map(([month]) => month);
}

function getExpectedPaymentCount(frequency: string | null, observedCount: number): number {
  switch (frequency) {
    case "monthly": return 12;
    case "semi-annual": return 2;
    case "annual": return 1;
    case "quarterly": return 4;
    default:
      // No frequency info: infer from observed (don't correct)
      return observedCount;
  }
}

/** Default payment months when no transaction history exists. */
function getDefaultPaymentMonths(frequency: string | null): number[] {
  switch (frequency) {
    case "monthly":
      return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    case "semi-annual":
      return [5, 11]; // Jun, Dec
    case "annual":
      return [11]; // Dec
    case "quarterly":
    default:
      return [0, 3, 6, 9]; // Jan, Apr, Jul, Oct
  }
}

