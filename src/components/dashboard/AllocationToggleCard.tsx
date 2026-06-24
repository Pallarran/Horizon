"use client";

import { useState } from "react";
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

interface AllocationToggleCardProps {
  accountData: AllocationSlice[];
  accountTotalCents: number;
  assetClassData: AllocationSlice[];
  assetClassTotalCents: number;
  locale: string;
}

/**
 * Single, readable allocation donut with an Account / Asset toggle and a
 * labelled legend — replaces the two cramped side-by-side donuts.
 */
export function AllocationToggleCard({
  accountData,
  accountTotalCents,
  assetClassData,
  assetClassTotalCents,
  locale,
}: AllocationToggleCardProps) {
  const t = useTranslations("dashboard");
  const tHoldings = useTranslations("holdings");
  const [mode, setMode] = useState<"account" | "asset">("account");

  const isAccount = mode === "account";
  const data = isAccount ? accountData : assetClassData;
  const totalCents = isAccount ? accountTotalCents : assetClassTotalCents;
  const labelPrefix = isAccount ? "accountType" : "assetClass";

  function getLabel(key: string) {
    const i18nKey = `${labelPrefix}${key}` as Parameters<typeof tHoldings>[0];
    return tHoldings(i18nKey);
  }

  const hasData = data.length > 0;

  return (
    <div className="rounded-xl border bg-card p-[22px] shadow-sm">
      <div className="mb-3.5 flex items-center justify-between">
        <p className="text-sm font-semibold">{t("allocation")}</p>
        <div className="flex gap-0.5 rounded-md bg-muted p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => setMode("account")}
            className={`rounded px-2.5 py-1 transition-colors ${
              isAccount ? "bg-card font-semibold shadow-sm" : "text-muted-foreground"
            }`}
          >
            {t("allocationAccount")}
          </button>
          <button
            type="button"
            onClick={() => setMode("asset")}
            className={`rounded px-2.5 py-1 transition-colors ${
              !isAccount ? "bg-card font-semibold shadow-sm" : "text-muted-foreground"
            }`}
          >
            {t("allocationAsset")}
          </button>
        </div>
      </div>

      {!hasData ? (
        <p className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          {t("noPositions")}
        </p>
      ) : (
        <div className="flex items-center gap-5">
          <div className="relative size-32 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="valueCents"
                  nameKey="key"
                  cx="50%"
                  cy="50%"
                  innerRadius={44}
                  outerRadius={64}
                  strokeWidth={2}
                  stroke="var(--card)"
                >
                  {data.map((slice, i) => (
                    <Cell key={slice.key} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  wrapperStyle={{ zIndex: 50 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const slice = payload[0].payload as AllocationSlice;
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
                          {formatMoney(slice.valueCents, locale)} ·{" "}
                          {formatPercent(slice.percent, locale, 1)}
                        </p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[15px] font-bold tabular-nums">
                {formatCompactMoney(totalCents, locale)}
              </span>
              <span className="text-[9px] text-muted-foreground">{t("allocationTotal")}</span>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-1.5 text-xs">
            {data.map((slice, i) => (
              <div key={slice.key} className="flex items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                />
                <span className="truncate text-foreground/80">{getLabel(slice.key)}</span>
                <span className="ml-auto shrink-0 font-semibold tabular-nums">
                  {formatPercent(slice.percent, locale, 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Compact money like "$773k" for the donut centre. */
function formatCompactMoney(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "CAD",
    notation: "compact",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
