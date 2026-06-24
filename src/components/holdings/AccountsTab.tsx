"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable, isSortable } from "@dnd-kit/react/sortable";
import { GripVertical, Plus, MoreVertical } from "lucide-react";
import type { SerializedPosition } from "@/lib/positions/serialize";
import { deleteAccountAction, reorderAccountsAction } from "@/lib/actions/accounts";
import { formatMoney, formatPercent } from "@/lib/money/format";
import { AccountForm } from "./AccountForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface Account {
  id: string;
  name: string;
  type: string;
  currency: string;
  externalId: string | null;
}

interface AccountStat extends Account {
  /** Market value of positions converted to CAD */
  marketValue: number;
  /** Native CAD positions total (null if none) */
  marketValueCad: number | null;
  /** Native USD positions total (null if none) */
  marketValueUsd: number | null;
  /** Cost basis in CAD (historical FX) */
  totalCost: number;
  gain: number;
  gainPercent: number | null;
  /** Expected income in CAD */
  income: number;
  yieldPct: number | null;
  positionCount: number;
  currencyLabel: string;
  /** Native CAD cash balance (cents) */
  cashCad: number;
  /** Native USD cash balance (cents) */
  cashUsd: number;
  /** Total cash converted to CAD (cents) */
  cashTotalCad: number;
  /** Hero total = positions market value + cash, in CAD */
  totalValue: number;
  /** Share of the whole portfolio by total value (0..1) */
  valueWeight: number;
  /** Bar fill relative to the largest account (0..1) */
  weightBar: number;
  /** Stable per-account accent colour */
  color: string;
}

interface Props {
  accounts: Account[];
  positions: SerializedPosition[];
  cashBalances: Record<string, { cad: number; usd: number }>;
  usdCadRate: number;
  locale: string;
}

/** Per-account accent palette (mirrors the dashboard allocation colours). */
const ACCOUNT_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-4)",
  "var(--chart-3)",
  "var(--chart-5)",
  "var(--muted-foreground)",
];

const ROW_GRID =
  "grid-cols-[24px_2.1fr_1.6fr_1.25fr_1fr_1.05fr_0.9fr_0.8fr_32px]";

/* ------------------------------------------------------------------ */
/*  Sortable account row                                              */
/* ------------------------------------------------------------------ */

