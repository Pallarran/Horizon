"use client";

import { useTranslations } from "next-intl";
import { formatMoney, formatPercent } from "@/lib/money/format";
import type { HeroData } from "@/lib/dashboard/hero";
import type { NetWorthData } from "@/lib/dashboard/net-worth";

interface HeroCardProps {
  locale: string;
  hero: HeroData;
  netWorth: NetWorthData;
}

export function HeroCard({ locale, hero, netWorth }: HeroCardProps) {
  const t = useTranslations("dashboard");

  const changePositive = netWorth.dayChangeCents >= 0;

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm md:col-span-2">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        {/* Left: years to freedom */}
        <div>
          <p className="text-sm text-muted-foreground">{t("yearsToFreedom")}</p>
          <p className="mt-1 text-5xl font-bold tracking-tight">
            {hero.yearsToFreedom !== null ? hero.yearsToFreedom : "—"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("coverage")}:{" "}
            <span className="font-medium text-foreground">
              {formatPercent(hero.coveragePercent, locale, 0)}
            </span>{" "}
            {t("ofTarget")} ({formatPercent(hero.targetIncomeReplacementPercent, locale, 0)})
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("ageRange", { from: hero.currentAge, to: hero.targetRetirementAge })}
          </p>
        </div>

        {/* Right: net worth */}
        <div className="text-right">
          <p className="text-sm text-muted-foreground">{t("netWorth")}</p>
          <p className="mt-1 text-3xl font-bold">
            {formatMoney(netWorth.netWorthCents, locale)}
          </p>
          <p
            className={`mt-1 text-sm font-medium ${
              changePositive ? "text-gain" : "text-loss"
            }`}
          >
            {changePositive ? "+" : ""}
            {formatMoney(netWorth.dayChangeCents, locale)}{" "}
            ({changePositive ? "+" : ""}
            {formatPercent(netWorth.dayChangePercent, locale)})
            {" "}{t("today")}
          </p>
        </div>
      </div>
    </div>
  );
}
