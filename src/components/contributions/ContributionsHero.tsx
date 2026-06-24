"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { formatMoney, formatPercent } from "@/lib/money/format";
import { saveSavingsGoalAction } from "@/lib/actions/contributions";
import type { ContributionYearRow } from "@/lib/contributions/compute";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X } from "lucide-react";

interface ContributionsHeroProps {
  currentRow: ContributionYearRow;
  locale: string;
  onUpdate: (rows: ContributionYearRow[]) => void;
}

export function ContributionsHero({ currentRow, locale, onUpdate }: ContributionsHeroProps) {
  const t = useTranslations("contributions");
  const [editing, setEditing] = useState(false);
  const [goalInput, setGoalInput] = useState(
    currentRow.savingsGoalCents > 0 ? (currentRow.savingsGoalCents / 100).toString() : "",
  );
  const [isPending, startTransition] = useTransition();

  const goalCents = currentRow.savingsGoalCents;
  const totalCents = currentRow.totalDepositCents;
  const pct = goalCents > 0 ? Math.min((totalCents / goalCents) * 100, 100) : 0;
  const pctLabel = goalCents > 0 ? formatPercent(totalCents / goalCents, locale, 0) : "0%";
  const goalMet = goalCents > 0 && totalCents >= goalCents;

  // Four condensed buckets for the mini stat tiles
  const nonRegCents =
    currentRow.margeDepositCents + currentRow.cashDepositCents + currentRow.otherDepositCents;
  const tiles = [
    { label: t("reerLabel"), cents: currentRow.reerDepositCents, color: "var(--chart-1)" },
    { label: t("celiLabel"), cents: currentRow.celiDepositCents, color: "var(--chart-2)" },
    { label: t("crcdLabel"), cents: currentRow.crcdDepositCents, color: "var(--chart-5)" },
    { label: t("nonRegLabel"), cents: nonRegCents, color: "var(--chart-4)" },
  ];

  // Registered room still open
  const reerRoom = Math.max(0, currentRow.reerCumulativeRoomCents);
  const celiRoom = Math.max(0, currentRow.celiCumulativeRoomCents);
  const crcdRoom = Math.max(0, currentRow.crcdRemainingCents);
  const roomOpen = reerRoom + celiRoom + crcdRoom;

  const roomParts: string[] = [];
  if (reerRoom > 0) roomParts.push(`${t("reerLabel")} ${formatMoney(reerRoom, locale)}`);
  if (celiRoom > 0) roomParts.push(`${t("celiLabel")} ${formatMoney(celiRoom, locale)}`);
  if (crcdRoom > 0) roomParts.push(`CRCD ${formatMoney(crcdRoom, locale)}`);
  // CELI maxed note when CELI has activity but no room left
  const celiMaxed = celiRoom === 0 && currentRow.celiDepositCents > 0;

  function handleSave() {
    const dollars = goalInput || "0";
    const formData = new FormData();
    formData.set("year", String(currentRow.year));
    formData.set("goalDollars", dollars);
    startTransition(async () => {
      const result = await saveSavingsGoalAction({}, formData);
      if (result.success && result.rows) {
        onUpdate(result.rows);
        setEditing(false);
      }
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
      {/* Left: savings-goal card */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("saved", { year: currentRow.year })}
            </p>
            <p className="mt-1.5 text-4xl font-extrabold leading-none tracking-tight tabular-nums">
              {formatMoney(totalCents, locale)}
            </p>
            {goalCents > 0 && (
              <p className="mt-1.5 text-sm text-muted-foreground tabular-nums">
                {t("ofGoalPct", {
                  goal: formatMoney(goalCents, locale),
                  pct: pctLabel,
                })}
              </p>
            )}
          </div>

          {editing ? (
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">$</span>
              <Input
                type="number"
                min="0"
                step="100"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                className="h-8 w-32"
                placeholder="30000"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") setEditing(false);
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleSave}
                disabled={isPending}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setEditing(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
              {t("editGoal")}
            </Button>
          )}
        </div>

        {goalCents > 0 ? (
          <Progress
            value={pct}
            className={`mt-4 h-3 ${goalMet ? "[&>[data-slot=progress-indicator]]:bg-gain" : ""}`}
          />
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">{t("setGoalPrompt")}</p>
        )}

        {/* Mini stat tiles */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tiles.map((tile) => (
            <div key={tile.label} className="rounded-lg bg-muted/60 px-3 py-2 text-center">
              <div className="flex items-center justify-center gap-1.5">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: tile.color }}
                />
                <span className="text-[11px] text-muted-foreground">{tile.label}</span>
              </div>
              <p className="mt-1 text-sm font-bold tabular-nums">
                {formatMoney(tile.cents, locale)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Right: registered room still open */}
      <div className="flex flex-col justify-center rounded-xl border border-primary/25 bg-primary/[0.05] p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          {t("roomStillOpen")}
        </p>
        <p className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums text-primary">
          {formatMoney(roomOpen, locale)}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {roomParts.length > 0 ? (
            <>
              {roomParts.join(" + ")} {t("roomBeforeYearEnd", { year: currentRow.year })}.
              {celiMaxed && <> {t("celiMaxedNote")}</>}
            </>
          ) : (
            t("allRoomUsed")
          )}
        </p>
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-primary/15 pt-3">
          <span className="text-[11px] leading-tight text-muted-foreground">
            {t("updatesAutomatically")}
          </span>
          <span className="whitespace-nowrap text-xs font-semibold text-primary">
            {t("adjustLimits")} →
          </span>
        </div>
      </div>
    </div>
  );
}
