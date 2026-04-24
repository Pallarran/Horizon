"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/money/format";
import { saveSavingsGoalAction } from "@/lib/actions/contributions";
import type { ContributionYearRow } from "@/lib/contributions/compute";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X } from "lucide-react";

interface SavingsGoalHeroProps {
  currentRow: ContributionYearRow;
  locale: string;
  onUpdate: (rows: ContributionYearRow[]) => void;
}

export function SavingsGoalHero({ currentRow, locale, onUpdate }: SavingsGoalHeroProps) {
  const t = useTranslations("contributions");
  const [editing, setEditing] = useState(false);
  const [goalInput, setGoalInput] = useState(
    currentRow.savingsGoalCents > 0 ? (currentRow.savingsGoalCents / 100).toString() : "",
  );
  const [isPending, startTransition] = useTransition();

  const goalCents = currentRow.savingsGoalCents;
  const totalCents = currentRow.totalDepositCents;
  const pct = goalCents > 0 ? Math.min((totalCents / goalCents) * 100, 100) : 0;
  const pctDisplay = goalCents > 0 ? ((totalCents / goalCents) * 100).toFixed(1) : "0";
  const goalMet = goalCents > 0 && totalCents >= goalCents;

  // Breakdown by account type
  const breakdown = [
    { label: t("reerLabel"), cents: currentRow.reerDepositCents, color: "bg-[var(--chart-1)]" },
    { label: t("celiLabel"), cents: currentRow.celiDepositCents, color: "bg-[var(--chart-2)]" },
    { label: "CRCD", cents: currentRow.crcdDepositCents, color: "bg-[var(--chart-5)]" },
    { label: t("marge"), cents: currentRow.margeDepositCents, color: "bg-[var(--chart-3)]" },
    { label: t("cash"), cents: currentRow.cashDepositCents, color: "bg-[var(--chart-4)]" },
    { label: t("other"), cents: currentRow.otherDepositCents, color: "bg-muted-foreground/50" },
  ].filter((b) => b.cents > 0);

  function handleSave() {
    const dollars = goalInput || "0";
    const formData = new FormData();
    formData.set("year", String(currentRow.year));
    formData.set("goalDollars", dollars);
    startTransition(async () => {
      try {
        const result = await saveSavingsGoalAction({}, formData);
        if (result.success && result.rows) {
          onUpdate(result.rows);
          setEditing(false);
        } else if (result.error) {
          console.error("Save goal failed:", result.error);
        }
      } catch (err) {
        console.error("Save goal exception:", err);
      }
    });
  }

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {t("savingsProgress", { year: currentRow.year })}
          </p>
          <p className="mt-1 text-3xl font-bold tracking-tight">
            {formatMoney(totalCents, locale)}
          </p>
        </div>

        <div className="flex items-center gap-2 text-right">
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
            <>
              <div>
                <p className="text-sm text-muted-foreground">{t("annualGoal")}</p>
                <p className="text-lg font-semibold">
                  {goalCents > 0 ? formatMoney(goalCents, locale) : "—"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {goalCents > 0 ? (
        <div className="mt-4">
          <Progress
            value={pct}
            className={`h-3 ${goalMet ? "[&>[data-slot=progress-indicator]]:bg-gain" : ""}`}
          />
          <p className="mt-1 text-right text-sm font-medium">
            <span className={goalMet ? "text-gain" : "text-muted-foreground"}>
              {pctDisplay}%
            </span>
          </p>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          {t("setGoalPrompt")}
        </p>
      )}

      {/* Account type breakdown */}
      {breakdown.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {breakdown.map((b) => (
            <Badge key={b.label} variant="outline" className="gap-1.5 font-normal">
              <span className={`inline-block h-2 w-2 rounded-full ${b.color}`} />
              {b.label} {formatMoney(b.cents, locale)}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
