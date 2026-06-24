"use client";

import { useTranslations } from "next-intl";
import { formatMoney, formatPercent } from "@/lib/money/format";
import {
  formatMilestone,
  type MilestoneProgressData,
} from "@/lib/dashboard/net-worth-milestones";

interface MilestoneBandCardProps {
  locale: string;
  data: MilestoneProgressData;
}

/**
 * Full-width milestone band — the motivational centrepiece. The $100K journey
 * gets a wide moment instead of being tucked into a side card.
 */
export function MilestoneBandCard({ locale, data }: MilestoneBandCardProps) {
  const t = useTranslations("dashboard");

  const pct = Math.round(data.progressPercent * 100);
  const reachedCount = data.passedMilestones.length;

  const growthPositive = data.trailingGrowthRate !== null && data.trailingGrowthRate >= 0;
  const growthColor =
    data.trailingGrowthRate === null
      ? "text-muted-foreground"
      : growthPositive
        ? "text-gain"
        : "text-loss";

  const estimatedDate = data.estimatedDate ? formatShortDate(data.estimatedDate, locale) : null;

  return (
    <div className="rounded-xl border bg-card px-[22px] py-[18px] shadow-sm">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        <div className="shrink-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("nextMilestone")}
          </p>
          <p className="mt-1 text-[22px] font-bold tabular-nums">
            {formatMilestone(data.previousMilestoneCents)}{" "}
            <span className="font-medium text-muted-foreground">→</span>{" "}
            {formatMilestone(data.nextMilestoneCents)}
          </p>
        </div>

        <div className="flex-1">
          <div className="mb-1.5 flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">
              {t("milestonesReachedCount", { count: reachedCount })}
              {data.trailingGrowthRate !== null && (
                <>
                  {" · "}
                  {t("trailingGrowth")}{" "}
                  <span className={`font-semibold ${growthColor}`}>
                    {growthPositive ? "+" : ""}
                    {formatPercent(data.trailingGrowthRate, locale, 1)}
                  </span>
                </>
              )}
            </span>
            <span className="text-[15px] font-bold tabular-nums">{pct}%</span>
          </div>

          <div className="relative h-3 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${pct >= 90 ? "animate-milestone-glow" : ""}`}
              style={{
                width: `${pct}%`,
                background: "linear-gradient(90deg, var(--primary), var(--gain))",
              }}
            />
          </div>

          <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-muted-foreground">
            <span>
              {formatMoney(data.currentCents, locale)} {t("nowSuffix")}
            </span>
            {estimatedDate && (
              <span>
                {t("estReach", {
                  amount: formatMilestone(data.nextMilestoneCents),
                  date: estimatedDate,
                })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatShortDate(isoDate: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" }).format(
    new Date(isoDate),
  );
}
