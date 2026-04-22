"use client";

import { useTranslations } from "next-intl";
import { formatMoney, formatPercent } from "@/lib/money/format";
import type { DividendsSummaryData } from "@/lib/dashboard/dividends-summary";
import { Separator } from "@/components/ui/separator";

interface DividendsSummaryCardProps {
  locale: string;
  dividends: DividendsSummaryData;
}

export function DividendsSummaryCard({ locale, dividends }: DividendsSummaryCardProps) {
  const t = useTranslations("dashboard");

  const growthPositive = dividends.ytdGrowthPercent >= 0;

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <p className="text-sm font-medium">{t("dividends")}</p>

      <p className="mt-3 text-3xl font-bold">
        {formatMoney(dividends.annualizedCents, locale)}
      </p>
      <p className="text-xs text-muted-foreground">{t("annualized")}</p>

      <Separator className="my-4" />

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("monthlyAvg")}</span>
          <span className="font-medium">
            {formatMoney(dividends.monthlyAvgCents, locale)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("ytd")}</span>
          <span className="font-medium">
            {formatMoney(dividends.ytdCents, locale)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("priorYear")}</span>
          <span className="font-medium">
            {formatMoney(dividends.priorYearCents, locale)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">YoY</span>
          <span className={`font-medium ${growthPositive ? "text-gain" : "text-loss"}`}>
            {growthPositive ? "+" : ""}
            {formatPercent(dividends.ytdGrowthPercent, locale)}
          </span>
        </div>
      </div>
    </div>
  );
}
