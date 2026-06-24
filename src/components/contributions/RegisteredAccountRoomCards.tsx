"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money/format";
import type { ContributionYearRow } from "@/lib/contributions/compute";
import { saveCrcdLimitAction } from "@/lib/actions/contributions";
import { saveCrcdHoldingAction } from "@/lib/actions/crcd-holdings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ReerLimitDialog } from "./ReerLimitDialog";
import { Check, X, Plus } from "lucide-react";

interface RegisteredAccountRoomCardsProps {
  currentRow: ContributionYearRow;
  locale: string;
  onUpdate: (rows: ContributionYearRow[]) => void;
  hasCrcdHoldings?: boolean;
}

const COLOR = {
  reer: "var(--chart-1)",
  celi: "var(--chart-2)",
  crcd: "var(--chart-5)",
  nonreg: "var(--chart-4)",
  gain: "var(--gain)",
} as const;

type Tag = "open" | "maxed" | "noCap";

export function RegisteredAccountRoomCards({
  currentRow,
  locale,
  onUpdate,
  hasCrcdHoldings,
}: RegisteredAccountRoomCardsProps) {
  const t = useTranslations("contributions");
  const [reerDialogOpen, setReerDialogOpen] = useState(false);

  const reerRoom = Math.max(0, currentRow.reerCumulativeRoomCents);
  const celiRoom = Math.max(0, currentRow.celiCumulativeRoomCents);
  const nonRegTotal =
    currentRow.margeDepositCents + currentRow.cashDepositCents + currentRow.otherDepositCents;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* REER */}
        {currentRow.reerLimitCents > 0 ? (
          <RoomCard
            label={t("reerLabel")}
            color={COLOR.reer}
            depositedCents={currentRow.reerDepositCents}
            limitCents={currentRow.reerLimitCents}
            remainCents={reerRoom}
            remainLabel={t("roomLeft")}
            tag={reerRoom <= 0 ? "maxed" : "open"}
            footLabel={t("cumulativeRoom")}
            footValue={formatMoney(reerRoom, locale)}
            cta={t("editLimit")}
            onEdit={() => setReerDialogOpen(true)}
            locale={locale}
          />
        ) : (
          <PromptCard
            label={t("reerLabel")}
            prompt={t("setReerLimitPrompt")}
            cta={t("editLimit")}
            onEdit={() => setReerDialogOpen(true)}
          />
        )}

        {/* CELI */}
        <RoomCard
          label={t("celiLabel")}
          color={COLOR.celi}
          depositedCents={currentRow.celiDepositCents}
          limitCents={currentRow.celiLimitCents}
          remainCents={celiRoom}
          remainLabel={t("roomLeft")}
          tag={celiRoom <= 0 ? "maxed" : "open"}
          footLabel={t("cumulativeRoom")}
          footValue={formatMoney(celiRoom, locale)}
          locale={locale}
        />

        {/* CRCD */}
        <CrcdCard
          currentRow={currentRow}
          locale={locale}
          onUpdate={onUpdate}
          hasCrcdHoldings={hasCrcdHoldings}
        />

        {/* Non-registered */}
        <RoomCard
          label={t("nonRegLabel")}
          color={COLOR.nonreg}
          depositedCents={nonRegTotal}
          limitCents={0}
          remainCents={nonRegTotal}
          remainLabel={t("thisYear")}
          tag="noCap"
          footLabel={t("noLimit")}
          footValue=""
          locale={locale}
        />
      </div>

      <ReerLimitDialog
        open={reerDialogOpen}
        onOpenChange={setReerDialogOpen}
        row={currentRow}
        onUpdate={onUpdate}
      />
    </>
  );
}

/** Conic-gradient ring showing % used, with the % label centered. */
function Ring({
  pct,
  color,
  label,
}: {
  pct: number;
  color: string;
  label: string;
}) {
  return (
    <div className="relative h-[72px] w-[72px] shrink-0">
      <div
        className="h-full w-full rounded-full"
        style={{ background: `conic-gradient(${color} ${pct}%, var(--muted) 0)` }}
      />
      <div className="absolute inset-[9px] flex items-center justify-center rounded-full bg-card">
        <span className="text-sm font-bold tabular-nums">{label}</span>
      </div>
    </div>
  );
}

