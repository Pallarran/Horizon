"use client";

import { useTranslations } from "next-intl";
import { formatPercent } from "@/lib/money/format";
import type { DayMoversData } from "@/lib/dashboard/day-movers";

interface DayMoversCardProps {
  locale: string;
  movers: DayMoversData;
}

export function DayMoversCard({ locale, movers }: DayMoversCardProps) {
  const t = useTranslations("dashboard");

  const hasData = movers.gainers.length > 0 || movers.losers.length > 0;

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <p className="text-sm font-medium">{t("dayMovers")}</p>

      {!hasData && (
        <p className="mt-3 text-sm text-muted-foreground">{t("noMovers")}</p>
      )}

      {hasData && (
        <div className="mt-3 grid grid-cols-2 gap-4">
          {movers.gainers[0] && (
            <div className="text-sm">
              <p className="text-xs text-muted-foreground">{t("biggestGain")}</p>
              <p className="mt-1 flex items-baseline gap-1.5">
                <span className="font-medium">{movers.gainers[0].symbol}</span>
                <span className="truncate text-xs text-muted-foreground">{movers.gainers[0].name}</span>
              </p>
              <p className="font-medium text-gain">
                +{formatPercent(movers.gainers[0].changePercent, locale)}
              </p>
            </div>
          )}
          {movers.losers[0] && (
            <div className="text-sm">
              <p className="text-xs text-muted-foreground">{t("biggestLoss")}</p>
              <p className="mt-1 flex items-baseline gap-1.5">
                <span className="font-medium">{movers.losers[0].symbol}</span>
                <span className="truncate text-xs text-muted-foreground">{movers.losers[0].name}</span>
              </p>
              <p className="font-medium text-loss">
                {formatPercent(movers.losers[0].changePercent, locale)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
