"use client";

import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/money/format";
import type { ContributionRoomData } from "@/lib/dashboard/contribution-room";
import { Progress } from "@/components/ui/progress";

interface ContributionRoomCardProps {
  locale: string;
  room: ContributionRoomData;
}

export function ContributionRoomCard({ locale, room }: ContributionRoomCardProps) {
  const t = useTranslations("dashboard");

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <p className="text-sm font-medium">
        {t("contributionRoom", { year: room.year })}
      </p>

      <div className="mt-4 space-y-4">
        <RoomRow
          label={t("reerRoom")}
          contributedCents={room.reer.contributedCents}
          limitCents={room.reer.limitCents}
          remainingCents={room.reerCumulativeRemainingCents}
          locale={locale}
        />
        <RoomRow
          label={t("celiRoom")}
          contributedCents={room.celi.contributedCents}
          limitCents={room.celi.limitCents}
          remainingCents={room.celiCumulativeRemainingCents}
          locale={locale}
        />
        <RoomRow
          label={t("crcdContributed")}
          contributedCents={room.crcd.contributedCents}
          limitCents={room.crcd.limitCents}
          remainingCents={room.crcd.remainingCents}
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
  remainingCents,
  locale,
}: {
  label: string;
  contributedCents: number;
  limitCents: number;
  remainingCents: number;
  locale: string;
}) {
  const pct = limitCents > 0 ? Math.round((contributedCents / limitCents) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {formatMoney(remainingCents, locale)}
        </span>
      </div>
      <Progress value={pct} className="mt-1 h-2" />
      <p className="mt-0.5 text-right text-xs text-muted-foreground">
        {formatMoney(contributedCents, locale)} / {formatMoney(limitCents, locale)}
      </p>
    </div>
  );
}
