"use client";

import { useTranslations } from "next-intl";
import { formatMoney, formatPercent } from "@/lib/money/format";
import type { HeroData } from "@/lib/dashboard/hero";
import { Separator } from "@/components/ui/separator";

interface RetirementCardProps {
  locale: string;
  hero: HeroData;
}

export function RetirementCard({ locale, hero }: RetirementCardProps) {
  const t = useTranslations("dashboard");

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <RetirementContent locale={locale} hero={hero} t={t} />
    </div>
  );
}

/* ─── Retirement content ─── */

type TranslationFn = ReturnType<typeof useTranslations>;

function RetirementContent({
  locale,
  hero,
  t,
}: {
  locale: string;
  hero: HeroData;
  t: TranslationFn;
}) {
  const coverageColor =
    hero.retirementCoveragePercent >= 1.0
      ? "text-gain"
      : hero.retirementCoveragePercent >= 0.8
        ? "text-warning"
        : "text-loss";

  const replacementPct = Math.round(hero.targetIncomeReplacementPercent * 100);

  return (
    <>
      <p className="mb-4 text-sm font-medium">
        {t("projectedIncomeAt", { age: hero.targetRetirementAge })}
      </p>

      <div className="space-y-2 text-sm">
        <Row
          label={t("dividendIncome")}
          value={formatMoney(hero.dividendIncomeAtRetirementCents, locale)}
          suffix={t("perYear")}
        />
        {hero.pensionIncomeCents > 0 && (
          <Row
            label={t("pensionIncome")}
            value={formatMoney(hero.pensionIncomeCents, locale)}
            suffix={t("perYear")}
          />
        )}
        {hero.otherStreamIncomeCents > 0 && (
          <Row
            label={t("otherIncome")}
            value={formatMoney(hero.otherStreamIncomeCents, locale)}
            suffix={t("perYear")}
          />
        )}

        <Separator className="my-2" />

        <Row
          label={t("totalIncome")}
          value={formatMoney(hero.totalIncomeAtRetirementCents, locale)}
          suffix={t("perYear")}
          bold
        />
        <Row
          label={t("targetIncome", { percent: replacementPct })}
          value={formatMoney(hero.targetIncomeCents, locale)}
          suffix={t("perYear")}
        />
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("coverage")}</span>
          <span className={`font-semibold ${coverageColor}`}>
            {formatPercent(hero.retirementCoveragePercent, locale, 0)}
          </span>
        </div>
      </div>
    </>
  );
}

/* ─── Shared row helper ─── */

function Row({
  label,
  value,
  suffix,
  bold,
}: {
  label: string;
  value: string;
  suffix?: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "font-semibold" : "font-medium"}>
        {value}
        {suffix && (
          <span className="ml-0.5 text-xs text-muted-foreground">{suffix}</span>
        )}
      </span>
    </div>
  );
}
