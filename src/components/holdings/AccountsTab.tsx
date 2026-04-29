"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable, isSortable } from "@dnd-kit/react/sortable";
import { GripVertical } from "lucide-react";
import type { SerializedPosition } from "@/lib/positions/serialize";
import type { PortfolioHistoryPoint } from "@/lib/dashboard/portfolio-history";
import { deleteAccountAction, reorderAccountsAction } from "@/lib/actions/accounts";
import { formatMoney, formatPercent } from "@/lib/money/format";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
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
  /** Market value converted to CAD */
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
  weight: number;
  positionCount: number;
  currencyLabel: string;
}

interface Props {
  accounts: Account[];
  positions: SerializedPosition[];
  accountHistories: Record<string, PortfolioHistoryPoint[]>;
  cashBalances: Record<string, number>;
  usdCadRate: number;
  locale: string;
}

/* ------------------------------------------------------------------ */
/*  Sortable account card                                             */
/* ------------------------------------------------------------------ */

function SortableAccountCard({
  acct,
  index,
  locale,
  accountHistories,
  cashBalances,
  onEdit,
  onDelete,
}: {
  acct: AccountStat;
  index: number;
  locale: string;
  accountHistories: Record<string, PortfolioHistoryPoint[]>;
  cashBalances: Record<string, number>;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
}) {
  const t = useTranslations("holdings");
  const tc = useTranslations("common");
  const router = useRouter();
  const { ref, handleRef } = useSortable({ id: acct.id, index });

  return (
    <div
      ref={ref}
      onClick={() => router.push(`/${locale}/portfolio?tab=holdings&account=${acct.id}`)}
      className={`cursor-pointer rounded-xl border p-5 shadow-sm transition-colors hover:border-primary/30 ${
        acct.positionCount === 0
          ? "border-dashed bg-card/50"
          : "bg-card"
      }`}
    >
      {/* Top row: drag handle + type · currency + menu */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            ref={handleRef}
            type="button"
            className="cursor-grab touch-none text-muted-foreground/50 hover:text-muted-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="size-4" />
          </button>
          <p className="text-xs font-medium text-muted-foreground">
            {t(`accountType${acct.type}` as Parameters<typeof t>[0])} ·{" "}
            {acct.currencyLabel}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
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

      {/* Account name */}
      <p className="mt-1 text-sm font-medium">{acct.name}</p>

      {/* Hero value (CAD) */}
      <p className="mt-4 text-center text-2xl font-bold tabular-nums">
        {formatMoney(acct.marketValue, locale)}
      </p>

      {/* Per-currency breakdown (shown when account has USD positions) */}
      {acct.marketValueUsd !== null && (
        <p className="mt-0.5 text-center text-xs text-muted-foreground tabular-nums">
          {acct.marketValueCad !== null
            ? `CAD ${formatMoney(acct.marketValueCad, locale)} · USD ${formatMoney(acct.marketValueUsd, locale, "USD")}`
            : `USD ${formatMoney(acct.marketValueUsd, locale, "USD")}`}
        </p>
      )}

      {/* Gain line */}
      <p
        className={`mt-1 text-center text-sm tabular-nums ${
          acct.gain >= 0 ? "text-gain" : "text-loss"
        }`}
      >
        {acct.gain >= 0 ? "+" : ""}
        {formatMoney(acct.gain, locale)}
        {acct.gainPercent !== null && (
          <> ({acct.gainPercent >= 0 ? "+" : ""}{formatPercent(acct.gainPercent, locale)})</>
        )}
      </p>

      {/* Sparkline */}
      {(() => {
        const history = accountHistories[acct.id];
        const hasData = history && history.length >= 2 && history.some((p) => p.valueCents > 0);
        if (!hasData) return null;
        const chartData = history.map((p) => ({ v: p.valueCents / 100 }));
        const gradientId = `acctGradient-${acct.id}`;
        return (
          <div className="mt-3 h-16">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="var(--chart-1)"
                  fill={`url(#${gradientId})`}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        );
      })()}

      {/* Mini stats row */}
      <div className="mt-4 grid grid-cols-4 divide-x text-center">
        <div className="px-1.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {t("weight")}
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums">
            {formatPercent(acct.weight, locale, 1)}
          </p>
        </div>
        <div className="px-1.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {t("income")}
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums">
            {formatMoney(acct.income, locale)}
          </p>
        </div>
        <div className="px-1.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {t("yield")}
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums">
            {acct.yieldPct !== null
              ? formatPercent(acct.yieldPct, locale)
              : "—"}
          </p>
        </div>
        <div className="px-1.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {t("cash")}
          </p>
          {(() => {
            const cash = cashBalances[acct.id] ?? 0;
            return (
              <p className={`mt-0.5 text-sm font-semibold tabular-nums ${cash < 0 ? "text-loss" : ""}`}>
                {formatMoney(cash, locale)}
              </p>
            );
          })()}
        </div>
      </div>

      {/* Footer */}
      <p className="mt-4 text-xs text-muted-foreground">
        {acct.positionCount === 0 ? (
          t("emptyAccount")
        ) : (
          <>
            {acct.positionCount} {t("positions")}
            {acct.externalId && (
              <> · {t("broker")} {acct.externalId}</>
            )}
          </>
        )}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

export function AccountsTab({ accounts, positions, accountHistories, cashBalances, usdCadRate, locale }: Props) {
  const t = useTranslations("holdings");
  const tc = useTranslations("common");
  const router = useRouter();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);

  // Local account order for optimistic DnD updates
  const [orderedAccounts, setOrderedAccounts] = useState(accounts);
  useEffect(() => {
    setOrderedAccounts(accounts);
  }, [accounts]);

  const toCad = (cents: number, currency: string) =>
    currency === "USD" ? Math.round(cents * usdCadRate) : cents;

  const accountStats = useMemo(() => {
    const portfolioTotal = positions.reduce(
      (s, p) => s + toCad(p.marketValueCents ?? p.totalCostCadCents, p.currency),
      0,
    );

    return orderedAccounts.map((account) => {
      const ap = positions.filter((p) => p.accountId === account.id);

      // CAD-converted total
      const marketValue = ap.reduce(
        (s, p) => s + toCad(p.marketValueCents ?? p.totalCostCadCents, p.currency),
        0,
      );

      // Per-currency native amounts
      const cadPositions = ap.filter((p) => p.currency === "CAD");
      const usdPositions = ap.filter((p) => p.currency === "USD");
      const marketValueCad = cadPositions.length > 0
        ? cadPositions.reduce((s, p) => s + (p.marketValueCents ?? p.totalCostCents), 0)
        : null;
      const marketValueUsd = usdPositions.length > 0
        ? usdPositions.reduce((s, p) => s + (p.marketValueCents ?? p.totalCostCents), 0)
        : null;

      // Cost basis in CAD (already converted via historical FX)
      const totalCost = ap.reduce((s, p) => s + p.totalCostCadCents, 0);
      const gain = marketValue - totalCost;
      const gainPercent = totalCost > 0 ? gain / totalCost : null;

      // Income converted to CAD
      const income = ap.reduce(
        (s, p) => s + toCad(p.expectedIncomeCents ?? 0, p.currency),
        0,
      );
      const yieldPct = marketValue > 0 ? income / marketValue : null;
      const weight = portfolioTotal > 0 ? marketValue / portfolioTotal : 0;

      const currencies = new Set(ap.map((p) => p.currency));
      const currencyLabel = currencies.size > 0
        ? [...currencies].sort().join("/")
        : account.currency;

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
        weight,
        positionCount: ap.length,
        currencyLabel,
      };
    });
  }, [orderedAccounts, positions, usdCadRate]);

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

  function handleDragEnd(event: Parameters<NonNullable<React.ComponentProps<typeof DragDropProvider>["onDragEnd"]>>[0]) {
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

  return (
    <div>
      {deleteError && (
        <p className="mb-4 text-sm text-destructive">{deleteError}</p>
      )}

      <DragDropProvider onDragEnd={handleDragEnd}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accountStats.map((acct, index) => (
            <SortableAccountCard
              key={acct.id}
              acct={acct}
              index={index}
              locale={locale}
              accountHistories={accountHistories}
              cashBalances={cashBalances}
              onEdit={setEditingAccount}
              onDelete={setDeleteTarget}
            />
          ))}

          {/* Create account placeholder card */}
          <button
            type="button"
            onClick={() => setCreateDialogOpen(true)}
            className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" x2="12" y1="8" y2="16" />
              <line x1="8" x2="16" y1="12" y2="12" />
            </svg>
            <span className="mt-2 text-sm font-medium">
              {t("createAccount")}
            </span>
          </button>
        </div>
      </DragDropProvider>

      {/* Create Account Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("createAccount")}</DialogTitle>
          </DialogHeader>
          <AccountForm
            onSuccess={handleCreateSuccess}
            onCancel={() => setCreateDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={tc("delete")}
        description={
          deleteTarget
            ? t("deleteAccountDesc", { name: deleteTarget.name })
            : ""
        }
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
