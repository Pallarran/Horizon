"use client";

import { useTranslations } from "next-intl";
import { formatMoney, formatPercent } from "@/lib/money/format";
import type { AllocationSlice } from "@/lib/dashboard/allocation";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--muted-foreground)",
];

/* ─── Standalone chart (used elsewhere) ─── */

interface AllocationChartProps {
  titleKey: "allocationByAccount" | "allocationByAssetClass";
  labelPrefix: "accountType" | "assetClass";
  data: AllocationSlice[];
  totalCents: number;
  locale: string;
}

export function AllocationChart({ titleKey, labelPrefix, data, totalCents, locale }: AllocationChartProps) {
  const t = useTranslations("dashboard");
  const tHoldings = useTranslations("holdings");

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <p className="mb-4 text-sm font-medium">{t(titleKey)}</p>
      <AllocationContent
        labelPrefix={labelPrefix}
        data={data}
        totalCents={totalCents}
        locale={locale}
        tDashboard={t}
        tHoldings={tHoldings}
      />
    </div>
  );
}

/* ─── Tabbed card for dashboard ─── */

interface AllocationTabsProps {
  accountData: AllocationSlice[];
  accountTotalCents: number;
  assetClassData: AllocationSlice[];
  assetClassTotalCents: number;
  locale: string;
}

export function AllocationTabs({
  accountData,
  accountTotalCents,
  assetClassData,
  assetClassTotalCents,
  locale,
}: AllocationTabsProps) {
  const t = useTranslations("dashboard");
  const tHoldings = useTranslations("holdings");

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="mb-2 text-center text-xs font-medium text-muted-foreground">
            {t("allocationByAccount")}
          </p>
          <AllocationContent
            labelPrefix="accountType"
            data={accountData}
            totalCents={accountTotalCents}
            locale={locale}
            tDashboard={t}
            tHoldings={tHoldings}
            compact
          />
        </div>
        <div>
          <p className="mb-2 text-center text-xs font-medium text-muted-foreground">
            {t("allocationByAssetClass")}
          </p>
          <AllocationContent
            labelPrefix="assetClass"
            data={assetClassData}
            totalCents={assetClassTotalCents}
            locale={locale}
            tDashboard={t}
            tHoldings={tHoldings}
            compact
          />
        </div>
      </div>
    </div>
  );
}

/* ─── Shared inner content (donut + legend) ─── */

type TranslationFn = ReturnType<typeof useTranslations>;

function AllocationContent({
  labelPrefix,
  data,
  totalCents,
  locale,
  tDashboard,
  tHoldings,
  compact,
}: {
  labelPrefix: "accountType" | "assetClass";
  data: AllocationSlice[];
  totalCents: number;
  locale: string;
  tDashboard: TranslationFn;
  tHoldings: TranslationFn;
  compact?: boolean;
}) {
  function getLabel(key: string) {
    const i18nKey = `${labelPrefix}${key}` as Parameters<typeof tHoldings>[0];
    return tHoldings(i18nKey);
  }

  function getColor(index: number) {
    return CHART_COLORS[index % CHART_COLORS.length];
  }

  const hasData = data.length > 0;

  if (!hasData) {
    return (
      <p className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        {tDashboard("noPositions")}
      </p>
    );
  }

  const sizeClass = compact ? "h-40 w-40" : "h-52 w-52";
  const inner = compact ? 40 : 56;
  const outer = compact ? 68 : 88;

  return (
    <div>
      <div className="flex items-center justify-center">
        <div className={`relative ${sizeClass} shrink-0`}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="valueCents"
                nameKey="key"
                cx="50%"
                cy="50%"
                innerRadius={inner}
                outerRadius={outer}
                strokeWidth={2}
                stroke="var(--card)"
              >
                {data.map((slice, i) => (
                  <Cell key={slice.key} fill={getColor(i)} />
                ))}
              </Pie>
              <Tooltip
                wrapperStyle={{ zIndex: 50 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const entry = payload[0];
                  const slice = entry.payload as AllocationSlice;
                  return (
                    <div
                      className="rounded-lg border px-3 py-2 text-sm shadow-md"
                      style={{
                        backgroundColor: "var(--popover)",
                        borderColor: "var(--border)",
                        color: "var(--popover-foreground)",
                      }}
                    >
                      <p className="font-medium">{getLabel(slice.key)}</p>
                      <p className="text-muted-foreground">
                        {formatMoney(slice.valueCents, locale)}
                        {" · "}
                        {formatPercent(slice.percent, locale, 1)}
                      </p>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-2 space-y-1">
        {data.map((slice, i) => (
          <div key={slice.key} className="flex items-center gap-1.5 text-xs">
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: getColor(i) }}
            />
            <span className="truncate text-muted-foreground">{getLabel(slice.key)}</span>
            <span className="ml-auto shrink-0 font-medium">
              {formatPercent(slice.percent, locale, 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
