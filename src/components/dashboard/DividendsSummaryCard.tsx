"use client";

import { useTranslations } from "next-intl";
import { formatMoney, formatPercent } from "@/lib/money/format";
import type { DividendsSummaryData } from "@/lib/dashboard/dividends-summary";
import type { DividendForecastData } from "@/lib/dashboard/dividend-forecast";
import type { DividendHistoryPoint } from "@/lib/dashboard/dividend-history";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface DividendsSummaryCardProps {
  locale: string;
  dividends: DividendsSummaryData;
  forecast: DividendForecastData;
  history?: DividendHistoryPoint[];
}

export function DividendsSummaryCard({ locale, dividends, forecast, history }: DividendsSummaryCardProps) {
  const t = useTranslations("dashboard");

  const growthPositive = dividends.ytdGrowthPercent >= 0;

  // YTD pacing: are actual dividends on track vs annualized expectation?
  const monthsElapsed = new Date().getMonth() + 1;
  const expectedYtdCents = Math.round(dividends.annualizedCents * (monthsElapsed / 12));
  const pacingPct = expectedYtdCents > 0
    ? Math.round((dividends.ytdCents / expectedYtdCents) * 100)
    : 0;
  const pacingOnTrack = pacingPct >= 100;

  const forecastChartData = forecast.months.map((m) => ({
    label: m.label,
    dollars: m.totalCents / 100,
    totalCents: m.totalCents,
    isCurrentMonth: m.isCurrentMonth,
  }));

  const historyChartData = history?.map((p) => ({
    year: p.year,
    dollars: p.totalCents / 100,
    totalCents: p.totalCents,
  }));

  const hasData = dividends.annualizedCents > 0;
  const hasHistory = historyChartData && historyChartData.length > 0;

  const tooltipStyle = {
    backgroundColor: "var(--popover)",
    borderColor: "var(--border)",
    color: "var(--popover-foreground)",
    borderRadius: "0.5rem",
  };

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <p className="text-sm font-medium">{t("dividends")}</p>

      {!hasData && (
        <p className="mt-3 text-sm text-muted-foreground">{t("noForecastData")}</p>
      )}

      {hasData && (
        <>
          {/* Hero */}
          <p className="mt-3 text-3xl font-bold">
            {formatMoney(dividends.annualizedCents, locale)}
          </p>
          <p className="text-xs text-muted-foreground">{t("annualized")}</p>

          {/* Stats */}
          <div className="mt-3 space-y-1 text-sm">
            <div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("ytd")}</span>
                <span className="font-medium">
                  {formatMoney(dividends.ytdCents, locale)}
                </span>
              </div>
              {expectedYtdCents > 0 && (
                <p className={`text-right text-xs ${pacingOnTrack ? "text-gain" : "text-muted-foreground"}`}>
                  {t("ytdPacing", { pct: pacingPct })}
                </p>
              )}
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("priorYear")}</span>
              <span className="font-medium">
                {formatMoney(dividends.priorYearCents, locale)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("yoy")}</span>
              <span className={`font-medium ${growthPositive ? "text-gain" : "text-loss"}`}>
                {growthPositive ? "+" : ""}
                {formatPercent(dividends.ytdGrowthPercent, locale)}
              </span>
            </div>
          </div>

          {/* Tabbed charts */}
          <Separator className="my-4" />
          <Tabs defaultValue="forecast">
            <TabsList className="w-full">
              <TabsTrigger value="forecast" className="flex-1 text-xs">
                {t("dividendForecast")}
              </TabsTrigger>
              <TabsTrigger value="history" className="flex-1 text-xs" disabled={!hasHistory}>
                {t("dividendHistory")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="forecast">
              <div className="mt-3 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={forecastChartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) =>
                        v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                      }
                      width={40}
                    />
                    <Tooltip
                      formatter={(_value, _name, item) => [
                        formatMoney(
                          (item.payload as Record<string, number>).totalCents,
                          locale,
                        ),
                      ]}
                      labelFormatter={(label) => String(label)}
                      contentStyle={tooltipStyle}
                    />
                    <Bar dataKey="dollars" radius={[4, 4, 0, 0]}>
                      {forecastChartData.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={entry.isCurrentMonth ? "var(--chart-1)" : "var(--chart-2)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>

            <TabsContent value="history">
              {hasHistory ? (
                <div className="mt-3 h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={historyChartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <XAxis
                        dataKey="year"
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) =>
                          v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                        }
                        width={45}
                      />
                      <Tooltip
                        formatter={(_value, _name, item) => [
                          formatMoney(
                            (item.payload as Record<string, number>).totalCents,
                            locale,
                          ),
                        ]}
                        labelFormatter={(label) => String(label)}
                        contentStyle={tooltipStyle}
                      />
                      <Bar
                        dataKey="dollars"
                        fill="var(--chart-2)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">{t("noForecastData")}</p>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
