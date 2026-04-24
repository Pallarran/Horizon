"use client";

import { useTranslations } from "next-intl";
import type { ContributionYearRow } from "@/lib/contributions/compute";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface InvestmentBreakdownChartProps {
  rows: ContributionYearRow[];
  locale: string;
}

export function InvestmentBreakdownChart({ rows, locale }: InvestmentBreakdownChartProps) {
  const t = useTranslations("contributions");

  const data = rows.map((r) => ({
    year: r.year,
    reer: r.reerDepositCents / 100,
    celi: r.celiDepositCents / 100,
    crcd: r.crcdDepositCents / 100,
    marge: r.margeDepositCents / 100,
    cash: r.cashDepositCents / 100,
    other: r.otherDepositCents / 100,
    goal: r.savingsGoalCents > 0 ? r.savingsGoalCents / 100 : undefined,
  }));

  const hasData = data.some(
    (d) => d.reer > 0 || d.celi > 0 || d.crcd > 0 || d.marge > 0 || d.cash > 0 || d.other > 0,
  );

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <p className="mb-4 text-sm font-medium">{t("investmentBreakdown")}</p>
      {!hasData ? (
        <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          {t("noInvestmentData")}
        </p>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <XAxis
                dataKey="year"
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
                formatter={(value, name) => [
                  new Intl.NumberFormat(locale, {
                    style: "currency",
                    currency: "CAD",
                    maximumFractionDigits: 0,
                  }).format(Number(value)),
                  name,
                ]}
                labelFormatter={(label) => `${label}`}
                contentStyle={{
                  backgroundColor: "var(--popover)",
                  borderColor: "var(--border)",
                  color: "var(--popover-foreground)",
                  borderRadius: "0.5rem",
                }}
              />
              <Legend />
              <Bar
                dataKey="reer"
                name={t("reerLabel")}
                stackId="deposits"
                fill="var(--chart-1)"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="celi"
                name={t("celiLabel")}
                stackId="deposits"
                fill="var(--chart-2)"
              />
              <Bar
                dataKey="crcd"
                name="CRCD"
                stackId="deposits"
                fill="var(--chart-5)"
              />
              <Bar
                dataKey="marge"
                name={t("marge")}
                stackId="deposits"
                fill="var(--chart-3)"
              />
              <Bar
                dataKey="cash"
                name={t("cash")}
                stackId="deposits"
                fill="var(--chart-4)"
              />
              <Bar
                dataKey="other"
                name={t("other")}
                stackId="deposits"
                fill="hsl(var(--muted-foreground) / 0.5)"
                radius={[2, 2, 0, 0]}
              />
              <Line
                dataKey="goal"
                name={t("goal")}
                type="stepAfter"
                stroke="var(--foreground)"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
