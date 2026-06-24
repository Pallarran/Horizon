"use client";

import { useTranslations } from "next-intl";
import { formatMoney, formatPercent } from "@/lib/money/format";
import type { NetWorthData } from "@/lib/dashboard/net-worth";
import type { PortfolioHistoryPoint } from "@/lib/dashboard/portfolio-history";
import {
  AreaChart,
  Area,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface WealthHeroCardProps {
  locale: string;
  netWorth: NetWorthData;
  history: PortfolioHistoryPoint[];
}

/**
 * Lead "wealth" hero — answers "How wealthy am I?".
 * Net worth at large scale, today + all-time change, and a full-width sparkline.
 */
export function WealthHeroCard({ locale, netWorth, history }: WealthHeroCardProps) {
  const t = useTranslations("dashboard");

  const dayPositive = netWorth.dayChangeCents >= 0;
  const gainPositive = netWorth.unrealizedGainCents >= 0;

  const chartData = history.map((p) => ({
    date: p.date,
    dollars: p.valueCents / 100,
    valueCents: p.valueCents,
  }));
  const hasData = chartData.length >= 2 && chartData.some((d) => d.valueCents > 0);

  const firstLabel = hasData
    ? formatMonthYear(chartData[0].date, locale)
    : null;
  const lastLabel = hasData
    ? formatMonthYear(chartData[chartData.length - 1].date, locale)
    : null;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("netWorth")}
      </p>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="mt-1.5 text-5xl font-extrabold leading-none tracking-tight tabular-nums">
          {formatMoney(netWorth.netWorthCents, locale)}
        </p>
        <div className="mt-1.5 flex flex-col gap-0.5">
          <span
            className={`text-sm font-semibold tabular-nums ${dayPositive ? "text-gain" : "text-loss"}`}
          >
            {dayPositive ? "+" : ""}
            {formatMoney(netWorth.dayChangeCents, locale)}{" "}
            <span className="font-medium">
              {t("todayLower")} ({dayPositive ? "+" : ""}
              {formatPercent(netWorth.dayChangePercent, locale)})
            </span>
          </span>
          <span
            className={`text-sm font-semibold tabular-nums ${gainPositive ? "text-gain" : "text-loss"}`}
          >
            {gainPositive ? "+" : ""}
            {formatMoney(netWorth.unrealizedGainCents, locale)}{" "}
            <span className="font-medium">
              {t("allTime")} ({gainPositive ? "+" : ""}
              {formatPercent(netWorth.unrealizedGainPercent, locale)})
            </span>
          </span>
        </div>
      </div>

      {hasData ? (
        <>
          <div className="mt-3.5 h-[96px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="wealthHeroGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
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
                  stroke="var(--primary)"
                  fill="url(#wealthHeroGradient)"
                  strokeWidth={2.5}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground">
            <span>{firstLabel}</span>
            <span>{lastLabel}</span>
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">{t("noPositions")}</p>
      )}
    </div>
  );
}

function formatMonthYear(isoDate: string, locale: string): string {
  return new Date(isoDate + "T00:00:00").toLocaleDateString(locale, {
    month: "short",
    year: "2-digit",
  });
}
