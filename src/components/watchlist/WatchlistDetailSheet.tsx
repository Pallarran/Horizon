"use client";

import { useTranslations } from "next-intl";
import { formatMoney, formatPercent } from "@/lib/money/format";
import type { SecurityProfile } from "@/lib/positions/security-profile";
import type { SerializedWatchlistItem } from "@/lib/actions/watchlist";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DetailRow, SectionHeading, formatDate } from "@/components/detail-sheet/detail-helpers";
import {
  SecurityInfoSection,
  DividendSafetySection,
  KeyDatesSection,
  ValuationSection,
  FinancialHealthSection,
  AnalystViewSection,
  AboutSection,
} from "@/components/detail-sheet/profile-sections";

interface PriceInfo {
  currentPriceCents: number;
  previousPriceCents: number | null;
}

interface Props {
  item: SerializedWatchlistItem | null;
  profile?: SecurityProfile;
  price?: PriceInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: string;
  onEdit: () => void;
  onDelete: () => void;
}

export function WatchlistDetailSheet({
  item,
  profile,
  price,
  open,
  onOpenChange,
  locale,
  onEdit,
  onDelete,
}: Props) {
  const t = useTranslations("holdings");
  const tw = useTranslations("watchlist");
  const tc = useTranslations("common");

  if (!item) return null;

  const currentCents = price?.currentPriceCents ?? 0;
  const previousCents = price?.previousPriceCents;
  const dayChangeCents = previousCents != null ? currentCents - previousCents : 0;
  const dayChangePct =
    previousCents != null && previousCents > 0
      ? dayChangeCents / previousCents
      : 0;
  const dayPositive = dayChangeCents >= 0;

  const currency = item.currency === "USD" ? "USD" : "CAD";
  const p = profile;

  // Yield computed from annual dividend / current price
  const currentYield =
    item.annualDividendCents != null && item.annualDividendCents > 0 && currentCents > 0
      ? item.annualDividendCents / currentCents
      : null;

  // Yield at target price
  const yieldAtTarget =
    item.annualDividendCents != null &&
    item.annualDividendCents > 0 &&
    item.targetBuyPriceCents != null &&
    item.targetBuyPriceCents > 0
      ? item.annualDividendCents / item.targetBuyPriceCents
      : null;

  // Distance to target
  let distancePct: number | null = null;
  let belowTarget = false;
  if (item.targetBuyPriceCents && currentCents > 0) {
    distancePct =
      (currentCents - item.targetBuyPriceCents) / item.targetBuyPriceCents;
    belowTarget = currentCents <= item.targetBuyPriceCents;
  }

  const frequencyKey = item.dividendFrequency
    ? (`frequency${item.dividendFrequency.charAt(0).toUpperCase()}${item.dividendFrequency.slice(1)}` as Parameters<typeof t>[0])
    : null;

  const hasDividend = currentYield != null || item.annualDividendCents != null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-5xl">
        {/* Header — symbol/name left, current price right */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <DialogHeader className="flex-1 space-y-1">
            <DialogTitle className="text-lg">{item.symbol}</DialogTitle>
            <DialogDescription>{item.name}</DialogDescription>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Badge variant="outline">{currency}</Badge>
              <Badge variant="outline">{item.exchange}</Badge>
              <Badge variant="secondary">
                {t(`assetClass${item.assetClass}` as Parameters<typeof t>[0])}
              </Badge>
              {item.isDividendKing && (
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                  {t("dividendKing")}
                </Badge>
              )}
              {item.isDividendAristocrat && !item.isDividendKing && (
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                  {t("dividendAristocrat")}
                </Badge>
              )}
            </div>
          </DialogHeader>

          <div className="text-left sm:text-right sm:shrink-0 sm:pt-6">
            <p className="text-2xl font-bold tabular-nums">
              {currentCents > 0
                ? formatMoney(currentCents, locale, currency)
                : "—"}
            </p>
            {previousCents != null && (
              <p
                className={`text-sm tabular-nums ${
                  dayPositive ? "text-gain" : "text-loss"
                }`}
              >
                {dayPositive ? "+" : ""}
                {formatMoney(dayChangeCents, locale, currency)}{" "}
                ({dayPositive ? "+" : ""}
                {formatPercent(dayChangePct, locale)}) {t("today")}
              </p>
            )}
          </div>
        </div>

        <Separator />

        {/* Three-column body */}
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* ── Column 1: Price & Target ── */}
          <div className="flex flex-col gap-4">
            <div>
              <SectionHeading>{tw("priceAndTarget")}</SectionHeading>
              <DetailRow
                label={tw("currentPrice")}
                value={
                  currentCents > 0
                    ? formatMoney(currentCents, locale, currency)
                    : "—"
                }
              />
              {item.targetBuyPriceCents != null && (
                <DetailRow
                  label={tw("target")}
                  value={formatMoney(item.targetBuyPriceCents, locale, currency)}
                />
              )}
              {distancePct !== null && (
                <div className="flex items-baseline justify-between gap-2 py-1">
                  <span className="text-sm text-muted-foreground">
                    {tw("distanceToTarget")}
                  </span>
                  <Badge variant={belowTarget ? "default" : "secondary"}>
                    {belowTarget ? "↓ " : "↑ "}
                    {formatPercent(Math.abs(distancePct), locale, 1)}
                  </Badge>
                </div>
              )}
              {item.note && (
                <DetailRow label={tw("note")} value={item.note} />
              )}
              <DetailRow
                label={tw("addedOn")}
                value={formatDate(item.addedAt, locale)}
              />
            </div>

            <SecurityInfoSection
              sector={item.sector}
              industry={item.industry}
              locale={locale}
            />
          </div>

          {/* ── Column 2: Dividends ── */}
          <div className="flex flex-col gap-4">
            {hasDividend && (
              <div>
                <SectionHeading>{tw("dividends")}</SectionHeading>
                {item.annualDividendCents != null && item.annualDividendCents > 0 && (
                  <DetailRow
                    label={t("annualDividendPerShare")}
                    value={formatMoney(item.annualDividendCents, locale, currency)}
                  />
                )}
                {currentYield != null && (
                  <DetailRow
                    label={t("yield")}
                    value={formatPercent(currentYield, locale)}
                  />
                )}
                {yieldAtTarget != null && (
                  <DetailRow
                    label={tw("yieldAtTarget")}
                    value={formatPercent(yieldAtTarget, locale)}
                  />
                )}
                {frequencyKey && (
                  <DetailRow
                    label={t("dividendFrequency")}
                    value={t(frequencyKey)}
                  />
                )}
                {item.dividendGrowthYears != null && item.dividendGrowthYears > 0 && (
                  <DetailRow
                    label={t("divGrowthYears", { count: item.dividendGrowthYears })}
                    value=""
                  />
                )}
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {item.isPaysMonthly && (
                    <Badge variant="outline" className="text-[10px]">
                      {t("monthlyPayer")}
                    </Badge>
                  )}
                  {item.isDividendAristocrat && (
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-[10px]">
                      {t("dividendAristocrat")}
                    </Badge>
                  )}
                  {item.isDividendKing && (
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-[10px]">
                      {t("dividendKing")}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {p && (
              <DividendSafetySection
                profile={p}
                locale={locale}
                showSeparator={hasDividend}
              />
            )}
            {p && (
              <KeyDatesSection profile={p} locale={locale} />
            )}
          </div>

          {/* ── Column 3: Market Analysis ── */}
          <div className="flex flex-col gap-4">
            {p && (
              <ValuationSection
                profile={p}
                locale={locale}
                currentPriceCents={currentCents > 0 ? currentCents : null}
                currency={currency}
              />
            )}
            {p && (
              <FinancialHealthSection profile={p} locale={locale} />
            )}
            {p && (
              <AnalystViewSection profile={p} locale={locale} />
            )}
          </div>
        </div>

        {/* About (full width) */}
        {p && <AboutSection profile={p} locale={locale} />}

        {/* Actions */}
        <DialogFooter className="flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => {
              onOpenChange(false);
              onEdit();
            }}
          >
            {tc("edit")}
          </Button>
          <Button
            variant="destructive"
            className="w-full sm:w-auto"
            onClick={() => {
              onOpenChange(false);
              onDelete();
            }}
          >
            {tw("removeFromWatchlistLong")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
