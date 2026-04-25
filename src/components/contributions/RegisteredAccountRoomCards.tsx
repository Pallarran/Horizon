"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money/format";
import type { ContributionYearRow } from "@/lib/contributions/compute";
import { saveCrcdLimitAction } from "@/lib/actions/contributions";
import { saveCrcdHoldingAction } from "@/lib/actions/crcd-holdings";
import { Progress } from "@/components/ui/progress";
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
import { Pencil, Check, X, Plus } from "lucide-react";

interface RegisteredAccountRoomCardsProps {
  currentRow: ContributionYearRow;
  locale: string;
  onUpdate: (rows: ContributionYearRow[]) => void;
  hasCrcdHoldings?: boolean;
}

export function RegisteredAccountRoomCards({
  currentRow,
  locale,
  onUpdate,
  hasCrcdHoldings,
}: RegisteredAccountRoomCardsProps) {
  const t = useTranslations("contributions");
  const [reerDialogOpen, setReerDialogOpen] = useState(false);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* REER Card */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{t("reerLabel")}</p>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setReerDialogOpen(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="mt-3 space-y-2">
            {currentRow.reerLimitCents > 0 ? (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("limit")}</span>
                  <span>{formatMoney(currentRow.reerLimitCents, locale)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("deposited")}</span>
                  <span>{formatMoney(currentRow.reerDepositCents, locale)}</span>
                </div>
                <RoomProgress
                  depositedCents={currentRow.reerDepositCents}
                  limitCents={currentRow.reerLimitCents}
                />
                <div className="flex justify-between text-sm border-t pt-2">
                  <span className="text-muted-foreground">{t("cumulativeRoom")}</span>
                  <span className="font-semibold">
                    {formatMoney(currentRow.reerCumulativeRoomCents, locale)}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("setReerLimitPrompt")}
              </p>
            )}
          </div>
        </div>

        {/* CELI Card */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-sm font-medium">{t("celiLabel")}</p>

          <div className="mt-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("limit")}</span>
              <span>{formatMoney(currentRow.celiLimitCents, locale)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("deposited")}</span>
              <span>{formatMoney(currentRow.celiDepositCents, locale)}</span>
            </div>
            <RoomProgress
              depositedCents={currentRow.celiDepositCents}
              limitCents={currentRow.celiLimitCents}
            />
            <div className="flex justify-between text-sm border-t pt-2">
              <span className="text-muted-foreground">{t("cumulativeRoom")}</span>
              <span className="font-semibold">
                {formatMoney(currentRow.celiCumulativeRoomCents, locale)}
              </span>
            </div>
          </div>
        </div>

        {/* CRCD Card — always visible */}
        <CrcdCard
          currentRow={currentRow}
          locale={locale}
          onUpdate={onUpdate}
          hasCrcdHoldings={hasCrcdHoldings}
        />

        {/* Non-Registered Card */}
        <NonRegisteredCard currentRow={currentRow} locale={locale} />
      </div>

      <ReerLimitDialog
        open={reerDialogOpen}
        onOpenChange={setReerDialogOpen}
        row={currentRow}
        locale={locale}
        onUpdate={onUpdate}
      />
    </>
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
        <p className="text-sm font-medium">CRCD</p>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setEditing(!editing)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="mt-3 space-y-2">
        {editing ? (
          /* Inline edit form */
          <div className="flex items-center gap-1">
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
        ) : currentRow.crcdLimitCents === 0 && currentRow.crcdDepositCents === 0 ? (
          /* No CRCD activity — show prompt */
          <p className="text-sm text-muted-foreground">
            {t("setCrcdLimitPrompt")}
          </p>
        ) : (
          /* Active CRCD — show progress */
          <>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("annual")}</span>
              <span>
                {formatMoney(currentRow.crcdDepositCents, locale)} /{" "}
                {formatMoney(currentRow.crcdLimitCents, locale)}
              </span>
            </div>
            <RoomProgress
              depositedCents={currentRow.crcdDepositCents}
              limitCents={currentRow.crcdLimitCents}
            />

            {/* Lifetime */}
            <div className="flex justify-between text-sm border-t pt-2">
              <span className="text-muted-foreground">{t("lifetime")}</span>
              <span>
                {formatMoney(currentRow.crcdCumulativeInvestedCents, locale)} /{" "}
                {formatMoney(currentRow.crcdLifetimeLimitCents, locale)}
              </span>
            </div>
            <LifetimeProgress
              investedCents={currentRow.crcdCumulativeInvestedCents}
              limitCents={currentRow.crcdLifetimeLimitCents}
            />

            {/* Tax credit */}
            {currentRow.crcdTaxCreditCents > 0 && (
              <div className="flex justify-between text-sm border-t pt-2">
                <span className="text-muted-foreground">{t("taxCredit")}</span>
                <span className="font-semibold text-gain">
                  {formatMoney(currentRow.crcdTaxCreditCents, locale)}
                </span>
              </div>
            )}

            {/* First-tranche entry point */}
            {!hasCrcdHoldings && (
              <div className="border-t pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setAddTrancheOpen(true)}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {t("crcdAddFirstTranche")}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

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

function RoomProgress({
  depositedCents,
  limitCents,
}: {
  depositedCents: number;
  limitCents: number;
}) {
  const pct = limitCents > 0 ? Math.min(Math.round((depositedCents / limitCents) * 100), 100) : 0;
  const full = depositedCents >= limitCents && limitCents > 0;

  return (
    <div className="flex items-center gap-2">
      <Progress
        value={pct}
        className={`h-2 flex-1 ${full ? "[&>[data-slot=progress-indicator]]:bg-gain" : ""}`}
      />
      <span className={`text-xs font-medium ${full ? "text-gain" : "text-muted-foreground"}`}>
        {pct}%
      </span>
    </div>
  );
}

function LifetimeProgress({
  investedCents,
  limitCents,
}: {
  investedCents: number;
  limitCents: number;
}) {
  const pct = limitCents > 0 ? Math.min(Math.round((investedCents / limitCents) * 100), 100) : 0;

  return (
    <div className="flex items-center gap-2">
      <Progress value={pct} className="h-2 flex-1" />
      <span className="text-xs font-medium text-muted-foreground">{pct}%</span>
    </div>
  );
}

function NonRegisteredCard({
  currentRow,
  locale,
}: {
  currentRow: ContributionYearRow;
  locale: string;
}) {
  const t = useTranslations("contributions");
  const total = currentRow.margeDepositCents + currentRow.cashDepositCents + currentRow.otherDepositCents;

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <p className="text-sm font-medium">{t("nonRegLabel")}</p>

      <div className="mt-3 space-y-2">
        {currentRow.margeDepositCents > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("marginLabel")}</span>
            <span>{formatMoney(currentRow.margeDepositCents, locale)}</span>
          </div>
        )}
        {currentRow.cashDepositCents > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("cash")}</span>
            <span>{formatMoney(currentRow.cashDepositCents, locale)}</span>
          </div>
        )}
        {currentRow.otherDepositCents > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("other")}</span>
            <span>{formatMoney(currentRow.otherDepositCents, locale)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm border-t pt-2">
          <span className="text-muted-foreground">{t("totalNonReg")}</span>
          <span className="font-semibold">{formatMoney(total, locale)}</span>
        </div>
      </div>
    </div>
  );
}
