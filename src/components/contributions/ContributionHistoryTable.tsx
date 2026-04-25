"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/money/format";
import type { ContributionYearRow } from "@/lib/contributions/compute";
import {
  saveReerLimitAction,
  saveCrcdLimitAction,
  saveSavingsGoalAction,
} from "@/lib/actions/contributions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X } from "lucide-react";

interface ContributionHistoryTableProps {
  rows: ContributionYearRow[];
  locale: string;
  onUpdate: (rows: ContributionYearRow[]) => void;
}

type EditField = "reerLimit" | "crcdLimit" | "goal";

/** Tinted background for alternating column groups */
const TINT = "bg-accent/40";

export function ContributionHistoryTable({
  rows,
  locale,
  onUpdate,
}: ContributionHistoryTableProps) {
  const t = useTranslations("contributions");
  const [editingCell, setEditingCell] = useState<{ year: number; field: EditField } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isPending, startTransition] = useTransition();

  // Show most recent first
  const displayRows = [...rows].reverse();

  function startEdit(year: number, field: EditField, currentCents: number) {
    setEditingCell({ year, field });
    setEditValue(currentCents > 0 ? (currentCents / 100).toString() : "");
  }

  function cancelEdit() {
    setEditingCell(null);
    setEditValue("");
  }

  function saveEdit() {
    if (!editingCell) return;
    const { year, field } = editingCell;
    const formData = new FormData();
    formData.set("year", year.toString());

    let action: typeof saveReerLimitAction;
    if (field === "reerLimit") {
      formData.set("limitDollars", editValue || "0");
      action = saveReerLimitAction;
    } else if (field === "crcdLimit") {
      formData.set("limitDollars", editValue || "0");
      action = saveCrcdLimitAction;
    } else {
      formData.set("goalDollars", editValue || "0");
      action = saveSavingsGoalAction;
    }

    startTransition(async () => {
      const result = await action({}, formData);
      if (result.success && result.rows) {
        onUpdate(result.rows);
      }
      cancelEdit();
    });
  }

  function renderEditableCell(
    year: number,
    field: EditField,
    valueCents: number,
    placeholder?: string,
  ) {
    const isEditing = editingCell?.year === year && editingCell.field === field;

    if (isEditing) {
      return (
        <div className="flex items-center justify-end gap-0.5">
          <Input
            type="number"
            min="0"
            step="100"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="h-6 w-20 text-right text-xs"
            placeholder={placeholder}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit();
              if (e.key === "Escape") cancelEdit();
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={saveEdit}
            disabled={isPending}
          >
            <Check className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={cancelEdit}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      );
    }

    return (
      <button
        className="group inline-flex items-center gap-1 text-right hover:text-primary"
        onClick={() => startEdit(year, field, valueCents)}
      >
        <span>{valueCents > 0 ? formatMoney(valueCents, locale) : "—"}</span>
        <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50" />
      </button>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <p className="mb-4 text-sm font-medium">{t("contributionHistory")}</p>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {/* Group header row */}
            <TableRow className="border-b-0">
              {/* Year + Age spacers */}
              <TableHead className="sticky left-0 z-10 bg-card" rowSpan={2}>{t("year")}</TableHead>
              <TableHead className="text-right" rowSpan={2}>{t("age")}</TableHead>
              {/* RRSP group */}
              <TableHead colSpan={3} className={`text-center border-b font-semibold ${TINT}`}>
                {t("reerLabel")}
              </TableHead>
              {/* TFSA group */}
              <TableHead colSpan={3} className="text-center border-b font-semibold">
                {t("celiLabel")}
              </TableHead>
              {/* CRCD group */}
              <TableHead colSpan={2} className={`text-center border-b font-semibold ${TINT}`}>
                {t("crcdLabel")}
              </TableHead>
              {/* Non-reg */}
              <TableHead className="text-center border-b font-semibold">
                {t("nonRegLabel")}
              </TableHead>
              {/* Total */}
              <TableHead className={`text-right font-semibold ${TINT}`} rowSpan={2}>
                {t("totalInvested")}
              </TableHead>
              {/* Goal + % */}
              <TableHead className="text-right" rowSpan={2}>{t("goal")}</TableHead>
              <TableHead className="text-right" rowSpan={2}>{t("goalPct")}</TableHead>
            </TableRow>
            {/* Sub-header row */}
            <TableRow>
              {/* RRSP sub-headers */}
              <TableHead className={`text-center text-xs ${TINT}`}>{t("reerLimit")}</TableHead>
              <TableHead className={`text-center text-xs ${TINT}`}>{t("reerDeposited")}</TableHead>
              <TableHead className={`text-center text-xs ${TINT}`}>{t("reerRoom")}</TableHead>
              {/* TFSA sub-headers */}
              <TableHead className="text-center text-xs">{t("celiLimit")}</TableHead>
              <TableHead className="text-center text-xs">{t("celiDeposited")}</TableHead>
              <TableHead className="text-center text-xs">{t("celiRoom")}</TableHead>
              {/* CRCD sub-headers */}
              <TableHead className={`text-center text-xs ${TINT}`}>{t("crcdLimit")}</TableHead>
              <TableHead className={`text-center text-xs ${TINT}`}>{t("crcdDeposited")}</TableHead>
              {/* Non-reg sub-header */}
              <TableHead className="text-center text-xs">{t("nonRegDeposited")}</TableHead>
              {/* Total, Goal, % already have rowSpan=2 above */}
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.map((row) => {
              const nonRegTotal = row.margeDepositCents + row.cashDepositCents + row.otherDepositCents;
              const goalPct =
                row.savingsGoalCents > 0
                  ? ((row.totalDepositCents / row.savingsGoalCents) * 100).toFixed(0)
                  : null;
              const goalMet =
                row.savingsGoalCents > 0 &&
                row.totalDepositCents >= row.savingsGoalCents;

              return (
                <TableRow key={row.year}>
                  <TableCell className="sticky left-0 z-10 bg-card font-medium">
                    {row.year}
                  </TableCell>
                  <TableCell className="text-right">{row.age}</TableCell>
                  {/* RRSP */}
                  <TableCell className={`text-right ${TINT}`}>
                    {renderEditableCell(row.year, "reerLimit", row.reerLimitCents)}
                  </TableCell>
                  <TableCell className={`text-right ${TINT}`}>
                    {formatMoney(row.reerDepositCents, locale)}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${TINT}`}>
                    {formatMoney(row.reerCumulativeRoomCents, locale)}
                  </TableCell>
                  {/* TFSA */}
                  <TableCell className="text-right">
                    {formatMoney(row.celiLimitCents, locale)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span>{formatMoney(row.celiDepositCents, locale)}</span>
                    {row.celiWithdrawalCents > 0 && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        (−{formatMoney(row.celiWithdrawalCents, locale)})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMoney(row.celiCumulativeRoomCents, locale)}
                  </TableCell>
                  {/* CRCD */}
                  <TableCell className={`text-right ${TINT}`}>
                    {renderEditableCell(row.year, "crcdLimit", row.crcdLimitCents)}
                  </TableCell>
                  <TableCell className={`text-right ${TINT}`}>
                    {formatMoney(row.crcdDepositCents, locale)}
                  </TableCell>
                  {/* Non-registered */}
                  <TableCell className="text-right">
                    {formatMoney(nonRegTotal, locale)}
                  </TableCell>
                  {/* Total */}
                  <TableCell className={`text-right font-semibold ${TINT}`}>
                    {formatMoney(row.totalDepositCents, locale)}
                  </TableCell>
                  {/* Goal */}
                  <TableCell className="text-right">
                    {renderEditableCell(row.year, "goal", row.savingsGoalCents)}
                  </TableCell>
                  {/* Goal % */}
                  <TableCell className="text-right">
                    {goalPct !== null ? (
                      <span className={`font-medium ${goalMet ? "text-gain" : "text-loss"}`}>
                        {goalPct}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
