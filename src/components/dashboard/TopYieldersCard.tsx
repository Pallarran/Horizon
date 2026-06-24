"use client";

import { useTranslations } from "next-intl";
import { formatPercent } from "@/lib/money/format";
import type { TopYieldersData } from "@/lib/dashboard/top-yielders";

interface TopYieldersCardProps {
  locale: string;
  yielders: TopYieldersData;
}

/**
 * Best-yield positions, ranked by yield on cost. Lives in its own card on the
 * dashboard so the Dividend income card can focus on income trend.
 */
export function TopYieldersCard({ locale, yielders }: TopYieldersCardProps) {
  const t = useTranslations("dashboard");
  const top = yielders.yielders.slice(0, 3);

  return (
    <div className="flex flex-1 flex-col rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold">{t("topYieldersLabel")}</p>
        {yielders.portfolioYieldPercent > 0 && (
          <span className="text-[11px] text-muted-foreground">
            {t("avgYield", { pct: formatPercent(yielders.portfolioYieldPercent, locale) })}
          </span>
        )}
      </div>

      {top.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t("noPositions")}</p>
      ) : (
        <div className="mt-3 flex flex-col justify-center gap-2 text-sm">
          {top.map((y) => (
            <div key={y.symbol} className="flex items-baseline justify-between gap-2">
              <span className="flex min-w-0 items-baseline gap-1.5">
                <span className="font-semibold">{y.symbol}</span>
                <span className="truncate text-xs text-muted-foreground">{y.name}</span>
              </span>
              <span className="shrink-0 font-semibold text-gain">
                {formatPercent(y.yieldPercent, locale)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
