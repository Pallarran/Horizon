"use client";

import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { fr, enCA } from "date-fns/locale";

interface LastUpdatedIndicatorProps {
  lastPriceDate: string | null;
  usdCadRate: number;
  locale: string;
}

export function LastUpdatedIndicator({ lastPriceDate, usdCadRate, locale }: LastUpdatedIndicatorProps) {
  const t = useTranslations("dashboard");

  const priceText = (() => {
    if (!lastPriceDate) return t("noPriceData");
    const date = new Date(lastPriceDate);
    const dateLocale = locale === "fr-CA" ? fr : enCA;
    return t("pricesAsOf", { date: format(date, "PPPp", { locale: dateLocale }) });
  })();

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span>{t("allAmountsInCad", { rate: usdCadRate.toFixed(4) })}</span>
      <span>{priceText}</span>
    </div>
  );
}
