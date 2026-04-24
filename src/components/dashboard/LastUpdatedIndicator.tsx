"use client";

import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { fr, enCA } from "date-fns/locale";

interface LastUpdatedIndicatorProps {
  lastPriceDate: string | null;
  locale: string;
}

export function LastUpdatedIndicator({ lastPriceDate, locale }: LastUpdatedIndicatorProps) {
  const t = useTranslations("dashboard");

  const priceText = (() => {
    if (!lastPriceDate) return t("noPriceData");
    const date = new Date(lastPriceDate);
    const dateLocale = locale === "fr-CA" ? fr : enCA;
    return t("pricesAsOf", { date: format(date, "PPP", { locale: dateLocale }) });
  })();

  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{priceText}</p>
      <p className="text-xs text-muted-foreground">{t("allAmountsInCad")}</p>
    </div>
  );
}
