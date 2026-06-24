"use client";

import { useTranslations } from "next-intl";
import { Shield, Gem, Diamond, Crown, Flame } from "lucide-react";
import { formatMoney, formatPercent } from "@/lib/money/format";
import type { HeroData } from "@/lib/dashboard/hero";
import type { MilestoneTier, TierName } from "@/lib/dashboard/net-worth-milestones";

interface FreedomHeroCardProps {
  locale: string;
  hero: HeroData;
  tier: MilestoneTier;
}

const TIER_ICON: Record<TierName, typeof Shield> = {
  iron: Shield,
  bronze: Shield,
  silver: Shield,
  gold: Shield,
  platinum: Gem,
  emerald: Gem,
  diamond: Diamond,
  master: Crown,
  grandmaster: Crown,
  challenger: Flame,
};

const TIER_VAR: Record<TierName, string> = {
  iron: "var(--tier-iron)",
  bronze: "var(--tier-bronze)",
  silver: "var(--tier-silver)",
  gold: "var(--tier-gold)",
  platinum: "var(--tier-platinum)",
  emerald: "var(--tier-emerald)",
  diamond: "var(--tier-diamond)",
  master: "var(--tier-master)",
  grandmaster: "var(--tier-grandmaster)",
  challenger: "var(--tier-challenger)",
};

const TIER_I18N_KEY: Record<TierName, string> = {
  iron: "tierIron",
  bronze: "tierBronze",
  silver: "tierSilver",
  gold: "tierGold",
  platinum: "tierPlatinum",
  emerald: "tierEmerald",
  diamond: "tierDiamond",
  master: "tierMaster",
  grandmaster: "tierGrandmaster",
  challenger: "tierChallenger",
};

/**
 * Lead "freedom" hero — answers "Am I free yet?".
 * Coverage donut, on-track status, projected vs target income, and the income
 * composition tiles. Carries the portfolio-rank tier badge top-right.
 */
export function FreedomHeroCard({ locale, hero, tier }: FreedomHeroCardProps) {
  const t = useTranslations("dashboard");

  const coverage = hero.retirementCoveragePercent;
  const onTrack = coverage >= 1.0;
  const coverageColor =
    coverage >= 1.0 ? "var(--gain)" : coverage >= 0.8 ? "var(--warning)" : "var(--loss)";
  const statusColor = onTrack ? "text-gain" : coverage >= 0.8 ? "text-warning" : "text-loss";

  // Ring fill is clamped to 100%; the centre label shows the true percentage.
  const ringPct = Math.min(100, Math.max(0, coverage * 100));

  const TierIcon = TIER_ICON[tier.name];
  const tierVar = TIER_VAR[tier.name];

  return (
    <div className="flex flex-col rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("freedom")}
        </p>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold"
          style={{
            background: `color-mix(in oklch, ${tierVar} 14%, transparent)`,
            color: tierVar,
          }}
        >
          <TierIcon className="size-3.5" />
          {t(TIER_I18N_KEY[tier.name])}
        </span>
      </div>

      <div className="mt-3.5 flex items-center gap-5">
        {/* Coverage donut */}
        <div className="relative size-28 shrink-0">
          <div
            className="size-full rounded-full"
            style={{
              background: `conic-gradient(${coverageColor} 0 ${ringPct}%, var(--muted) ${ringPct}% 100%)`,
            }}
          />
          <div className="absolute inset-[13px] flex flex-col items-center justify-center rounded-full bg-card">
            <span className="text-2xl font-extrabold tabular-nums">
              {formatPercent(coverage, locale, 0)}
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("covered")}
            </span>
          </div>
        </div>

        <div className="min-w-0">
          <p className={`text-[15px] font-bold ${statusColor}`}>
            {onTrack
              ? t("freedomOnTrack", { age: hero.targetRetirementAge })
              : t("freedomBehind", { age: hero.targetRetirementAge })}
          </p>
          <p className="mt-1.5 text-[13px] tabular-nums text-foreground/80">
            {formatMoney(hero.totalIncomeAtRetirementCents, locale)}
            <span className="text-muted-foreground">
              {t("perYear")} {t("projectedSuffix")}
            </span>
          </p>
          <p className="text-[13px] tabular-nums text-foreground/80">
            {formatMoney(hero.targetIncomeCents, locale)}
            <span className="text-muted-foreground">
              {t("perYear")} {t("targetSuffix")}
            </span>
          </p>
        </div>
      </div>

      {/* Income composition tiles */}
      <div className="mt-auto grid grid-cols-3 gap-2 pt-4">
        <IncomeTile label={t("dividends")} cents={hero.dividendIncomeAtRetirementCents} locale={locale} />
        <IncomeTile label={t("pensionIncome")} cents={hero.pensionIncomeCents} locale={locale} />
        <IncomeTile label={t("otherIncome")} cents={hero.otherStreamIncomeCents} locale={locale} />
      </div>
    </div>
  );
}

function IncomeTile({ label, cents, locale }: { label: string; cents: number; locale: string }) {
  return (
    <div className="rounded-lg bg-muted px-1 py-2 text-center">
      <p className="text-[15px] font-bold tabular-nums">{formatCompactMoney(cents, locale)}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

/** Compact money like "$26.8k" for tight tiles. */
function formatCompactMoney(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "CAD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(cents / 100);
}
