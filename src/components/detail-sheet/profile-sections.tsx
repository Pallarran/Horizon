"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ExternalLinkIcon } from "lucide-react";
import { formatMoney, formatPercent } from "@/lib/money/format";
import type { SecurityProfile } from "@/lib/positions/security-profile";
import { Separator } from "@/components/ui/separator";
import {
  DetailRow,
  SectionHeading,
  formatCompactMoney,
  formatDate,
  payoutRatioColor,
  recommendationLabel,
  recommendationColor,
} from "./detail-helpers";

/* ── Security Info ── */

export function SecurityInfoSection({
  sector,
  industry,
  locale,
  showSeparator = true,
}: {
  sector: string | null;
  industry: string | null;
  locale: string;
  showSeparator?: boolean;
}) {
  const t = useTranslations("holdings");
  if (!sector && !industry) return null;
  return (
    <>
      {showSeparator && <Separator />}
      <div>
        <SectionHeading>{t("securityInfo")}</SectionHeading>
        {sector && <DetailRow label={t("sector")} value={sector} />}
        {industry && <DetailRow label={t("industry")} value={industry} />}
      </div>
    </>
  );
}

/* ── Dividend Safety ── */

export function DividendSafetySection({
  profile,
  locale,
  showSeparator = true,
}: {
  profile: SecurityProfile;
  locale: string;
  showSeparator?: boolean;
}) {
  const t = useTranslations("holdings");
  if (profile.payoutRatio == null && profile.fiveYearAvgDividendYield == null)
    return null;
  return (
    <>
      {showSeparator && <Separator />}
      <div>
        <SectionHeading>{t("dividendSafety")}</SectionHeading>
        {profile.payoutRatio != null && (
          <div className="flex items-baseline justify-between gap-2 py-1">
            <span className="text-sm text-muted-foreground">
              {t("payoutRatio")}
            </span>
            <span
              className={`text-sm font-medium tabular-nums ${payoutRatioColor(profile.payoutRatio)}`}
            >
              {formatPercent(profile.payoutRatio, locale)}
            </span>
          </div>
        )}
        {profile.fiveYearAvgDividendYield != null && (
          <DetailRow
            label={t("fiveYearAvgYield")}
            value={formatPercent(profile.fiveYearAvgDividendYield / 100, locale)}
          />
        )}
      </div>
    </>
  );
}

/* ── Key Dates ── */

export function KeyDatesSection({
  profile,
  locale,
  showSeparator = true,
}: {
  profile: SecurityProfile;
  locale: string;
  showSeparator?: boolean;
}) {
  const t = useTranslations("holdings");
  if (!profile.exDividendDate && !profile.nextEarningsDate) return null;
  return (
    <>
      {showSeparator && <Separator />}
      <div>
        <SectionHeading>{t("keyDates")}</SectionHeading>
        {profile.exDividendDate && (
          <DetailRow
            label={t("exDividendDate")}
            value={formatDate(profile.exDividendDate, locale)}
          />
        )}
        {profile.nextEarningsDate && (
          <DetailRow
            label={t("nextEarningsDate")}
            value={formatDate(profile.nextEarningsDate, locale)}
          />
        )}
      </div>
    </>
  );
}

/* ── Valuation ── */

export function ValuationSection({
  profile,
  locale,
  currentPriceCents,
  currency,
  showSeparator = false,
}: {
  profile: SecurityProfile;
  locale: string;
  currentPriceCents: number | null;
  currency?: string;
  showSeparator?: boolean;
}) {
  const t = useTranslations("holdings");
  const hasData =
    profile.trailingPeRatio != null ||
    profile.marketCapCents != null ||
    (profile.fiftyTwoWeekLowCents != null &&
      profile.fiftyTwoWeekHighCents != null);
  if (!hasData) return null;
  return (
    <>
      {showSeparator && <Separator />}
      <div>
        <SectionHeading>{t("valuation")}</SectionHeading>
        {profile.trailingPeRatio != null && (
          <DetailRow
            label={t("trailingPE")}
            value={profile.trailingPeRatio.toFixed(1)}
          />
        )}
        {profile.marketCapCents != null && (
          <DetailRow
            label={t("marketCap")}
            value={formatCompactMoney(profile.marketCapCents, locale)}
          />
        )}
        {profile.fiftyTwoWeekLowCents != null &&
          profile.fiftyTwoWeekHighCents != null && (
            <div className="py-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-muted-foreground">
                  {t("fiftyTwoWeekRange")}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-[11px] tabular-nums text-muted-foreground">
                <span>
                  {formatMoney(
                    profile.fiftyTwoWeekLowCents,
                    locale,
                    currency,
                  )}
                </span>
                <div className="relative h-1.5 flex-1 rounded-full bg-muted">
                  {currentPriceCents != null && currentPriceCents > 0 && (
                    <div
                      className="absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-primary"
                      style={{
                        left: `${Math.min(
                          100,
                          Math.max(
                            0,
                            ((currentPriceCents -
                              profile.fiftyTwoWeekLowCents) /
                              (profile.fiftyTwoWeekHighCents -
                                profile.fiftyTwoWeekLowCents)) *
                              100,
                          ),
                        )}%`,
                      }}
                    />
                  )}
                </div>
                <span>
                  {formatMoney(
                    profile.fiftyTwoWeekHighCents,
                    locale,
                    currency,
                  )}
                </span>
              </div>
            </div>
          )}
      </div>
    </>
  );
}

