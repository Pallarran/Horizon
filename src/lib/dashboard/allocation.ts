/**
 * Asset allocation computation — groups positions by account type or asset class.
 */
import type { ComputedPosition } from "@/lib/positions/types";
import { convertCurrency } from "@/lib/money/arithmetic";

export interface AllocationSlice {
  key: string;
  valueCents: number;
  percent: number;
}

export interface AllocationData {
  slices: AllocationSlice[];
  totalCents: number;
}

function computeAllocationBy(
  positions: ComputedPosition[],
  usdCadRate: number,
  groupBy: (pos: ComputedPosition) => string,
): AllocationData {
  const byGroup = new Map<string, bigint>();

  for (const pos of positions) {
    if (pos.quantity <= 0 || pos.marketValueCents === null) continue;

    const isUsd = pos.currency === "USD";
    const mvCad = isUsd
      ? convertCurrency(pos.marketValueCents, usdCadRate)
      : pos.marketValueCents;

    const key = groupBy(pos);
    const current = byGroup.get(key) ?? 0n;
    byGroup.set(key, current + mvCad);
  }

  let totalCents = 0n;
  for (const v of byGroup.values()) {
    totalCents += v;
  }

  const slices: AllocationSlice[] = [];
  for (const [key, valueCents] of byGroup) {
    slices.push({
      key,
      valueCents: Number(valueCents),
      percent: Number(totalCents) > 0 ? Number(valueCents) / Number(totalCents) : 0,
    });
  }

  slices.sort((a, b) => b.valueCents - a.valueCents);

  return { slices, totalCents: Number(totalCents) };
}

export function computeAllocation(
  positions: ComputedPosition[],
  usdCadRate: number,
): AllocationData {
  return computeAllocationBy(positions, usdCadRate, (pos) => pos.accountType);
}

export function computeAllocationByAssetClass(
  positions: ComputedPosition[],
  usdCadRate: number,
): AllocationData {
  return computeAllocationBy(positions, usdCadRate, (pos) => pos.assetClass);
}
