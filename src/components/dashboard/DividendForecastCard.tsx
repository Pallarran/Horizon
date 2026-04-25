"use client";

import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/money/format";
import type { DividendForecastData } from "@/lib/dashboard/dividend-forecast";
import { Separator } from "@/components/ui/separator";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface DividendForecastCardProps {
  locale: string;
  forecast: DividendForecastData;
}

export function DividendForecastCard({ locale, forecast }: DividendForecastCardProps) {
  const t = useTranslations("dashboard");

  const hasData = forecast.annualTotalCents > 0;

  const chartData = forecast.months.map((m) => ({
    label: m.label,
    dollars: m.totalCents / 100,
    totalCents: m.totalCents,
    isCurrentMonth: m.isCurrentMonth,
  }));

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <p className="text-sm font-medium">{t("dividendForecast")}</p>

      {!hasData && (
        <p className="mt-3 text-sm text-muted-foreground">{t("noForecastData")}</p>
      )}

      {hasData && (
        <>
          <p className="mt-3 text-3xl font-bold">
            {formatMoney(forecast.annualTotalCents, locale)}
          </p>
          <p className="text-xs text-muted-foreground">{t("forecastTotal")}</p>

          <Separator className="my-4" />

          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
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
                  contentStyle={{
                    backgroundColor: "var(--popover)",
                    borderColor: "var(--border)",
                    color: "var(--popover-foreground)",
                    borderRadius: "0.5rem",
                  }}
                />
                <Bar dataKey="dollars" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.isCurrentMonth ? "var(--chart-1)" : "var(--chart-2)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
