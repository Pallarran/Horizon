"use client";

import { useTranslations } from "next-intl";
import { formatPercent } from "@/lib/money/format";
import type { DayMoversData } from "@/lib/dashboard/day-movers";

interface DayMoversStripProps {
  locale: string;
  movers: DayMoversData;
}

/**
 * Day movers demoted to a one-line strip — daily ticker noise stays available
 * without competing for attention against a buy-and-hold dividend plan.
 */
export function DayMoversStrip({ locale, movers }: DayMoversStripProps) {
  const t = useTranslations("dashboard");

  const gainer = movers.gainers[0];
  const loser = movers.losers[0];
  const hasData = Boolean(gainer || loser);

  return (
    <div className="flex items-center gap-4 rounded-xl border bg-card px-[18px] py-3.5 text-xs shadow-sm">
      <span className="font-medium text-muted-foreground">{t("today")}</span>

      {!hasData ? (
        <span className="text-muted-foreground">{t("noMovers")}</span>
      ) : (
        <div className="flex flex-1 items-center justify-center gap-8">
          {gainer && (
            <span className="tabular-nums">
              <span className="font-semibold">{gainer.symbol}</span>{" "}
              <span className="font-semibold text-gain">
                +{formatPercent(gainer.changePercent, locale)}
              </span>
            </span>
          )}
          {loser && (
            <span className="tabular-nums">
              <span className="font-semibold">{loser.symbol}</span>{" "}
              <span className="font-semibold text-loss">
                {formatPercent(loser.changePercent, locale)}
              </span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
