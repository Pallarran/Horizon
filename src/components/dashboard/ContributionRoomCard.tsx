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

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <p className="text-sm font-medium">
        {t("contributions", { year: room.year })}
      </p>

      {/* Savings goal */}
      {goalCents > 0 && (
        <div className="mt-3">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">{t("savingsGoal")}</span>
            <span className="font-medium">
              {formatMoney(totalCents, locale)}
              <span className="text-muted-foreground"> / {formatMoney(goalCents, locale)}</span>
            </span>
          </div>
          <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${goalMet ? "bg-gain" : "bg-primary"}`}
              style={{ width: `${goalPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Contribution room bars */}
      <div className="mt-3 space-y-2">
        <RoomRow
          label={t("reerRoom")}
          contributedCents={room.reer.contributedCents}
          limitCents={room.reer.limitCents}
          locale={locale}
        />
        <RoomRow
          label={t("celiRoom")}
          contributedCents={room.celi.contributedCents}
          limitCents={room.celi.limitCents}
          locale={locale}
        />
        <RoomRow
          label={t("crcdContributed")}
          contributedCents={room.crcd.contributedCents}
          limitCents={room.crcd.limitCents}
          locale={locale}
        />
      </div>
    </div>
  );
}

function RoomRow({
  label,
  contributedCents,
  limitCents,
  locale,
}: {
  label: string;
  contributedCents: number;
  limitCents: number;
  locale: string;
}) {
  const contributedPct = limitCents > 0 ? Math.min(100, Math.round((contributedCents / limitCents) * 100)) : 0;

  const barColor =
    contributedPct >= 90
      ? "bg-gain"
      : contributedPct >= 50
        ? "bg-warning"
        : "bg-chart-1";

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-14 shrink-0 text-muted-foreground">{label}</span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${contributedPct}%` }}
        />
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatMoney(contributedCents, locale)} / {formatMoney(limitCents, locale)}
      </span>
    </div>
  );
}
