"use client";

import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/money/format";
import type { ContributionYearRow } from "@/lib/contributions/compute";
import { Progress } from "@/components/ui/progress";

interface CurrentYearSummaryProps {
  row: ContributionYearRow;
  locale: string;
}

export function CurrentYearSummary({ row, locale }: CurrentYearSummaryProps) {
  const t = useTranslations("contributions");

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold">
        {row.year} — {t("summary")}
      </h2>

      <div className="mt-4 grid gap-6 md:grid-cols-3">
        <RoomCard
          label="REER"
          limitCents={row.reerLimitCents}
          contributedCents={row.reerContributionCents}
          cumulativeRoomCents={row.reerCumulativeRoomCents}
          locale={locale}
          t={t}
        />
        <RoomCard
          label="CELI"
          limitCents={row.celiLimitCents}
          contributedCents={row.celiContributionCents}
          cumulativeRoomCents={row.celiCumulativeRoomCents}
          locale={locale}
          t={t}
        />
        <RoomCard
          label="CRCD"
          limitCents={row.crcdCraLimitCents}
          contributedCents={row.crcdContributionCents}
          cumulativeRoomCents={row.crcdRemainingCents}
          locale={locale}
          t={t}
        />
      </div>

      {row.margeContributionCents > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Marge {t("contributed")}</span>
          <span className="font-medium">
            {formatMoney(row.margeContributionCents, locale)}
          </span>
        </div>
      )}
    </div>
  );
}

function RoomCard({
  label,
  limitCents,
  contributedCents,
  cumulativeRoomCents,
  locale,
  t,
}: {
  label: string;
  limitCents: number;
  contributedCents: number;
  cumulativeRoomCents: number;
  locale: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const pct = limitCents > 0 ? Math.round((contributedCents / limitCents) * 100) : 0;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">{label}</h3>
      <Progress value={pct} className="h-2" />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {formatMoney(contributedCents, locale)} / {formatMoney(limitCents, locale)}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{t("totalRemaining")}</span>
        <span className="font-semibold">{formatMoney(cumulativeRoomCents, locale)}</span>
      </div>
    </div>
  );
}
