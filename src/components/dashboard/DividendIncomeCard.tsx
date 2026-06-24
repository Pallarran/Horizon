"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatMoney, formatPercent } from "@/lib/money/format";
import type { DividendsSummaryData } from "@/lib/dashboard/dividends-summary";
import type { DividendForecastData } from "@/lib/dashboard/dividend-forecast";
import type { DividendHistoryPoint } from "@/lib/dashboard/dividend-history";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface DividendIncomeCardProps {
  locale: string;
  dividends: DividendsSummaryData;
  forecast: DividendForecastData;
  history: DividendHistoryPoint[];
}

/**
 * Promoted dividend-income card — the core retirement strategy front and centre:
 * annualized total, YTD pace, and an income chart toggling between a year-by-year
 * history (default) and the next-12-month forecast.
 */
export function DividendIncomeCard({ locale, dividends, forecast, history }: DividendIncomeCardProps) {
  const t = useTranslations("dashboard");
  const [chartMode, setChartMode] = useState<"year" | "forecast">("year");

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

  const currentYear = new Date().getFullYear();
  // Current-year bar shows the annualized projection (≈ the headline $/yr) rather than
  // the partial actual-YTD total, so the trend reads as growing to the full-year figure.
  const historyByYear = new Map(history.map((h) => [h.year, h.totalCents]));
  historyByYear.set(currentYear, dividends.annualizedCents);
  const historyChartData = [...historyByYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, totalCents]) => ({
      label: year === currentYear ? `${year}*` : String(year),
      dollars: totalCents / 100,
      totalCents,
      isCurrentMonth: year === currentYear,
    }));

  const isYear = chartMode === "year";
  const chartData = isYear ? historyChartData : forecastChartData;

  return (
    <div className="flex flex-col rounded-xl border bg-card p-5 shadow-sm">
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

          {/* Income chart — year-by-year (default) or 12-month forecast */}
          <div className="mb-2 mt-4 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("dividendsReceived")}
            </p>
            <div className="flex gap-0.5 rounded-md bg-muted p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setChartMode("year")}
                className={`rounded px-2.5 py-1 transition-colors ${
                  isYear ? "bg-card font-semibold shadow-sm" : "text-muted-foreground"
                }`}
              >
                {t("dividendByYear")}
              </button>
              <button
                type="button"
                onClick={() => setChartMode("forecast")}
                className={`rounded px-2.5 py-1 transition-colors ${
                  !isYear ? "bg-card font-semibold shadow-sm" : "text-muted-foreground"
                }`}
              >
                {t("dividendForecastShort")}
              </button>
            </div>
          </div>
          <div className="min-h-[108px] flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tick={isYear ? { fontSize: 11 } : false}
                  tickLine={false}
                  axisLine={false}
                  height={isYear ? 16 : 0}
                />
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
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.isCurrentMonth ? "var(--chart-1)" : "var(--chart-2)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            {isYear ? t("annualizedProjectionNote", { year: currentYear }) : t("forecastNote")}
          </p>
        </>
      )}
    </div>
  );
}