function StatusBadge({ tag, color }: { tag: Tag; color: string }) {
  const t = useTranslations("contributions");
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{ background: `color-mix(in oklch, ${color} 16%, transparent)`, color }}
    >
      {t(tag)}
    </span>
  );
}

function RoomCard({
  label,
  color,
  depositedCents,
  limitCents,
  remainCents,
  remainLabel,
  tag,
  footLabel,
  footValue,
  cta,
  onEdit,
  locale,
}: {
  label: string;
  color: string;
  depositedCents: number;
  limitCents: number;
  remainCents: number;
  remainLabel: string;
  tag: Tag;
  footLabel: string;
  footValue: string;
  cta?: string;
  onEdit?: () => void;
  locale: string;
}) {
  const t = useTranslations("contributions");
  const maxed = tag === "maxed";
  const ringColor = maxed ? COLOR.gain : color;
  const pct =
    tag === "noCap"
      ? 100
      : limitCents > 0
        ? Math.min(Math.round((depositedCents / limitCents) * 100), 100)
        : 0;
  const pctLabel = tag === "noCap" ? "—" : `${pct}%`;

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{label}</p>
        <StatusBadge tag={tag} color={tag === "noCap" ? color : ringColor} />
      </div>

      <div className="mt-3.5 flex items-center gap-3.5">
        <Ring pct={pct} color={ringColor} label={pctLabel} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-muted-foreground">{remainLabel}</p>
          <p className="mt-0.5 text-lg font-extrabold tabular-nums">
            {formatMoney(remainCents, locale)}
          </p>
          {limitCents > 0 && (
            <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
              {t("depositedOfLimit", {
                deposited: formatMoney(depositedCents, locale),
                limit: formatMoney(limitCents, locale),
              })}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3.5 flex items-center justify-between border-t pt-3">
        <span className="text-[11px] text-muted-foreground">
          {footLabel}
          {footValue && (
            <span className="ml-1 font-mono font-semibold text-foreground">{footValue}</span>
          )}
        </span>
        {cta && onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="text-xs font-semibold text-primary hover:underline"
          >
            {cta}
          </button>
        )}
      </div>
    </div>
  );
}

function PromptCard({
  label,
  prompt,
  cta,
  onEdit,
}: {
  label: string;
  prompt: string;
  cta: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex flex-col rounded-xl border bg-card p-5 shadow-sm">
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-3 flex-1 text-sm text-muted-foreground">{prompt}</p>
      <button
        type="button"
        onClick={onEdit}
        className="mt-3 self-start text-xs font-semibold text-primary hover:underline"
      >
        {cta}
      </button>
    </div>
  );
}

