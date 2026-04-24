"use client";

import { useTranslations } from "next-intl";
import { formatMoney, formatPercent } from "@/lib/money/format";
import type { NetWorthData } from "@/lib/dashboard/net-worth";
import type { HeroData } from "@/lib/dashboard/hero";

interface KpiStripProps {
  locale: string;
  netWorth: NetWorthData;
  hero: HeroData;
}

export function KpiStrip({ locale, netWorth, hero }: KpiStripProps) {
  const t = useTranslations("dashboard");

  const dayPositive = netWorth.dayChangeCents >= 0;
  const gainPositive = netWorth.unrealizedGainCents >= 0;

  const coverageColor =
    hero.coveragePercent >= 1.0
      ? "text-gain"
      : hero.coveragePercent >= 0.8
        ? "text-warning"
        : "text-loss";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* Net Worth */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("netWorth")}
        </p>
        <p className="mt-1 text-2xl font-bold tracking-tight">
          {formatMoney(netWorth.netWorthCents, locale)}
        </p>
      </div>

      {/* Today's Change */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("todayChange")}
        </p>
        <p className={`mt-1 flex items-baseline gap-1.5 ${dayPositive ? "text-gain" : "text-loss"}`}>
          <span className="text-2xl font-bold tracking-tight">
            {dayPositive ? "+" : ""}
            {formatMoney(netWorth.dayChangeCents, locale)}
          </span>
          <span className="text-sm font-medium">
            {dayPositive ? "+" : ""}
            {formatPercent(netWorth.dayChangePercent, locale)}
          </span>
        </p>
      </div>

      {/* Unrealized Gain */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("unrealizedGain")}
        </p>
        <p className={`mt-1 flex items-baseline gap-1.5 ${gainPositive ? "text-gain" : "text-loss"}`}>
          <span className="text-2xl font-bold tracking-tight">
            {gainPositive ? "+" : ""}
            {formatMoney(netWorth.unrealizedGainCents, locale)}
          </span>
          <span className="text-sm font-medium">
            {gainPositive ? "+" : ""}
            {formatPercent(netWorth.unrealizedGainPercent, locale)}
          </span>
        </p>
      </div>

      {/* Freedom */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("freedom")}
        </p>
        <p className="mt-1 flex items-baseline gap-1.5">
          <span className="text-2xl font-bold tracking-tight">
            {hero.yearsToFreedom !== null ? hero.yearsToFreedom : "—"}
            {hero.yearsToFreedom !== null && (
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                {t("yearsToFreedom").toLowerCase()}
              </span>
            )}
          </span>
          <span className={`text-sm font-medium ${coverageColor}`}>
            {formatPercent(hero.coveragePercent, locale, 0)}
          </span>
        </p>
      </div>
    </div>
  );
}
