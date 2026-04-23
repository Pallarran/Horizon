"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ExternalLinkIcon } from "lucide-react";
import { formatMoney, formatPercent, formatNumber } from "@/lib/money/format";
import type { SerializedPosition } from "@/lib/positions/serialize";
import type { SecurityProfile } from "@/lib/positions/security-profile";
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

interface Props {
  position: SerializedPosition | null;
  profile?: SecurityProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: string;
  onAddTransaction?: (accountId: string, securityId: string, symbol: string, name: string) => void;
}

function DetailRow({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: "gain" | "loss";
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-right">
        <span
          className={`text-sm font-medium tabular-nums ${
            color === "gain"
              ? "text-gain"
              : color === "loss"
                ? "text-loss"
                : ""
          }`}
        >
          {value}
        </span>
        {sub && (
          <p
            className={`text-[10px] tabular-nums ${
              color === "gain"
                ? "text-gain"
                : color === "loss"
                  ? "text-loss"
                  : "text-muted-foreground"
            }`}
          >
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

function formatCompactMoney(cents: number, locale: string): string {
  const value = cents / 100;
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(1)}T`;
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  return formatMoney(cents, locale);
}

function formatDate(isoString: string, locale: string): string {
  return new Date(isoString).toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function recommendationLabel(mean: number, t: ReturnType<typeof useTranslations<"holdings">>): string {
  if (mean <= 1.5) return t("strongBuy");
  if (mean <= 2.5) return t("buy");
  if (mean <= 3.5) return t("hold");
  if (mean <= 4.5) return t("sell");
  return t("strongSell");
}

function recommendationColor(mean: number): string {
  if (mean <= 1.5) return "text-gain";
  if (mean <= 2.5) return "text-gain";
  if (mean <= 3.5) return "text-muted-foreground";
  return "text-loss";
}

function payoutRatioColor(ratio: number): string {
  if (ratio < 0.6) return "text-gain";
  if (ratio < 0.8) return "text-amber-600 dark:text-amber-400";
  return "text-loss";
}

export function PositionDetailSheet({
  position,
  profile,
  open,
  onOpenChange,
  locale,
  onAddTransaction,
}: Props) {
  const t = useTranslations("holdings");
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  if (!position) return null;
  const h = position;
  const p = profile;

  const frequencyKey = h.dividendFrequency
    ? (`frequency${h.dividendFrequency.charAt(0).toUpperCase()}${h.dividendFrequency.slice(1)}` as Parameters<typeof t>[0])
    : null;

  const hasSecurityInfo = h.sector || h.industry;
  const hasKeyDates = p?.exDividendDate || p?.nextEarningsDate;
  const hasValuation = p?.trailingPeRatio != null || p?.marketCapCents != null || (p?.fiftyTwoWeekLowCents != null && p?.fiftyTwoWeekHighCents != null);
  const hasDividendIncome = h.annualDividendPerShareCents !== null || h.expectedIncomeCents !== null;
  const hasDividendSafety = p?.payoutRatio != null || p?.fiveYearAvgDividendYield != null;
  const hasFinancialHealth = p?.debtToEquityRatio != null || p?.freeCashFlowCents != null;
  const hasAnalyst = p?.analystRecommendationMean != null;
  const hasAbout = p?.longBusinessSummary || p?.website || p?.employeeCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-5xl">
        {/* Header — symbol/name left, market value right */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <DialogHeader className="flex-1 space-y-1">
            <DialogTitle className="text-lg">{h.symbol}</DialogTitle>
            <DialogDescription>
              {h.name} · {t("positionInAccount", { accountName: h.accountName })}
            </DialogDescription>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Badge variant="outline">{h.currency}</Badge>
              <Badge variant="outline">{h.exchange}</Badge>
              <Badge variant="secondary">
                {t(`accountType${h.accountType}` as Parameters<typeof t>[0])}
              </Badge>
              <Badge variant="secondary">
                {t(`assetClass${h.assetClass}` as Parameters<typeof t>[0])}
              </Badge>
              {h.isDividendKing && (
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                  {t("dividendKing")}
                </Badge>
              )}
              {h.isDividendAristocrat && !h.isDividendKing && (
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                  {t("dividendAristocrat")}
                </Badge>
              )}
            </div>
          </DialogHeader>

          <div className="text-left sm:text-right sm:shrink-0 sm:pt-6">
            <p className="text-2xl font-bold tabular-nums">
              {h.marketValueCents !== null
                ? formatMoney(h.marketValueCents, locale)
                : formatMoney(h.totalCostCents, locale)}
            </p>
            {h.dayChangeCents !== null && h.dayChangePercent !== null && (
              <p
                className={`text-sm tabular-nums ${
                  h.dayChangeCents >= 0 ? "text-gain" : "text-loss"
                }`}
              >
                {h.dayChangeCents >= 0 ? "+" : ""}
                {formatMoney(h.dayChangeCents, locale)}{" "}
                ({h.dayChangePercent >= 0 ? "+" : ""}
                {formatPercent(h.dayChangePercent, locale)}) {t("today")}
              </p>
            )}
          </div>
        </div>

        <Separator />

        {/* Three-column body */}
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* ── Column 1: Your Position ── */}
          <div className="flex flex-col gap-4">
            {/* Cost Basis & Performance */}
            <div>
              <SectionHeading>{t("costBasis")}</SectionHeading>
              <DetailRow
                label={t("quantity")}
                value={formatNumber(h.quantity, locale, 0)}
              />
              <DetailRow
                label={t("avgCost")}
                value={formatMoney(h.avgCostCents, locale)}
              />
              <DetailRow
                label={t("totalCost")}
                value={formatMoney(h.totalCostCents, locale)}
              />
              <DetailRow
                label={t("currentPrice")}
                value={
                  h.currentPriceCents !== null
                    ? formatMoney(h.currentPriceCents, locale)
                    : "—"
                }
              />
              {h.unrealizedGainCents !== null && (
                <DetailRow
                  label={t("unrealizedGain")}
                  value={`${h.unrealizedGainCents >= 0 ? "+" : ""}${formatMoney(h.unrealizedGainCents, locale)}`}
                  sub={
                    h.unrealizedGainPercent !== null
                      ? `${h.unrealizedGainPercent >= 0 ? "+" : ""}${formatPercent(h.unrealizedGainPercent, locale)}`
                      : undefined
                  }
                  color={h.unrealizedGainCents >= 0 ? "gain" : "loss"}
                />
              )}
            </div>

            {/* Security Info */}
            {hasSecurityInfo && (
              <>
                <Separator />
                <div>
                  <SectionHeading>{t("securityInfo")}</SectionHeading>
                  {h.sector && (
                    <DetailRow label={t("sector")} value={h.sector} />
                  )}
                  {h.industry && (
                    <DetailRow label={t("industry")} value={h.industry} />
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── Column 2: Dividends ── */}
          <div className="flex flex-col gap-4">
            {/* Dividend Income */}
            {hasDividendIncome && (
              <div>
                <SectionHeading>{t("dividendIncome")}</SectionHeading>
                {h.annualDividendPerShareCents !== null && (
                  <DetailRow
                    label={t("annualDividendPerShare")}
                    value={formatMoney(h.annualDividendPerShareCents, locale)}
                  />
                )}
                {h.expectedIncomeCents !== null && (
                  <DetailRow
                    label={t("expectedIncome")}
                    value={formatMoney(h.expectedIncomeCents, locale)}
                  />
                )}
                {h.yieldPercent !== null && (
                  <DetailRow
                    label={t("yield")}
                    value={formatPercent(h.yieldPercent, locale)}
                  />
                )}
                {h.yieldOnCostPercent !== null && (
                  <DetailRow
                    label={t("yieldOnCost")}
                    value={formatPercent(h.yieldOnCostPercent, locale)}
                  />
                )}
                {frequencyKey && (
                  <DetailRow
                    label={t("dividendFrequency")}
                    value={t(frequencyKey)}
                  />
                )}
                {h.dividendGrowthYears != null && h.dividendGrowthYears > 0 && (
                  <DetailRow
                    label={t("divGrowthYears", { count: h.dividendGrowthYears })}
                    value=""
                  />
                )}
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {h.isPaysMonthly && (
                    <Badge variant="outline" className="text-[10px]">
                      {t("monthlyPayer")}
                    </Badge>
                  )}
                  {h.isDividendAristocrat && (
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-[10px]">
                      {t("dividendAristocrat")}
                    </Badge>
                  )}
                  {h.isDividendKing && (
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-[10px]">
                      {t("dividendKing")}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Dividend Safety */}
            {hasDividendSafety && (
              <>
                {hasDividendIncome && <Separator />}
                <div>
                  <SectionHeading>{t("dividendSafety")}</SectionHeading>
                  {p?.payoutRatio != null && (
                    <div className="flex items-baseline justify-between gap-2 py-1">
                      <span className="text-sm text-muted-foreground">{t("payoutRatio")}</span>
                      <span className={`text-sm font-medium tabular-nums ${payoutRatioColor(p.payoutRatio)}`}>
                        {formatPercent(p.payoutRatio, locale)}
                      </span>
                    </div>
                  )}
                  {p?.fiveYearAvgDividendYield != null && (
                    <DetailRow
                      label={t("fiveYearAvgYield")}
                      value={formatPercent(p.fiveYearAvgDividendYield / 100, locale)}
                    />
                  )}
                </div>
              </>
            )}

            {/* Key Dates */}
            {hasKeyDates && (
              <>
                {(hasDividendIncome || hasDividendSafety) && <Separator />}
                <div>
                  <SectionHeading>{t("keyDates")}</SectionHeading>
                  {p?.exDividendDate && (
                    <DetailRow
                      label={t("exDividendDate")}
                      value={formatDate(p.exDividendDate, locale)}
                    />
                  )}
                  {p?.nextEarningsDate && (
                    <DetailRow
                      label={t("nextEarningsDate")}
                      value={formatDate(p.nextEarningsDate, locale)}
                    />
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── Column 3: Market Analysis ── */}
          <div className="flex flex-col gap-4">
            {/* Valuation */}
            {hasValuation && (
              <div>
                <SectionHeading>{t("valuation")}</SectionHeading>
                {p?.trailingPeRatio != null && (
                  <DetailRow
                    label={t("trailingPE")}
                    value={p.trailingPeRatio.toFixed(1)}
                  />
                )}
                {p?.marketCapCents != null && (
                  <DetailRow
                    label={t("marketCap")}
                    value={formatCompactMoney(p.marketCapCents, locale)}
                  />
                )}
                {p?.fiftyTwoWeekLowCents != null && p?.fiftyTwoWeekHighCents != null && (
                  <div className="py-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm text-muted-foreground">{t("fiftyTwoWeekRange")}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 text-[11px] tabular-nums text-muted-foreground">
                      <span>{formatMoney(p.fiftyTwoWeekLowCents, locale)}</span>
                      <div className="relative h-1.5 flex-1 rounded-full bg-muted">
                        {h.currentPriceCents != null && (
                          <div
                            className="absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-primary"
                            style={{
                              left: `${Math.min(100, Math.max(0, ((h.currentPriceCents - p.fiftyTwoWeekLowCents) / (p.fiftyTwoWeekHighCents - p.fiftyTwoWeekLowCents)) * 100))}%`,
                            }}
                          />
                        )}
                      </div>
                      <span>{formatMoney(p.fiftyTwoWeekHighCents, locale)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Financial Health */}
            {hasFinancialHealth && (
              <>
                {hasValuation && <Separator />}
                <div>
                  <SectionHeading>{t("financialHealth")}</SectionHeading>
                  {p?.debtToEquityRatio != null && (
                    <DetailRow
                      label={t("debtToEquity")}
                      value={p.debtToEquityRatio.toFixed(1)}
                    />
                  )}
                  {p?.freeCashFlowCents != null && (
                    <DetailRow
                      label={t("freeCashFlow")}
                      value={formatCompactMoney(p.freeCashFlowCents, locale)}
                    />
                  )}
                </div>
              </>
            )}

            {/* Analyst View */}
            {hasAnalyst && p?.analystRecommendationMean != null && (
              <>
                {(hasValuation || hasFinancialHealth) && <Separator />}
                <div>
                  <SectionHeading>{t("analystView")}</SectionHeading>
                  <div className="flex items-baseline justify-between gap-2 py-1">
                    <span className="text-sm text-muted-foreground">{t("recommendation")}</span>
                    <span className={`text-sm font-medium ${recommendationColor(p.analystRecommendationMean)}`}>
                      {recommendationLabel(p.analystRecommendationMean, t)} ({p.analystRecommendationMean.toFixed(1)})
                    </span>
                  </div>
                  {p.numberOfAnalystOpinions != null && (
                    <div className="flex items-baseline justify-between gap-2 py-1">
                      <span className="text-sm text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {t("analysts", { count: p.numberOfAnalystOpinions })}
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* About (full width) */}
        {hasAbout && (
          <>
            <Separator />
            <div>
              <SectionHeading>{t("about")}</SectionHeading>
              {p?.longBusinessSummary && (
                <div className="mb-2">
                  <p className={`text-sm text-muted-foreground ${summaryExpanded ? "" : "line-clamp-3"}`}>
                    {p.longBusinessSummary}
                  </p>
                  {p.longBusinessSummary.length > 200 && (
                    <button
                      type="button"
                      className="mt-1 text-xs font-medium text-primary hover:underline"
                      onClick={() => setSummaryExpanded(!summaryExpanded)}
                    >
                      {summaryExpanded ? t("showLess") : t("showMore")}
                    </button>
                  )}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {p?.employeeCount != null && (
                  <span>{t("employees", { count: p.employeeCount.toLocaleString(locale === "fr" ? "fr-CA" : "en-CA") })}</span>
                )}
                {p?.website && (
                  <a
                    href={p.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {new URL(p.website).hostname.replace("www.", "")}
                    <ExternalLinkIcon className="size-3" />
                  </a>
                )}
              </div>
            </div>
          </>
        )}

        {/* Actions */}
        <DialogFooter className="flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <Button variant="outline" className="w-full sm:w-auto" asChild>
            <Link
              href={`/${locale}/transactions?security=${encodeURIComponent(h.symbol)}`}
            >
              {t("viewTransactions")}
            </Link>
          </Button>
          {onAddTransaction && (
            <Button
              className="w-full sm:w-auto"
              onClick={() => {
                onAddTransaction(h.accountId, h.securityId, h.symbol, h.name);
                onOpenChange(false);
              }}
            >
              {t("addTransaction")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
