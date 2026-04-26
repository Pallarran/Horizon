"use client";

import { useTranslations } from "next-intl";
import { formatMoney, formatPercent } from "@/lib/money/format";
import type { PortfolioHistoryPoint } from "@/lib/dashboard/portfolio-history";
import {
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface PortfolioSparklineCardProps {
  locale: string;
  history: PortfolioHistoryPoint[];
}

export function PortfolioSparklineCard({
  locale,
  history,
}: PortfolioSparklineCardProps) {
  const t = useTranslations("dashboard");

  const chartData = history.map((p) => ({
    date: p.date,
    label: new Date(p.date + "T00:00:00").toLocaleDateString(locale, {
      month: "short",
    }),
    dollars: p.valueCents / 100,
    valueCents: p.valueCents,
  }));

  // Change from first non-zero point to last
  const firstNonZero = history.find((p) => p.valueCents > 0);
  const last = history[history.length - 1];
  const changeCents =
    last && firstNonZero ? last.valueCents - firstNonZero.valueCents : 0;
  const changePercent =
    firstNonZero && firstNonZero.valueCents > 0
      ? changeCents / firstNonZero.valueCents
      : 0;
  const positive = changeCents >= 0;

  const hasData = chartData.length >= 2 && chartData.some((d) => d.valueCents > 0);

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium">{t("portfolioTrend")}</p>
        {hasData && (
          <span
            className={`text-sm font-medium ${positive ? "text-gain" : "text-loss"}`}
          >
            {positive ? "+" : ""}
            {formatMoney(changeCents, locale)}
            {" ("}
            {positive ? "+" : ""}
            {formatPercent(changePercent, locale)}
            {")"}
          </span>
        )}
      </div>

      {!hasData ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {t("noPositions")}
        </p>
      ) : (
        <div className="mt-2 h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id="portfolioGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="var(--chart-1)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--chart-1)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickFormatter={(date: string) =>
                  new Date(date + "T00:00:00").toLocaleDateString(locale, { month: "short" })
                }
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <Tooltip
                wrapperStyle={{ zIndex: 50 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const point = payload[0].payload as (typeof chartData)[number];
                  return (
                    <div
                      className="rounded-lg border px-3 py-2 text-sm shadow-md"
                      style={{
                        backgroundColor: "var(--popover)",
                        borderColor: "var(--border)",
                        color: "var(--popover-foreground)",
                      }}
                    >
                      <p className="font-medium">{point.date}</p>
                      <p className="text-muted-foreground">
                        {formatMoney(point.valueCents, locale)}
                      </p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="dollars"
                stroke="var(--chart-1)"
                fill="url(#portfolioGradient)"
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
