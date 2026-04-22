/**
 * Format cents as a currency string respecting user locale.
 * All money is stored as BigInt cents internally.
 */
export function formatMoney(
  cents: bigint | number,
  locale: string = "fr-CA",
  currency: string = "CAD",
): string {
  const dollars = Number(cents) / 100;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

/**
 * Format a number as a percentage.
 */
export function formatPercent(
  value: number,
  locale: string = "fr-CA",
  decimals: number = 2,
): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format a number with locale-appropriate grouping.
 */
export function formatNumber(
  value: number,
  locale: string = "fr-CA",
  decimals: number = 2,
): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Parse a dollar string to cents (BigInt).
 * Accepts "1,234.56" or "1 234,56" depending on locale.
 */
export function parseDollarsToCents(input: string): bigint {
  // Remove currency symbols, spaces, and normalize decimal separator
  const cleaned = input
    .replace(/[^0-9.,\-]/g, "")
    .replace(/\s/g, "")
    .replace(",", ".");
  const dollars = parseFloat(cleaned);
  if (isNaN(dollars)) throw new Error(`Cannot parse "${input}" as money`);
  return BigInt(Math.round(dollars * 100));
}
