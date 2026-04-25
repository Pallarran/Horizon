"use client";

import { useTranslations } from "next-intl";
import { formatMoney, formatPercent } from "@/lib/money/format";
import type { DividendsSummaryData } from "@/lib/dashboard/dividends-summary";
import type { DividendHistoryPoint } from "@/lib/dashboard/dividend-history";
import { Separator } from "@/components/ui/separator";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DividendsSummaryCardProps {
  locale: string;
  dividends: DividendsSummaryData;
  history?: DividendHistoryPoint[];
}

export function DividendsSummaryCard({ locale, dividends, history }: DividendsSummaryCardProps) {
  const t = useTranslations("dashboard");

  const growthPositive = dividends.ytdGrowthPercent >= 0;

  // YTD pacing: are actual dividends on track vs annualized expectation?
  const monthsElapsed = new Date().getMonth() + 1;
  const expectedYtdCents = Math.round(dividends.annualizedCents * (monthsElapsed / 12));
  const pacingPct = expectedYtdCents > 0
    ? Math.round((dividends.ytdCents / expectedYtdCents) * 100)
    : 0;
  const pacingOnTrack = pacingPct >= 100;

  const chartData = history?.map((p) => ({
    year: p.year,
    dollars: p.totalCents / 100,
    totalCents: p.totalCents,
  }));

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

      {chartData && chartData.length > 0 && (
        <>
          <Separator className="my-4" />
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {t("dividendHistory")}
          </p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
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
                  contentStyle={{
                    backgroundColor: "var(--popover)",
                    borderColor: "var(--border)",
                    color: "var(--popover-foreground)",
                    borderRadius: "0.5rem",
                  }}
                />
                <Bar
                  dataKey="dollars"
                  fill="var(--chart-2)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
