"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { formatPercent } from "@/lib/money/format";
import {
  formatMilestone,
  type MilestoneProgressData,
} from "@/lib/dashboard/net-worth-milestones";

interface MilestoneProgressCardProps {
  locale: string;
  data: MilestoneProgressData;
}

export function MilestoneProgressCard({ locale, data }: MilestoneProgressCardProps) {
  const t = useTranslations("dashboard");
  const [timelineOpen, setTimelineOpen] = useState(false);

  const pct = Math.round(data.progressPercent * 100);
  const barColor =
    pct >= 90 ? "bg-gain" : pct >= 50 ? "bg-warning" : "bg-chart-1";

  const growthPositive = data.trailingGrowthRate !== null && data.trailingGrowthRate >= 0;
  const growthColor = data.trailingGrowthRate === null
    ? "text-muted-foreground"
    : growthPositive
      ? "text-gain"
      : "text-loss";

  const estimatedDateFormatted = data.estimatedDate
    ? formatShortDate(data.estimatedDate, locale)
    : null;

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <p className="mb-4 text-sm font-medium">{t("milestones")}</p>

      {/* Progress section */}
      <div className="space-y-2">
        {/* Label row */}
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium">
            {formatMilestone(data.previousMilestoneCents)}
            {" \u2192 "}
            {formatMilestone(data.nextMilestoneCents)}
          </span>
          <span className="font-semibold tabular-nums">{pct}%</span>
        </div>

        {/* Progress bar */}
        <div className="relative h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${barColor} ${pct >= 90 ? "animate-[milestone-glow_2s_ease-in-out_infinite]" : ""}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Estimated date */}
        <div className="flex items-baseline justify-between text-xs text-muted-foreground">
          <span>{t("nextMilestone")}</span>
          <span>
            {estimatedDateFormatted
              ? t("milestoneEstDate", { date: estimatedDateFormatted })
              : t("milestoneNoEstimate")}
          </span>
        </div>

        {/* Trailing growth */}
        {data.trailingGrowthRate !== null && (
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">{t("milestoneTrailing")}</span>
            <span className={`font-medium ${growthColor}`}>
              {growthPositive ? "+" : ""}
              {formatPercent(data.trailingGrowthRate, locale, 1)}
            </span>
          </div>
        )}
      </div>

      {/* Passed milestones timeline */}
      {data.passedMilestones.length > 0 ? (
        <div className="mt-4">
          <button
            onClick={() => setTimelineOpen(!timelineOpen)}
            className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>
              {t("milestonesPassed", { count: data.passedMilestones.length })}
            </span>
            {timelineOpen ? (
              <ChevronUpIcon className="size-3.5" />
            ) : (
              <ChevronDownIcon className="size-3.5" />
            )}
          </button>

          {timelineOpen && (
            <div className="mt-3 ml-2 border-l-2 border-muted space-y-3">
              {[...data.passedMilestones].reverse().map((m) => (
                <div key={m.thresholdCents} className="relative pl-4">
                  <div className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-primary" />
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-medium">
                      {formatMilestone(m.thresholdCents)}
                    </span>
                    <span className="text-muted-foreground">
                      {formatShortDate(m.dateReached, locale)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          {t("milestoneNoPassed")}
        </p>
      )}
    </div>
  );
}

/** Format an ISO date string as "MMM yyyy" using Intl. */
function formatShortDate(isoDate: string, locale: string): string {
  const d = new Date(isoDate);
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "numeric",
  }).format(d);
}
