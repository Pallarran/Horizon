"use client";

import { useTranslations } from "next-intl";
import type { IncomeCompositionPoint } from "@/lib/dashboard/income-composition";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface IncomeCompositionChartProps {
  data: IncomeCompositionPoint[];
}

export function IncomeCompositionChart({ data }: IncomeCompositionChartProps) {
  const t = useTranslations("dashboard");

  const hasData = data.length > 0 && data.some(
    (d) => d.dividends > 0 || d.pension > 0 || d.qpp > 0 || d.oas > 0,
  );

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <p className="mb-4 text-sm font-medium">{t("incomeComposition")}</p>
      {!hasData ? (
        <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          {t("noIncomeData")}
        </p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="age"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) =>
                  v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                }
              />
              <Tooltip
                formatter={(value) => [
                  `$${Number(value).toLocaleString()}`,
                ]}
                labelFormatter={(label) => `${t("age")} ${label}`}
                contentStyle={{
                  backgroundColor: "var(--popover)",
                  borderColor: "var(--border)",
                  color: "var(--popover-foreground)",
                  borderRadius: "0.5rem",
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="dividends"
                name={t("chartDividends")}
                stackId="1"
                stroke="var(--chart-2)"
                fill="var(--chart-2)"
                fillOpacity={0.3}
              />
              <Area
                type="monotone"
                dataKey="pension"
                name={t("chartPension")}
                stackId="1"
                stroke="var(--chart-1)"
                fill="var(--chart-1)"
                fillOpacity={0.3}
              />
              <Area
                type="monotone"
                dataKey="qpp"
                name={t("chartQpp")}
                stackId="1"
                stroke="var(--chart-5)"
                fill="var(--chart-5)"
                fillOpacity={0.3}
              />
              <Area
                type="monotone"
                dataKey="oas"
                name={t("chartOas")}
                stackId="1"
                stroke="var(--chart-3)"
                fill="var(--chart-3)"
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
