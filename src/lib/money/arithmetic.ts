/**
 * Safe BigInt arithmetic for money operations.
 * All operations are in cents to avoid floating-point issues.
 */

/** Add two cent amounts. */
export function addCents(a: bigint, b: bigint): bigint {
  return a + b;
}

/** Subtract cent amounts (a - b). */
export function subtractCents(a: bigint, b: bigint): bigint {
  return a - b;
}

/** Multiply cents by a quantity (Decimal as number). Returns rounded cents. */
export function multiplyCents(cents: bigint, factor: number): bigint {
  return BigInt(Math.round(Number(cents) * factor));
}

/** Divide cents, returning rounded result (banker's rounding). */
export function divideCents(cents: bigint, divisor: number): bigint {
  if (divisor === 0) throw new Error("Division by zero");
  const result = Number(cents) / divisor;
  return BigInt(bankersRound(result));
}

/** Convert cents from one currency to another using an FX rate. */
export function convertCurrency(cents: bigint, fxRate: number): bigint {
  return BigInt(Math.round(Number(cents) * fxRate));
}

/**
 * Banker's rounding (round half to even).
 * This is the rounding method required by PRD §3.4.
 */
function bankersRound(value: number): number {
  const rounded = Math.round(value);
  // If exactly at .5, round to even
  if (Math.abs(value - (rounded - 0.5)) < Number.EPSILON) {
    return rounded % 2 === 0 ? rounded : rounded - 1;
  }
  return rounded;
}

/** Convert BigInt cents to dollars (number) for display. */
export function centsToDollars(cents: bigint): number {
  return Number(cents) / 100;
}

/** Convert dollars (number) to BigInt cents. */
export function dollarsToCents(dollars: number): bigint {
  return BigInt(Math.round(dollars * 100));
}
