"use client";

import { useTranslations } from "next-intl";
import { formatPercent } from "@/lib/money/format";
import type { DayMoversData } from "@/lib/dashboard/day-movers";
import { Separator } from "@/components/ui/separator";

interface DayMoversCardProps {
  locale: string;
  movers: DayMoversData;
}

export function DayMoversCard({ locale, movers }: DayMoversCardProps) {
  const t = useTranslations("dashboard");

  const hasData = movers.gainers.length > 0 || movers.losers.length > 0;

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <p className="text-sm font-medium">{t("dayMovers")}</p>

      {!hasData && (
        <p className="mt-4 text-sm text-muted-foreground">{t("noMovers")}</p>
      )}

      {movers.gainers.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-gain">{t("biggestGain")}</p>
          {movers.gainers.map((s) => (
            <div key={s.symbol} className="flex items-center justify-between text-sm">
              <div>
                <span className="font-medium">{s.symbol}</span>
                <span className="ml-2 text-muted-foreground">{s.name}</span>
              </div>
              <span className="font-medium text-gain">
                +{formatPercent(s.changePercent, locale)}
              </span>
            </div>
          ))}
        </div>
      )}

      {movers.gainers.length > 0 && movers.losers.length > 0 && (
        <Separator className="my-4" />
      )}

      {movers.losers.length > 0 && (
        <div className={movers.gainers.length === 0 ? "mt-4 space-y-2" : "space-y-2"}>
          <p className="text-xs font-medium text-loss">{t("biggestLoss")}</p>
          {movers.losers.map((s) => (
            <div key={s.symbol} className="flex items-center justify-between text-sm">
              <div>
                <span className="font-medium">{s.symbol}</span>
                <span className="ml-2 text-muted-foreground">{s.name}</span>
              </div>
              <span className="font-medium text-loss">
                {formatPercent(s.changePercent, locale)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
