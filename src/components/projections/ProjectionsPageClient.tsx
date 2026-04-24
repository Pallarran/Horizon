"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { formatMoney, formatPercent } from "@/lib/money/format";
import { projectPortfolio } from "@/lib/projections/portfolio-projection";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface ProjectionsPageClientProps {
  portfolioValueCents: number;
  startingYield: number;
  yearsToRetirement: number;
  locale: string;
}

export function ProjectionsPageClient({
  portfolioValueCents,
  startingYield,
  yearsToRetirement,
  locale,
}: ProjectionsPageClientProps) {
  const t = useTranslations("projections");

  const [priceGrowth, setPriceGrowth] = useState(2);
  const [divGrowth, setDivGrowth] = useState(1);
  const [monthlyContribution, setMonthlyContribution] = useState(3000);
  const [years, setYears] = useState(Math.min(yearsToRetirement, 40));

  const result = useMemo(
    () =>
      projectPortfolio({
        startingValueCents: portfolioValueCents,
        startingYield,
        monthlyContributionCents: monthlyContribution * 100,
        priceGrowthRate: priceGrowth / 100,
        dividendGrowthRate: divGrowth / 100,
        yearsToProject: years,
      }),
    [portfolioValueCents, startingYield, priceGrowth, divGrowth, monthlyContribution, years],
  );

  const lastYear = result.yearly[result.yearly.length - 1];

  // Chart data in dollars for cleaner axis labels
  const portfolioChartData = result.yearly.map((y) => ({
    year: y.date,
    noDrip: y.portfolioNoDripCents / 100,
    drip: y.portfolioDripCents / 100,
    noDripCents: y.portfolioNoDripCents,
    dripCents: y.portfolioDripCents,
  }));

  const dividendChartData = result.yearly.map((y) => ({
    year: y.date,
    noDrip: y.monthlyDivNoDripCents / 100,
    drip: y.monthlyDivDripCents / 100,
    noDripCents: y.monthlyDivNoDripCents,
    dripCents: y.monthlyDivDripCents,
  }));

  function formatDollarAxis(value: number) {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
    return `${value}`;
  }

  return (
    <div className="space-y-6">
      {/* Input controls */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="priceGrowth">{t("priceGrowth")}</Label>
            <div className="relative max-w-32">
              <Input
                id="priceGrowth"
                type="number"
                value={priceGrowth}
                onChange={(e) => setPriceGrowth(Number(e.target.value))}
                min={-5}
                max={20}
                step={0.5}
                className="pr-7"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                %
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="divGrowth">{t("dividendGrowth")}</Label>
            <div className="relative max-w-32">
              <Input
                id="divGrowth"
                type="number"
                value={divGrowth}
                onChange={(e) => setDivGrowth(Number(e.target.value))}
                min={-5}
                max={20}
                step={0.5}
                className="pr-7"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                %
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="monthlyContrib">{t("monthlyContribution")}</Label>
            <div className="relative max-w-40">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                id="monthlyContrib"
                type="number"
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(Number(e.target.value))}
                min={0}
                step={100}
                className="pl-7"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="years">{t("yearsToProject")}</Label>
            <Input
              id="years"
              type="number"
              value={years}
              onChange={(e) => setYears(Math.max(1, Math.min(50, Number(e.target.value))))}
              min={1}
              max={50}
              step={1}
              className="max-w-24"
            />
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {t("currentYield")}: {formatPercent(startingYield, locale, 2)}
        </p>
      </div>

      {/* Summary cards */}
      {lastYear && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label={`${t("portfolioValue")} (${t("withoutDrip")})`}
            value={formatMoney(lastYear.portfolioNoDripCents, locale)}
          />
          <SummaryCard
            label={`${t("portfolioValue")} (${t("withDrip")})`}
            value={formatMoney(lastYear.portfolioDripCents, locale)}
            highlight
          />
          <SummaryCard
            label={`${t("monthlyDividend")} (${t("withoutDrip")})`}
            value={formatMoney(lastYear.monthlyDivNoDripCents, locale)}
          />
          <SummaryCard
            label={`${t("monthlyDividend")} (${t("withDrip")})`}
            value={formatMoney(lastYear.monthlyDivDripCents, locale)}
            highlight
          />
        </div>
      )}

      {/* Portfolio Value Chart */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <p className="mb-4 text-sm font-medium">{t("portfolioValue")}</p>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={portfolioChartData}
              margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
            >
              <defs>
                <linearGradient id="projNoDripGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="projDripGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="year"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatDollarAxis}
                width={60}
              />
              <Tooltip
                wrapperStyle={{ zIndex: 50 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as (typeof portfolioChartData)[number];
                  return (
                    <div
                      className="rounded-lg border px-3 py-2 text-sm shadow-md"
                      style={{
                        backgroundColor: "var(--popover)",
                        borderColor: "var(--border)",
                        color: "var(--popover-foreground)",
                      }}
                    >
                      <p className="font-medium">{d.year}</p>
                      <p style={{ color: "var(--chart-1)" }}>
                        {t("withDrip")}: {formatMoney(d.dripCents, locale)}
                      </p>
                      <p style={{ color: "var(--chart-2)" }}>
                        {t("withoutDrip")}: {formatMoney(d.noDripCents, locale)}
                      </p>
                    </div>
                  );
                }}
              />
              <Legend
                formatter={(value: string) =>
                  value === "drip" ? t("withDrip") : t("withoutDrip")
                }
              />
              <Area
                type="monotone"
                dataKey="drip"
                stroke="var(--chart-1)"
                fill="url(#projDripGrad)"
                strokeWidth={2}
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="noDrip"
                stroke="var(--chart-2)"
                fill="url(#projNoDripGrad)"
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Dividend Income Chart */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <p className="mb-4 text-sm font-medium">{t("monthlyDividend")}</p>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={dividendChartData}
              margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
            >
              <defs>
                <linearGradient id="divNoDripGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-4)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--chart-4)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="divDripGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-3)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--chart-3)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="year"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatDollarAxis}
                width={60}
              />
              <Tooltip
                wrapperStyle={{ zIndex: 50 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as (typeof dividendChartData)[number];
                  return (
                    <div
                      className="rounded-lg border px-3 py-2 text-sm shadow-md"
                      style={{
                        backgroundColor: "var(--popover)",
                        borderColor: "var(--border)",
                        color: "var(--popover-foreground)",
                      }}
                    >
                      <p className="font-medium">{d.year}</p>
                      <p style={{ color: "var(--chart-3)" }}>
                        {t("withDrip")}: {formatMoney(d.dripCents, locale)}{t("perMonth")}
                      </p>
                      <p style={{ color: "var(--chart-4)" }}>
                        {t("withoutDrip")}: {formatMoney(d.noDripCents, locale)}{t("perMonth")}
                      </p>
                    </div>
                  );
                }}
              />
              <Legend
                formatter={(value: string) =>
                  value === "drip" ? t("withDrip") : t("withoutDrip")
                }
              />
              <Area
                type="monotone"
                dataKey="drip"
                stroke="var(--chart-3)"
                fill="url(#divDripGrad)"
                strokeWidth={2}
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="noDrip"
                stroke="var(--chart-4)"
                fill="url(#divNoDripGrad)"
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 text-xl font-bold tracking-tight ${highlight ? "text-gain" : ""}`}>
        {value}
      </p>
    </div>
  );
}