function CrcdCard({
  currentRow,
  locale,
  onUpdate,
  hasCrcdHoldings,
}: {
  currentRow: ContributionYearRow;
  locale: string;
  onUpdate: (rows: ContributionYearRow[]) => void;
  hasCrcdHoldings?: boolean;
}) {
  const t = useTranslations("contributions");
  const th = useTranslations("holdings");
  const tc = useTranslations("common");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [addTrancheOpen, setAddTrancheOpen] = useState(false);
  const [limitInput, setLimitInput] = useState(
    currentRow.crcdLimitCents > 0 ? (currentRow.crcdLimitCents / 100).toString() : "",
  );
  const [isPending, startTransition] = useTransition();
  const [isTrancheSubmitting, startTrancheTransition] = useTransition();

  const crcdRoom = Math.max(0, currentRow.crcdRemainingCents);
  const inactive = currentRow.crcdLimitCents === 0 && currentRow.crcdDepositCents === 0;
  const pct =
    currentRow.crcdLimitCents > 0
      ? Math.min(Math.round((currentRow.crcdDepositCents / currentRow.crcdLimitCents) * 100), 100)
      : 0;
  const maxed = currentRow.crcdLimitCents > 0 && crcdRoom <= 0;
  const ringColor = maxed ? COLOR.gain : COLOR.crcd;

  function handleSave() {
    const formData = new FormData();
    formData.set("year", currentRow.year.toString());
    formData.set("limitDollars", limitInput || "0");
    startTransition(async () => {
      const result = await saveCrcdLimitAction({}, formData);
      if (result.success && result.rows) {
        onUpdate(result.rows);
        setEditing(false);
      }
    });
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">CRCD</p>
        {!editing && !inactive && (
          <StatusBadge tag={maxed ? "maxed" : "open"} color={ringColor} />
        )}
      </div>

      {editing ? (
        <div className="mt-3 flex items-center gap-1">
          <span className="text-xs text-muted-foreground">{t("annual")} $</span>
          <Input
            type="number"
            min="0"
            step="100"
            value={limitInput}
            onChange={(e) => setLimitInput(e.target.value)}
            className="h-7 w-24 text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setEditing(false);
            }}
          />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSave} disabled={isPending}>
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : inactive ? (
        <>
          <p className="mt-3 text-sm text-muted-foreground">{t("setCrcdLimitPrompt")}</p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-3 text-xs font-semibold text-primary hover:underline"
          >
            {t("editLimit")}
          </button>
        </>
      ) : (
        <>
          <div className="mt-3.5 flex items-center gap-3.5">
            <Ring pct={pct} color={ringColor} label={`${pct}%`} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-muted-foreground">{t("annualRoomLeft")}</p>
              <p className="mt-0.5 text-lg font-extrabold tabular-nums">
                {formatMoney(crcdRoom, locale)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                {t("depositedOfLimit", {
                  deposited: formatMoney(currentRow.crcdDepositCents, locale),
                  limit: formatMoney(currentRow.crcdLimitCents, locale),
                })}
              </p>
            </div>
          </div>

          <div className="mt-3.5 flex items-center justify-between border-t pt-3">
            <span className="text-[11px] text-muted-foreground">
              {t("lifetime")}
              <span className="ml-1 font-mono font-semibold text-foreground">
                {formatMoney(currentRow.crcdCumulativeInvestedCents, locale)}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              {t("editLimit")}
            </button>
          </div>

          {/* First-tranche entry point */}
          {!hasCrcdHoldings && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={() => setAddTrancheOpen(true)}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t("crcdAddFirstTranche")}
            </Button>
          )}
        </>
      )}

      {/* Add first tranche dialog */}
      <Dialog open={addTrancheOpen} onOpenChange={setAddTrancheOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("crcdAddFirstTranche")}</DialogTitle>
            <DialogDescription>
              Capital régional et coopératif Desjardins
            </DialogDescription>
          </DialogHeader>
          <form
            action={(formData: FormData) => {
              startTrancheTransition(async () => {
                const result = await saveCrcdHoldingAction({}, formData);
                if (result.success) {
                  toast.success(th("crcdTrancheAdded"));
                  setAddTrancheOpen(false);
                  router.refresh();
                } else if (result.error) {
                  toast.error(result.error);
                }
              });
            }}
            className="space-y-3"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">{th("crcdPurchaseYear")}</Label>
                <Input
                  type="number"
                  name="purchaseYear"
                  min="2001"
                  max={new Date().getFullYear()}
                  defaultValue={new Date().getFullYear()}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{th("crcdShares")}</Label>
                <Input type="number" name="quantity" step="any" min="0" required />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{th("crcdBuyPrice")}</Label>
                <Input type="number" name="priceDollars" step="0.01" min="0" required />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{th("crcdRedeemableFrom")}</Label>
                <Input
                  type="date"
                  name="redemptionDate"
                  defaultValue={`${new Date().getFullYear() + 7}-03-01`}
                  required
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="submit" size="sm" disabled={isTrancheSubmitting}>
                {isTrancheSubmitting ? tc("loading") : th("crcdAddTranche")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddTrancheOpen(false)}
              >
                {tc("cancel")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
