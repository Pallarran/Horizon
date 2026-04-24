"use client";

import { formatMoney } from "@/lib/money/format";

export function DetailRow({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: "gain" | "loss";
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-right">
        <span
          className={`text-sm font-medium tabular-nums ${
            color === "gain"
              ? "text-gain"
              : color === "loss"
                ? "text-loss"
                : ""
          }`}
        >
          {value}
        </span>
        {sub && (
          <p
            className={`text-[10px] tabular-nums ${
              color === "gain"
                ? "text-gain"
                : color === "loss"
                  ? "text-loss"
                  : "text-muted-foreground"
            }`}
          >
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

export function formatCompactMoney(cents: number, locale: string): string {
  const value = cents / 100;
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(1)}T`;
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  return formatMoney(cents, locale);
}

export function formatDate(isoString: string, locale: string): string {
  return new Date(isoString).toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function recommendationLabel(
  mean: number,
  t: (key: string) => string,
): string {
  if (mean <= 1.5) return t("strongBuy");
  if (mean <= 2.5) return t("buy");
  if (mean <= 3.5) return t("hold");
  if (mean <= 4.5) return t("sell");
  return t("strongSell");
}

export function recommendationColor(mean: number): string {
  if (mean <= 1.5) return "text-gain";
  if (mean <= 2.5) return "text-gain";
  if (mean <= 3.5) return "text-muted-foreground";
  return "text-loss";
}

export function payoutRatioColor(ratio: number): string {
  if (ratio < 0.6) return "text-gain";
  if (ratio < 0.8) return "text-amber-600 dark:text-amber-400";
  return "text-loss";
}