/* ── Financial Health ── */

export function FinancialHealthSection({
  profile,
  locale,
  showSeparator = true,
}: {
  profile: SecurityProfile;
  locale: string;
  showSeparator?: boolean;
}) {
  const t = useTranslations("holdings");
  if (profile.debtToEquityRatio == null && profile.freeCashFlowCents == null)
    return null;
  return (
    <>
      {showSeparator && <Separator />}
      <div>
        <SectionHeading>{t("financialHealth")}</SectionHeading>
        {profile.debtToEquityRatio != null && (
          <DetailRow
            label={t("debtToEquity")}
            value={profile.debtToEquityRatio.toFixed(1)}
          />
        )}
        {profile.freeCashFlowCents != null && (
          <DetailRow
            label={t("freeCashFlow")}
            value={formatCompactMoney(profile.freeCashFlowCents, locale)}
          />
        )}
      </div>
    </>
  );
}

/* ── Analyst View ── */

export function AnalystViewSection({
  profile,
  locale,
  showSeparator = true,
}: {
  profile: SecurityProfile;
  locale: string;
  showSeparator?: boolean;
}) {
  const t = useTranslations("holdings");
  if (profile.analystRecommendationMean == null) return null;
  return (
    <>
      {showSeparator && <Separator />}
      <div>
        <SectionHeading>{t("analystView")}</SectionHeading>
        <div className="flex items-baseline justify-between gap-2 py-1">
          <span className="text-sm text-muted-foreground">
            {t("recommendation")}
          </span>
          <span
            className={`text-sm font-medium ${recommendationColor(profile.analystRecommendationMean)}`}
          >
            {recommendationLabel(profile.analystRecommendationMean, t)} (
            {profile.analystRecommendationMean.toFixed(1)})
          </span>
        </div>
        {profile.numberOfAnalystOpinions != null && (
          <div className="flex items-baseline justify-between gap-2 py-1">
            <span className="text-sm text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {t("analysts", { count: profile.numberOfAnalystOpinions })}
            </span>
          </div>
        )}
      </div>
    </>
  );
}

/* ── About ── */

export function AboutSection({
  profile,
  locale,
}: {
  profile: SecurityProfile;
  locale: string;
}) {
  const t = useTranslations("holdings");
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  if (!profile.longBusinessSummary && !profile.website && !profile.employeeCount)
    return null;

  return (
    <>
      <Separator />
      <div>
        <SectionHeading>{t("about")}</SectionHeading>
        {profile.longBusinessSummary && (
          <div className="mb-2">
            <p
              className={`text-sm text-muted-foreground ${summaryExpanded ? "" : "line-clamp-3"}`}
            >
              {profile.longBusinessSummary}
            </p>
            {profile.longBusinessSummary.length > 200 && (
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
          {profile.employeeCount != null && (
            <span>
              {t("employees", {
                count: profile.employeeCount.toLocaleString(
                  locale === "fr" ? "fr-CA" : "en-CA",
                ),
              })}
            </span>
          )}
          {profile.website && (
            <a
              href={profile.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              {new URL(profile.website).hostname.replace("www.", "")}
              <ExternalLinkIcon className="size-3" />
            </a>
          )}
        </div>
      </div>
    </>
  );
}
