"use client";

import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/money/format";
import type { ContributionRoomData } from "@/lib/dashboard/contribution-room";

interface ContributionRoomCardProps {
  locale: string;
  room: ContributionRoomData;
}

export function ContributionRoomCard({ locale, room }: ContributionRoomCardProps) {
  const t = useTranslations("dashboard");

  const goalCents = room.savingsGoalCents;
  const totalCents = room.totalDepositCents;
  const goalPct = goalCents > 0 ? Math.min(100, Math.round((totalCents / goalCents) * 100)) : 0;
  const goalMet = goalCents > 0 && totalCents >= goalCents;
  const toGoCents = Math.max(0, goalCents - totalCents);

  const accounts = [room.reer, room.celi, room.crcd];
  const roomLeftCents = accounts.reduce(
    (sum, a) => sum + Math.max(0, a.limitCents - a.contributedCents),
    0,
  );

  // Monthly contribution pace: deposits so far ÷ months elapsed this year.
  const monthsElapsed = new Date().getMonth() + 1;
  const perMonthCents = Math.round(totalCents / monthsElapsed);

  // Days left until Dec 31 of the contribution year.
  const daysLeft = Math.max(
    0,
    Math.ceil((Date.UTC(room.year, 11, 31) - new Date().getTime()) / 86_400_000),
  );

  return (
    <div className="flex flex-col rounded-xl border bg-card p-[22px] shadow-sm">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold">{t("contributions", { year: room.year })}</p>
        {totalCents > 0 && (
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {t("perMonthAvg", { amount: formatCompactMoney(perMonthCents, locale) })}
          </span>
        )}
      </div>

      {/* Savings goal */}
      {goalCents > 0 && (
        <div className="mt-3">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">{t("savingsGoal")}</span>
            <span className="font-semibold tabular-nums">
              {formatMoney(totalCents, locale)}
              <span className="font-medium text-muted-foreground"> / {formatMoney(goalCents, locale)}</span>
            </span>
          </div>
          <div className="relative mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${goalMet ? "bg-gain" : "bg-primary"}`}
              style={{ width: `${goalPct}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">
            {t("goalProgressDetail", { pct: goalPct, amount: formatMoney(toGoCents, locale) })}
          </p>
        </div>
      )}

      {/* Per-account room bars (stacked) */}
      <p className="mt-4 mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {t("byAccount")}
      </p>
      <div className="space-y-3.5">
        <RoomRow
          label={t("reerRoom")}
          contributedCents={room.reer.contributedCents}
          limitCents={room.reer.limitCents}
          locale={locale}
          maxedLabel={t("maxed")}
        />
        <RoomRow
          label={t("celiRoom")}
          contributedCents={room.celi.contributedCents}
          limitCents={room.celi.limitCents}
          locale={locale}
          maxedLabel={t("maxed")}
        />
        <RoomRow
          label={t("crcdContributed")}
          contributedCents={room.crcd.contributedCents}
          limitCents={room.crcd.limitCents}
          locale={locale}
          maxedLabel={t("maxed")}
        />
      </div>

      {/* Room-left callout — pinned to the bottom */}
      {roomLeftCents > 0 && (
        <>
          <div className="min-h-[16px] flex-1" />
          <div className="flex items-center justify-between gap-2 rounded-lg bg-primary/[0.07] px-3.5 py-3">
            <p className="text-xs text-foreground/80">
              {t("roomLeft", { amount: formatMoney(roomLeftCents, locale) })}
            </p>
            <span className="shrink-0 text-[11px] font-semibold text-primary">
              {t("daysLeft", { count: daysLeft })}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

/** Compact money like "$2.6k" for tight annotations. */
function formatCompactMoney(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "CAD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(cents / 100);
}

function RoomRow({
  label,
  contributedCents,
  limitCents,
  locale,
  maxedLabel,
}: {
  label: string;
  contributedCents: number;
  limitCents: number;
  locale: string;
  maxedLabel: string;
}) {
  const contributedPct =
    limitCents > 0 ? Math.min(100, Math.round((contributedCents / limitCents) * 100)) : 0;
  const maxed = limitCents > 0 && contributedCents >= limitCents;

  const barColor = contributedPct >= 90 ? "bg-gain" : contributedPct >= 50 ? "bg-warning" : "bg-chart-1";

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {formatMoney(contributedCents, locale)} / {formatMoney(limitCents, locale)}
          {maxed && ` · ${maxedLabel}`}
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${contributedPct}%` }}
        />
      </div>
    </div>
  );
}