function SortableAccountRow({
  acct,
  index,
  locale,
  onEdit,
  onDelete,
}: {
  acct: AccountStat;
  index: number;
  locale: string;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
}) {
  const t = useTranslations("holdings");
  const tc = useTranslations("common");
  const router = useRouter();
  const { ref, handleRef } = useSortable({ id: acct.id, index });

  const gainPositive = acct.gain >= 0;
  const hasUsdValue = acct.marketValueUsd !== null;
  const hasUsdCash = acct.cashCad !== 0 && acct.cashUsd !== 0;

  return (
    <div
      ref={ref}
      onClick={() => router.push(`/${locale}/portfolio?tab=holdings&account=${acct.id}`)}
      className={`grid ${ROW_GRID} cursor-pointer items-center border-b border-border/60 px-[18px] py-3.5 text-sm transition-colors last:border-b-0 hover:bg-muted/40`}
    >
      {/* Drag handle */}
      <button
        ref={handleRef}
        type="button"
        className="cursor-grab touch-none text-muted-foreground/40 hover:text-muted-foreground"
        onClick={(e) => e.stopPropagation()}
        aria-label="Reorder"
      >
        <GripVertical className="size-4" />
      </button>

      {/* Account */}
      <div className="flex min-w-0 items-center gap-2.5 pr-3">
        <span
          className="size-2.5 shrink-0 rounded-sm"
          style={{ backgroundColor: acct.color }}
        />
        <div className="min-w-0">
          <p className="truncate font-semibold">{acct.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {t(`accountType${acct.type}` as Parameters<typeof t>[0])} · {acct.currencyLabel}
            {acct.positionCount > 0 && <> · {acct.positionCount} {t("positions")}</>}
          </p>
        </div>
      </div>

      {/* Share of portfolio */}
      <div className="flex items-center gap-2.5 pr-4">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.round(acct.weightBar * 100)}%`, backgroundColor: acct.color }}
          />
        </div>
        <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
          {formatPercent(acct.valueWeight, locale, 1)}
        </span>
      </div>

      {/* Total value */}
      <div className="text-right">
        <span className="font-bold tabular-nums">{formatMoney(acct.totalValue, locale)}</span>
        {hasUsdValue && (
          <div className="text-[10px] tabular-nums text-muted-foreground">
            {acct.marketValueCad !== null && <>{formatMoney(acct.marketValueCad, locale)} · </>}
            {formatMoney(acct.marketValueUsd as number, locale, "USD")}
          </div>
        )}
      </div>

      {/* Cash */}
      <div className="text-right">
        <span
          className={`text-[13px] font-semibold tabular-nums ${
            acct.cashTotalCad < 0
              ? "text-loss"
              : acct.cashTotalCad > 0
                ? "text-primary"
                : "text-muted-foreground"
          }`}
        >
          {formatMoney(acct.cashTotalCad, locale)}
        </span>
        {hasUsdCash && (
          <div className="text-[10px] tabular-nums text-primary/70">
            {formatMoney(acct.cashUsd, locale, "USD")}
          </div>
        )}
      </div>

      {/* Gain */}
      <div className={`text-right text-[13px] tabular-nums ${gainPositive ? "text-gain" : "text-loss"}`}>
        <span>
          {gainPositive ? "+" : ""}
          {formatMoney(acct.gain, locale)}
        </span>
        {acct.gainPercent !== null && (
          <div className="text-[11px]">
            ({gainPositive ? "+" : ""}
            {formatPercent(acct.gainPercent, locale)})
          </div>
        )}
      </div>

      {/* Income */}
      <div className="text-right text-[13px] font-medium tabular-nums">
        {formatMoney(acct.income, locale)}
      </div>

      {/* Yield */}
      <div className="text-right text-[13px] font-semibold tabular-nums text-primary">
        {acct.yieldPct !== null ? formatPercent(acct.yieldPct, locale) : "—"}
      </div>

      {/* Row menu */}
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="size-7 p-0 text-muted-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onEdit(acct);
              }}
            >
              {tc("edit")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(acct);
              }}
            >
              {tc("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

export function AccountsTab({ accounts, positions, cashBalances, usdCadRate, locale }: Props) {
  const t = useTranslations("holdings");
  const tc = useTranslations("common");
  const router = useRouter();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);

  // Local account order for optimistic DnD updates
  const [orderedAccounts, setOrderedAccounts] = useState(accounts);
  useEffect(() => {
    setOrderedAccounts(accounts);
  }, [accounts]);

  const toCad = (cents: number, currency: string) =>
    currency === "USD" ? Math.round(cents * usdCadRate) : cents;

  const accountStats = useMemo(() => {
    const valueCad = (p: SerializedPosition) =>
      p.marketValueCents != null ? toCad(p.marketValueCents, p.currency) : p.totalCostCadCents;

    const stats = orderedAccounts.map((account, i) => {
      const ap = positions.filter((p) => p.accountId === account.id);

      const marketValue = ap.reduce((s, p) => s + valueCad(p), 0);

      const cadPositions = ap.filter((p) => p.currency === "CAD");
      const usdPositions = ap.filter((p) => p.currency === "USD");
      const marketValueCad =
        cadPositions.length > 0
          ? cadPositions.reduce((s, p) => s + (p.marketValueCents ?? p.totalCostCents), 0)
          : null;
      const marketValueUsd =
        usdPositions.length > 0
          ? usdPositions.reduce((s, p) => s + (p.marketValueCents ?? p.totalCostCents), 0)
          : null;

      const totalCost = ap.reduce((s, p) => s + p.totalCostCadCents, 0);
      const gain = marketValue - totalCost;
      const gainPercent = totalCost > 0 ? gain / totalCost : null;

      const income = ap.reduce((s, p) => s + toCad(p.expectedIncomeCents ?? 0, p.currency), 0);
      const yieldPct = marketValue > 0 ? income / marketValue : null;

      const currencies = new Set(ap.map((p) => p.currency));
      const currencyLabel = currencies.size > 0 ? [...currencies].sort().join("/") : account.currency;

      const bal = cashBalances[account.id] ?? { cad: 0, usd: 0 };
      const cashCad = bal.cad;
      const cashUsd = bal.usd;
      const cashTotalCad = bal.cad + Math.round(bal.usd * usdCadRate);
      const totalValue = marketValue + cashTotalCad;

      return {
        ...account,
        marketValue,
        marketValueCad,
        marketValueUsd,
        totalCost,
        gain,
        gainPercent,
        income,
        yieldPct,
        positionCount: ap.length,
        currencyLabel,
        cashCad,
        cashUsd,
        cashTotalCad,
        totalValue,
        valueWeight: 0,
        weightBar: 0,
        color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length],
      };
    });

    const grandTotal = stats.reduce((s, a) => s + a.totalValue, 0);
    const maxWeight = stats.reduce(
      (m, a) => Math.max(m, grandTotal > 0 ? a.totalValue / grandTotal : 0),
      0,
    );
    for (const a of stats) {
      a.valueWeight = grandTotal > 0 ? a.totalValue / grandTotal : 0;
      a.weightBar = maxWeight > 0 ? a.valueWeight / maxWeight : 0;
    }
    return stats;
  }, [orderedAccounts, positions, usdCadRate, cashBalances]);

  // Portfolio-wide aggregates for the allocation header
  const totals = useMemo(() => {
    const totalValue = accountStats.reduce((s, a) => s + a.totalValue, 0);
    const totalGain = accountStats.reduce((s, a) => s + a.gain, 0);
    const totalCost = accountStats.reduce((s, a) => s + a.totalCost, 0);
    const totalCash = accountStats.reduce((s, a) => s + a.cashTotalCad, 0);
    return {
      totalValue,
      totalGain,
      totalCost,
      totalCash,
      gainPercent: totalCost > 0 ? totalGain / totalCost : null,
    };
  }, [accountStats]);

  async function handleDelete(accountId: string) {
    setDeleteError(null);
    const result = await deleteAccountAction(accountId);
    if (result.error) {
      setDeleteError(result.error);
      return;
    }
    toast.success(t("accountDeleted"));
    startTransition(() => router.refresh());
  }

  function handleCreateSuccess() {
    setCreateDialogOpen(false);
    toast.success(t("accountCreated"));
    startTransition(() => router.refresh());
  }

  function handleEditSuccess() {
    setEditingAccount(null);
    toast.success(t("accountUpdated"));
    startTransition(() => router.refresh());
  }

  function handleDragEnd(
    event: Parameters<NonNullable<React.ComponentProps<typeof DragDropProvider>["onDragEnd"]>>[0],
  ) {
    if (event.canceled) return;
    const { source } = event.operation;
    if (isSortable(source)) {
      const { initialIndex, index } = source;
      if (initialIndex !== index) {
        setOrderedAccounts((prev) => {
          const next = [...prev];
          const [removed] = next.splice(initialIndex, 1);
          next.splice(index, 0, removed);
          reorderAccountsAction(next.map((a) => a.id));
          return next;
        });
      }
    }
  }

  const gainPositive = totals.totalGain >= 0;

  return (
    <div>
      {deleteError && <p className="mb-4 text-sm text-destructive">{deleteError}</p>}

      {/* Allocation header */}
      <div className="mb-4 rounded-xl border bg-card px-6 py-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("totalAcrossAccounts", { count: accountStats.length })}
            </p>
            <p className="mt-1 text-[28px] font-extrabold tabular-nums">
              {formatMoney(totals.totalValue, locale)}
            </p>
          </div>
          <div className="text-right">
            <p className={`text-[13px] font-semibold tabular-nums ${gainPositive ? "text-gain" : "text-loss"}`}>
              {gainPositive ? "+" : ""}
              {formatMoney(totals.totalGain, locale)}
              {totals.gainPercent !== null && (
                <> ({gainPositive ? "+" : ""}{formatPercent(totals.gainPercent, locale)})</>
              )}
            </p>
            {totals.totalCash > 0 && (
              <p className="mt-1 text-[13px] font-semibold tabular-nums text-primary">
                {t("cashToReinvest", { amount: formatMoney(totals.totalCash, locale) })}
              </p>
            )}
          </div>
        </div>

        {/* Stacked allocation bar */}
        <div className="mb-2.5 flex h-3.5 overflow-hidden rounded-full bg-muted">
          {accountStats.map((a) => (
            <div
              key={a.id}
              style={{ width: `${a.valueWeight * 100}%`, backgroundColor: a.color }}
              title={a.name}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-[18px] gap-y-1.5 text-xs text-foreground/70">
          {accountStats.map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: a.color }} />
              {t(`accountType${a.type}` as Parameters<typeof t>[0])}{" "}
              <span className="tabular-nums">{formatPercent(a.valueWeight, locale, 0)}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Ranked list */}
      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <div className="min-w-[920px]">
          {/* Column header */}
          <div
            className={`grid ${ROW_GRID} border-b px-[18px] py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground`}
          >
            <span />
            <span>{t("account")}</span>
            <span>{t("shareOfPortfolio")}</span>
            <span className="text-right">{t("totalValue")}</span>
            <span className="text-right">{t("cash")}</span>
            <span className="text-right">{t("gain")}</span>
            <span className="text-right">{t("income")}</span>
            <span className="text-right">{t("yield")}</span>
            <span />
          </div>

          <DragDropProvider onDragEnd={handleDragEnd}>
            {accountStats.map((acct, index) => (
              <SortableAccountRow
                key={acct.id}
                acct={acct}
                index={index}
                locale={locale}
                onEdit={setEditingAccount}
                onDelete={setDeleteTarget}
              />
            ))}
          </DragDropProvider>

          {/* Create account row */}
          <button
            type="button"
            onClick={() => setCreateDialogOpen(true)}
            className="flex w-full items-center gap-2 px-[18px] py-3.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary"
          >
            <Plus className="size-4" />
            {t("createAccount")}
          </button>
        </div>
      </div>

      {/* Create Account Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("createAccount")}</DialogTitle>
          </DialogHeader>
          <AccountForm onSuccess={handleCreateSuccess} onCancel={() => setCreateDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={tc("delete")}
        description={deleteTarget ? t("deleteAccountDesc", { name: deleteTarget.name }) : ""}
        confirmLabel={tc("delete")}
        cancelLabel={tc("cancel")}
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />

      {/* Edit Account Dialog */}
      <Dialog
        open={!!editingAccount}
        onOpenChange={(open) => {
          if (!open) setEditingAccount(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editAccount")}</DialogTitle>
          </DialogHeader>
          {editingAccount && (
            <AccountForm
              account={editingAccount}
              onSuccess={handleEditSuccess}
              onCancel={() => setEditingAccount(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
