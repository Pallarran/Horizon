"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Check, X, Plus, Trash2 } from "lucide-react";
import { formatMoney, formatPercent, formatNumber } from "@/lib/money/format";
import type { SerializedPosition } from "@/lib/positions/serialize";
import type { SecurityProfile } from "@/lib/positions/security-profile";
import type { SerializedCrcdHolding } from "@/lib/actions/crcd-holdings";
import {
  saveCrcdHoldingAction,
  deleteCrcdHoldingAction,
  updateCrcdPriceAction,
} from "@/lib/actions/crcd-holdings";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DetailRow, SectionHeading } from "@/components/detail-sheet/detail-helpers";
import {
  SecurityInfoSection,
  DividendSafetySection,
  KeyDatesSection,
  ValuationSection,
  FinancialHealthSection,
  AnalystViewSection,
  AboutSection,
} from "@/components/detail-sheet/profile-sections";

interface Props {
  position: SerializedPosition | null;
  profile?: SecurityProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: string;
  onAddTransaction?: (accountId: string, securityId: string, symbol: string, name: string) => void;
  watchedSecurityIds?: Set<string>;
  onToggleWatch?: (securityId: string, isWatched: boolean) => void;
  crcdHoldings?: SerializedCrcdHolding[];
}

export function PositionDetailSheet({
  position,
  profile,
  open,
  onOpenChange,
  locale,
  onAddTransaction,
  watchedSecurityIds,
  onToggleWatch,
  crcdHoldings,
}: Props) {
  const t = useTranslations("holdings");
  const tw = useTranslations("watchlist");
  const tc = useTranslations("common");

  if (!position) return null;
  const h = position;
  const p = profile;
  const isCrcd = h.assetClass === "CRCD_SHARE";

  // For non-CRCD positions, render the standard layout
  if (isCrcd) {
    return (
      <CrcdDetailSheet
        position={h}
        holdings={crcdHoldings ?? []}
        open={open}
        onOpenChange={onOpenChange}
        locale={locale}
      />
    );
  }

  const isWatched = watchedSecurityIds?.has(h.securityId) ?? false;

  const frequencyKey = h.dividendFrequency
    ? (`frequency${h.dividendFrequency.charAt(0).toUpperCase()}${h.dividendFrequency.slice(1)}` as Parameters<typeof t>[0])
    : null;

  const hasDividendIncome = h.annualDividendPerShareCents !== null || h.expectedIncomeCents !== null || h.totalDividendsReceivedCents > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-5xl">
        {/* Header — symbol/name left, market value right */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <DialogHeader className="flex-1 space-y-1">
            <DialogTitle className="text-lg">{h.symbol}</DialogTitle>
            <DialogDescription>
              {h.name} · {t("positionInAccount", { accountName: h.accountName })}
            </DialogDescription>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Badge variant="outline">{h.currency}</Badge>
              <Badge variant="outline">{h.exchange}</Badge>
              <Badge variant="secondary">
                {t(`accountType${h.accountType}` as Parameters<typeof t>[0])}
              </Badge>
              <Badge variant="secondary">
                {t(`assetClass${h.assetClass}` as Parameters<typeof t>[0])}
              </Badge>
              {h.isDividendKing && (
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                  {t("dividendKing")}
                </Badge>
              )}
              {h.isDividendAristocrat && !h.isDividendKing && (
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                  {t("dividendAristocrat")}
                </Badge>
              )}
            </div>
          </DialogHeader>

          <div className="text-left sm:text-right sm:shrink-0 sm:pt-6">
            <p className="text-2xl font-bold tabular-nums">
              {h.marketValueCents !== null
                ? formatMoney(h.marketValueCents, locale)
                : formatMoney(h.totalCostCents, locale)}
            </p>
            {h.dayChangeCents !== null && h.dayChangePercent !== null && (
              <p
                className={`text-sm tabular-nums ${
                  h.dayChangeCents >= 0 ? "text-gain" : "text-loss"
                }`}
              >
                {h.dayChangeCents >= 0 ? "+" : ""}
                {formatMoney(h.dayChangeCents, locale)}{" "}
                ({h.dayChangePercent >= 0 ? "+" : ""}
                {formatPercent(h.dayChangePercent, locale)}) {t("today")}
              </p>
            )}
          </div>
        </div>

        <Separator />

        {/* Three-column body */}
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* ── Column 1: Your Position ── */}
          <div className="flex flex-col gap-4">
            <div>
              <SectionHeading>{t("costBasis")}</SectionHeading>
              <DetailRow
                label={t("quantity")}
                value={formatNumber(h.quantity, locale, 0)}
              />
              <DetailRow
                label={t("avgCost")}
                value={formatMoney(h.avgCostCents, locale)}
              />
              <DetailRow
                label={t("totalCost")}
                value={formatMoney(h.totalCostCents, locale)}
              />
              <DetailRow
                label={t("currentPrice")}
                value={
                  h.currentPriceCents !== null
                    ? formatMoney(h.currentPriceCents, locale)
                    : "—"
                }
              />
              {h.unrealizedGainCents !== null && (
                <DetailRow
                  label={t("unrealizedGain")}
                  value={`${h.unrealizedGainCents >= 0 ? "+" : ""}${formatMoney(h.unrealizedGainCents, locale)}`}
                  sub={
                    h.unrealizedGainPercent !== null
                      ? `${h.unrealizedGainPercent >= 0 ? "+" : ""}${formatPercent(h.unrealizedGainPercent, locale)}`
                      : undefined
                  }
                  color={h.unrealizedGainCents >= 0 ? "gain" : "loss"}
                />
              )}
            </div>

            <SecurityInfoSection
              sector={h.sector}
              industry={h.industry}
              locale={locale}
            />
          </div>

          {/* ── Column 2: Dividends ── */}
          <div className="flex flex-col gap-4">
            {hasDividendIncome && (
              <div>
                <SectionHeading>{t("dividendIncome")}</SectionHeading>
                {h.annualDividendPerShareCents !== null && (
                  <DetailRow
                    label={t("annualDividendPerShare")}
                    value={formatMoney(h.annualDividendPerShareCents, locale)}
                  />
                )}
                {h.expectedIncomeCents !== null && (
                  <DetailRow
                    label={t("expectedIncome")}
                    value={formatMoney(h.expectedIncomeCents, locale)}
                  />
                )}
                {h.totalDividendsReceivedCents > 0 && (
                  <DetailRow
                    label={t("totalDividendsReceived")}
                    value={formatMoney(h.totalDividendsReceivedCents, locale)}
                  />
                )}
                {h.yieldPercent !== null && (
                  <DetailRow
                    label={t("yield")}
                    value={formatPercent(h.yieldPercent, locale)}
                  />
                )}
                {h.yieldOnCostPercent !== null && (
                  <DetailRow
                    label={t("yieldOnCost")}
                    value={formatPercent(h.yieldOnCostPercent, locale)}
                  />
                )}
                {frequencyKey && (
                  <DetailRow
                    label={t("dividendFrequency")}
                    value={t(frequencyKey)}
                  />
                )}
                {h.dividendGrowthYears != null && h.dividendGrowthYears > 0 && (
                  <DetailRow
                    label={t("divGrowthYears", { count: h.dividendGrowthYears })}
                    value=""
                  />
                )}
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {h.isPaysMonthly && (
                    <Badge variant="outline" className="text-[10px]">
                      {t("monthlyPayer")}
                    </Badge>
                  )}
                  {h.isDividendAristocrat && (
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-[10px]">
                      {t("dividendAristocrat")}
                    </Badge>
                  )}
                  {h.isDividendKing && (
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-[10px]">
                      {t("dividendKing")}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {p && (
              <DividendSafetySection
                profile={p}
                locale={locale}
                showSeparator={hasDividendIncome}
              />
            )}
            {p && (
              <KeyDatesSection
                profile={p}
                locale={locale}
              />
            )}
          </div>

          {/* ── Column 3: Market Analysis ── */}
          <div className="flex flex-col gap-4">
            {p && (
              <ValuationSection
                profile={p}
                locale={locale}
                currentPriceCents={h.currentPriceCents}
              />
            )}
            {p && (
              <FinancialHealthSection profile={p} locale={locale} />
            )}
            {p && (
              <AnalystViewSection profile={p} locale={locale} />
            )}
          </div>
        </div>

        {/* About (full width) */}
        {p && <AboutSection profile={p} locale={locale} />}

        {/* Actions */}
        <DialogFooter className="flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <Button variant="outline" className="w-full sm:w-auto" asChild>
            <Link
              href={`/${locale}/transactions?security=${encodeURIComponent(h.symbol)}`}
            >
              {t("viewTransactions")}
            </Link>
          </Button>
          {onAddTransaction && (
            <Button
              className="w-full sm:w-auto"
              onClick={() => {
                onAddTransaction(h.accountId, h.securityId, h.symbol, h.name);
                onOpenChange(false);
              }}
            >
              {t("addTransaction")}
            </Button>
          )}
          {onToggleWatch && (
            <Button
              variant={isWatched ? "secondary" : "outline"}
              className="w-full sm:w-auto"
              onClick={() => onToggleWatch(h.securityId, isWatched)}
            >
              {isWatched ? tw("unwatch") : tw("watch")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  CRCD-specific detail sheet                                        */
/* ------------------------------------------------------------------ */

function CrcdDetailSheet({
  position,
  holdings,
  open,
  onOpenChange,
  locale,
}: {
  position: SerializedPosition;
  holdings: SerializedCrcdHolding[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: string;
}) {
  const t = useTranslations("holdings");
  const tc = useTranslations("common");
  const router = useRouter();
  const h = position;

  // Price editing
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState(
    h.currentPriceCents !== null ? (h.currentPriceCents / 100).toFixed(2) : "",
  );
  const [isPricePending, startPriceTransition] = useTransition();

  function handleSavePrice() {
    const dollars = parseFloat(priceInput);
    if (isNaN(dollars) || dollars <= 0) return;
    startPriceTransition(async () => {
      const result = await updateCrcdPriceAction(dollars);
      if (result.success) {
        setEditingPrice(false);
        toast.success(t("crcdPriceUpdated"));
        router.refresh();
      }
    });
  }

  // Tranche form
  const [showForm, setShowForm] = useState(false);
  const [editingTranche, setEditingTranche] = useState<SerializedCrcdHolding | null>(null);
  const [isFormPending, startFormTransition] = useTransition();

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<SerializedCrcdHolding | null>(null);
  const [isDeletePending, startDeleteTransition] = useTransition();

  function handleDelete(id: string) {
    startDeleteTransition(async () => {
      const result = await deleteCrcdHoldingAction(id);
      if (result.success) {
        toast.success(t("crcdTrancheDeleted"));
        setDeleteTarget(null);
        router.refresh();
      }
    });
  }

  function handleFormSubmit(formData: FormData) {
    startFormTransition(async () => {
      const result = await saveCrcdHoldingAction({}, formData);
      if (result.success) {
        toast.success(editingTranche ? t("crcdTrancheUpdated") : t("crcdTrancheAdded"));
        setShowForm(false);
        setEditingTranche(null);
        router.refresh();
      } else if (result.error) {
        toast.error(result.error);
      }
    });
  }

  function startEdit(tranche: SerializedCrcdHolding) {
    setEditingTranche(tranche);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingTranche(null);
  }

  const currentPrice = h.currentPriceCents !== null ? h.currentPriceCents / 100 : null;
  const today = new Date();

  // Compute totals
  const totalShares = holdings.reduce((s, t) => s + t.quantity, 0);
  const totalCost = holdings.reduce((s, t) => s + (t.quantity * t.averagePriceCents) / 100, 0);
  const totalMarketValue = currentPrice !== null ? totalShares * currentPrice : null;
  const totalGain = totalMarketValue !== null ? totalMarketValue - totalCost : null;
  const totalGainPercent = totalGain !== null && totalCost > 0 ? totalGain / totalCost : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <DialogHeader className="flex-1 space-y-1">
            <DialogTitle className="text-lg">CRCD</DialogTitle>
            <DialogDescription>
              Capital régional et coopératif Desjardins · {h.accountName}
            </DialogDescription>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Badge variant="outline">CAD</Badge>
              <Badge variant="secondary">
                {t(`accountType${h.accountType}` as Parameters<typeof t>[0])}
              </Badge>
            </div>
          </DialogHeader>

          <div className="text-left sm:text-right sm:shrink-0 sm:pt-6">
            <p className="text-2xl font-bold tabular-nums">
              {h.marketValueCents !== null
                ? formatMoney(h.marketValueCents, locale)
                : formatMoney(h.totalCostCents, locale)}
            </p>
            {h.unrealizedGainCents !== null && (
              <p className={`text-sm tabular-nums ${h.unrealizedGainCents >= 0 ? "text-gain" : "text-loss"}`}>
                {h.unrealizedGainCents >= 0 ? "+" : ""}
                {formatMoney(h.unrealizedGainCents, locale)}
                {h.unrealizedGainPercent !== null && (
                  <> ({h.unrealizedGainPercent >= 0 ? "+" : ""}{formatPercent(h.unrealizedGainPercent, locale)})</>
                )}
              </p>
            )}
          </div>
        </div>

        <Separator />

        {/* Current price with edit */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">{t("crcdCurrentPrice")}:</span>
          {editingPrice ? (
            <div className="flex items-center gap-1">
              <span className="text-sm">$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                className="h-7 w-24 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSavePrice();
                  if (e.key === "Escape") setEditingPrice(false);
                }}
              />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSavePrice} disabled={isPricePending}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingPrice(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditingPrice(true)}
              className="flex items-center gap-1.5 text-sm font-semibold hover:text-primary"
            >
              {currentPrice !== null ? `$${currentPrice.toFixed(2)}` : "—"}
              <Pencil className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Tranches table */}
        <div>
          <div className="flex items-center justify-between">
            <SectionHeading>{t("crcdTranches")}</SectionHeading>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setEditingTranche(null); setShowForm(true); }}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t("crcdAddTranche")}
            </Button>
          </div>

          {/* Add/Edit form */}
          {showForm && (
            <CrcdTrancheForm
              tranche={editingTranche}
              accountId={h.accountId}
              onSubmit={handleFormSubmit}
              onCancel={cancelForm}
              isPending={isFormPending}
              t={t}
              tc={tc}
            />
          )}

          {holdings.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("crcdNoTranches")}
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 pr-3">{t("crcdPurchaseYear")}</th>
                    <th className="pb-2 pr-3 text-right">{t("crcdShares")}</th>
                    <th className="pb-2 pr-3 text-right">{t("crcdBuyPrice")}</th>
                    <th className="pb-2 pr-3 text-right">{t("crcdTotalCost")}</th>
                    <th className="pb-2 pr-3">{t("crcdRedeemableFrom")}</th>
                    <th className="pb-2 pr-3 text-right">{t("crcdMarketValue")}</th>
                    <th className="pb-2 pr-3 text-right">{t("gain")}</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((tranche) => {
                    const cost = (tranche.quantity * tranche.averagePriceCents) / 100;
                    const mv = currentPrice !== null ? tranche.quantity * currentPrice : null;
                    const gain = mv !== null ? mv - cost : null;
                    const gainPct = gain !== null && cost > 0 ? gain / cost : null;
                    const redeemDate = new Date(tranche.redemptionEligibleDate);
                    const isRedeemable = redeemDate <= today;
                    const mustRedeem = tranche.purchaseYear >= 2025 &&
                      today > new Date(`${tranche.purchaseYear + 14}-03-01`);

                    return (
                      <tr key={tranche.id} className="border-b last:border-0">
                        <td className="py-2.5 pr-3 font-medium">{tranche.purchaseYear}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">
                          {formatNumber(tranche.quantity, locale, 4)}
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">
                          {formatMoney(tranche.averagePriceCents, locale)}
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">
                          {formatMoney(Math.round(cost * 100), locale)}
                        </td>
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="tabular-nums">{tranche.redemptionEligibleDate}</span>
                            {mustRedeem ? (
                              <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400 text-[10px]">
                                {t("crcdStatusMustRedeem")}
                              </Badge>
                            ) : isRedeemable ? (
                              <Badge variant="outline" className="border-green-500 text-green-600 dark:text-green-400 text-[10px]">
                                {t("crcdStatusRedeemable")}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">
                                {t("crcdStatusLocked")}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">
                          {mv !== null ? formatMoney(Math.round(mv * 100), locale) : "—"}
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">
                          {gain !== null ? (
                            <span className={gain >= 0 ? "text-gain" : "text-loss"}>
                              {gain >= 0 ? "+" : ""}{formatMoney(Math.round(gain * 100), locale)}
                              {gainPct !== null && (
                                <span className="ml-1 text-[11px]">
                                  ({gainPct >= 0 ? "+" : ""}{formatPercent(gainPct, locale)})
                                </span>
                              )}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => startEdit(tranche)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => setDeleteTarget(tranche)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Totals row */}
                  <tr className="border-t-2 font-semibold">
                    <td className="py-2.5 pr-3">{t("total")}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {formatNumber(totalShares, locale, 4)}
                    </td>
                    <td className="py-2.5 pr-3" />
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {formatMoney(Math.round(totalCost * 100), locale)}
                    </td>
                    <td className="py-2.5 pr-3" />
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {totalMarketValue !== null ? formatMoney(Math.round(totalMarketValue * 100), locale) : "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {totalGain !== null ? (
                        <span className={totalGain >= 0 ? "text-gain" : "text-loss"}>
                          {totalGain >= 0 ? "+" : ""}{formatMoney(Math.round(totalGain * 100), locale)}
                          {totalGainPercent !== null && (
                            <span className="ml-1 text-[11px]">
                              ({totalGainPercent >= 0 ? "+" : ""}{formatPercent(totalGainPercent, locale)})
                            </span>
                          )}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="py-2.5" />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Delete confirmation */}
        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
          title={tc("delete")}
          description={deleteTarget ? t("crcdDeleteDesc", { year: deleteTarget.purchaseYear }) : ""}
          confirmLabel={tc("delete")}
          cancelLabel={tc("cancel")}
          onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget.id); }}
        />
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  CRCD tranche add/edit form                                        */
/* ------------------------------------------------------------------ */

function CrcdTrancheForm({
  tranche,
  accountId,
  onSubmit,
  onCancel,
  isPending,
  t,
  tc,
}: {
  tranche: SerializedCrcdHolding | null;
  accountId: string;
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
  isPending: boolean;
  t: ReturnType<typeof useTranslations<"holdings">>;
  tc: ReturnType<typeof useTranslations<"common">>;
}) {
  const currentYear = new Date().getFullYear();
  const defaultRedemptionDate = `${currentYear + 7}-03-01`;

  return (
    <form
      action={onSubmit}
      className="mt-3 space-y-3 rounded-lg border bg-muted/30 p-4"
    >
      {tranche && <input type="hidden" name="id" value={tranche.id} />}
      <input type="hidden" name="accountId" value={accountId} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-xs">{t("crcdPurchaseYear")}</Label>
          <Input
            type="number"
            name="purchaseYear"
            min="2001"
            max={currentYear}
            defaultValue={tranche?.purchaseYear ?? currentYear}
            required
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("crcdShares")}</Label>
          <Input
            type="number"
            name="quantity"
            step="any"
            min="0"
            defaultValue={tranche?.quantity ?? ""}
            required
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("crcdBuyPrice")}</Label>
          <Input
            type="number"
            name="priceDollars"
            step="0.01"
            min="0"
            defaultValue={tranche ? (tranche.averagePriceCents / 100).toFixed(2) : ""}
            required
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("crcdRedeemableFrom")}</Label>
          <Input
            type="date"
            name="redemptionDate"
            defaultValue={tranche?.redemptionEligibleDate ?? defaultRedemptionDate}
            required
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">{t("note")}</Label>
        <Input name="notes" maxLength={500} defaultValue={tranche?.notes ?? ""} />
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? tc("loading") : tranche ? tc("save") : t("crcdAddTranche")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          {tc("cancel")}
        </Button>
      </div>
    </form>
  );
}
