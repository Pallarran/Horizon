"use client";

import { useTranslations } from "next-intl";
import { Shield, Gem, Diamond, Crown, Flame } from "lucide-react";
import { formatMoney, formatPercent } from "@/lib/money/format";
import type { NetWorthData } from "@/lib/dashboard/net-worth";
import {
  formatMilestone,
  type MilestoneProgressData,
  type TierName,
} from "@/lib/dashboard/net-worth-milestones";

interface KpiStripProps {
  locale: string;
  netWorth: NetWorthData;
  milestoneProgress: MilestoneProgressData;
}

const TIER_ICON: Record<TierName, typeof Shield> = {
  iron:        Shield,
  bronze:      Shield,
  silver:      Shield,
  gold:        Shield,
  platinum:    Gem,
  emerald:     Gem,
  diamond:     Diamond,
  master:      Crown,
  grandmaster: Crown,
  challenger:  Flame,
};

const TIER_COLOR_CLASS: Record<TierName, string> = {
  iron:        "text-tier-iron",
  bronze:      "text-tier-bronze",
  silver:      "text-tier-silver",
  gold:        "text-tier-gold",
  platinum:    "text-tier-platinum",
  emerald:     "text-tier-emerald",
  diamond:     "text-tier-diamond",
  master:      "text-tier-master",
  grandmaster: "text-tier-grandmaster",
  challenger:  "text-tier-challenger",
};

const TIER_I18N_KEY: Record<TierName, string> = {
  iron:        "tierIron",
  bronze:      "tierBronze",
  silver:      "tierSilver",
  gold:        "tierGold",
  platinum:    "tierPlatinum",
  emerald:     "tierEmerald",
  diamond:     "tierDiamond",
  master:      "tierMaster",
  grandmaster: "tierGrandmaster",
  challenger:  "tierChallenger",
};

export function KpiStrip({ locale, netWorth, milestoneProgress }: KpiStripProps) {
  const t = useTranslations("dashboard");

  const dayPositive = netWorth.dayChangeCents >= 0;
  const gainPositive = netWorth.unrealizedGainCents >= 0;

  const tier = milestoneProgress.tier;
  const nextTier = milestoneProgress.nextTier;
  const TierIcon = TIER_ICON[tier.name];
  const tierColor = TIER_COLOR_CLASS[tier.name];

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

      {/* Portfolio Rank */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("portfolioRank")}
        </p>
        <p className="mt-1 flex items-center gap-2">
          <TierIcon className={`size-6 ${tierColor}`} />
          <span className={`text-2xl font-bold tracking-tight ${tierColor}`}>
            {t(TIER_I18N_KEY[tier.name])}
          </span>
          {nextTier && (
            <span className="ml-auto text-xs text-muted-foreground">
              → {t(TIER_I18N_KEY[nextTier.name])} ({formatMilestone(nextTier.thresholdCents)})
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
