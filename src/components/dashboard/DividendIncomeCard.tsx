"use client";

import { useTranslations } from "next-intl";
import { formatMoney, formatPercent } from "@/lib/money/format";
import type { DividendsSummaryData } from "@/lib/dashboard/dividends-summary";
import type { DividendForecastData } from "@/lib/dashboard/dividend-forecast";
import type { TopYieldersData } from "@/lib/dashboard/top-yielders";
import { Separator } from "@/components/ui/separator";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface DividendIncomeCardProps {
  locale: string;
  dividends: DividendsSummaryData;
  forecast: DividendForecastData;
  yielders: TopYieldersData;
}

/**
 * Promoted dividend-income card — the core retirement strategy front and centre:
 * annualized total, YTD pace, 12-month forecast, and top yielders unified.
 */
export function DividendIncomeCard({ locale, dividends, forecast, yielders }: DividendIncomeCardProps) {
  const t = useTranslations("dashboard");

  const hasData = dividends.annualizedCents > 0;
  const growthPositive = dividends.ytdGrowthPercent >= 0;

  const pacingPct =
    dividends.expectedYtdCents > 0
      ? Math.round((dividends.ytdCents / dividends.expectedYtdCents) * 100)
      : 0;
  const pacingOnTrack = pacingPct >= 100;
  const ytdProgressPct =
    dividends.annualizedCents > 0
      ? Math.min(100, Math.round((dividends.ytdCents / dividends.annualizedCents) * 100))
      : 0;

  const forecastChartData = forecast.months.map((m) => ({
    label: m.label,
    dollars: m.totalCents / 100,
    totalCents: m.totalCents,
    isCurrentMonth: m.isCurrentMonth,
  }));

  const topThree = yielders.yielders.slice(0, 3);

  return (
    <div className="rounded-xl border bg-card p-[22px] shadow-sm">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold">{t("dividendIncomeTitle")}</p>
        {hasData && (
          <span className={`text-xs font-semibold ${growthPositive ? "text-gain" : "text-loss"}`}>
            {growthPositive ? "+" : ""}
            {formatPercent(dividends.ytdGrowthPercent, locale)} {t("yoy")}
          </span>
        )}
      </div>

      {!hasData ? (
        <p className="mt-3 text-sm text-muted-foreground">{t("noForecastData")}</p>
      ) : (
        <>
          <p className="mt-2.5 text-[32px] font-extrabold leading-none tracking-tight tabular-nums">
            {formatMoney(dividends.annualizedCents, locale)}
            <span className="text-[15px] font-semibold text-muted-foreground">{t("perYear")}</span>
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t("annualized")} · {formatMoney(dividends.monthlyAvgCents, locale)}
            {t("perMonth")} {t("average")}
          </p>

          {/* YTD pace */}
          <div className="mb-1.5 mt-3.5 flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">
              {t("ytd")} {formatMoney(dividends.ytdCents, locale)}
            </span>
            {dividends.expectedYtdCents > 0 && (
              <span className={`font-semibold ${pacingOnTrack ? "text-gain" : "text-muted-foreground"}`}>
                {t("ofPace", { pct: pacingPct })}
              </span>
            )}
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${ytdProgressPct}%` }}
            />
          </div>

          {/* 12-month forecast */}
          <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("next12Months")}
          </p>
          <div className="h-[70px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forecastChartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={false} tickLine={false} axisLine={false} height={0} />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  formatter={(_value, _name, item) => [
                    formatMoney((item.payload as Record<string, number>).totalCents, locale),
                  ]}
                  labelFormatter={(label) => String(label)}
                  contentStyle={{
                    backgroundColor: "var(--popover)",
                    borderColor: "var(--border)",
                    color: "var(--popover-foreground)",
                    borderRadius: "0.5rem",
                  }}
                />
                <Bar dataKey="dollars" radius={[3, 3, 0, 0]}>
                  {forecastChartData.map((entry, index) => (
                    <Cell key={index} fill={entry.isCurrentMonth ? "var(--chart-1)" : "var(--chart-2)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top yielders */}
          {topThree.length > 0 && (
            <>
              <Separator className="my-4" />
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("topYieldersLabel")}
              </p>
              <div className="space-y-1.5 text-sm">
                {topThree.map((y) => (
                  <div key={y.symbol} className="flex items-baseline justify-between gap-2">
                    <span className="flex min-w-0 items-baseline gap-1.5">
                      <span className="font-semibold">{y.symbol}</span>
                      <span className="truncate text-xs text-muted-foreground">{y.name}</span>
                    </span>
                    <span className="shrink-0 font-semibold text-gain">
                      {formatPercent(y.yieldOnCostPercent, locale)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
