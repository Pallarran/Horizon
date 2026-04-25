"use client";

import { useTranslations } from "next-intl";
import { formatMoney, formatPercent } from "@/lib/money/format";
import type { TopYieldersData } from "@/lib/dashboard/top-yielders";

interface TopYieldersCardProps {
  locale: string;
  yielders: TopYieldersData;
}

export function TopYieldersCard({ locale, yielders }: TopYieldersCardProps) {
  const t = useTranslations("dashboard");

  const hasData = yielders.yielders.length > 0;

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <p className="text-sm font-medium">{t("topYielders")}</p>

      {!hasData && (
        <p className="mt-3 text-sm text-muted-foreground">{t("noYielders")}</p>
      )}

      {hasData && (
        <div className="mt-3 space-y-2">
          {yielders.yielders.map((y) => (
            <div
              key={y.symbol}
              className="flex items-baseline justify-between gap-2 text-sm"
            >
              <div className="flex items-baseline gap-1.5 min-w-0">
                <span className="font-medium shrink-0">{y.symbol}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {y.name}
                </span>
              </div>
              <div className="flex items-baseline gap-2 shrink-0">
                <span className="font-medium text-gain">
                  {formatPercent(y.yieldOnCostPercent, locale)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatMoney(y.annualIncomeCents, locale)}
                  {t("perYear")}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
