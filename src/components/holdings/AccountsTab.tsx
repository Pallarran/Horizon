"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { SerializedPosition } from "@/lib/positions/serialize";
import { deleteAccountAction } from "@/lib/actions/accounts";
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

interface Props {
  accounts: Account[];
  positions: SerializedPosition[];
  locale: string;
}

export function AccountsTab({ accounts, positions, locale }: Props) {
  const t = useTranslations("holdings");
  const tc = useTranslations("common");
  const router = useRouter();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);

  const accountStats = useMemo(() => {
    const portfolioTotal = positions.reduce(
      (s, p) => s + (p.marketValueCents ?? p.totalCostCents),
      0,
    );

    return accounts.map((account) => {
      const ap = positions.filter((p) => p.accountId === account.id);
      const marketValue = ap.reduce(
        (s, p) => s + (p.marketValueCents ?? p.totalCostCents),
        0,
      );
      const totalCost = ap.reduce((s, p) => s + p.totalCostCents, 0);
      const gain = marketValue - totalCost;
      const gainPercent = totalCost > 0 ? gain / totalCost : null;
      const income = ap.reduce(
        (s, p) => s + (p.expectedIncomeCents ?? 0),
        0,
      );
      const yieldPct = marketValue > 0 ? income / marketValue : null;
      const weight = portfolioTotal > 0 ? marketValue / portfolioTotal : 0;

      return {
        ...account,
        marketValue,
        totalCost,
        gain,
        gainPercent,
        income,
        yieldPct,
        weight,
        positionCount: ap.length,
      };
    });
  }, [accounts, positions]);

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

  return (
    <div>
      {deleteError && (
        <p className="mb-4 text-sm text-destructive">{deleteError}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {accountStats.map((acct) => (
          <Link
            key={acct.id}
            href={`/${locale}/holdings?account=${acct.id}`}
            className={`block rounded-xl border p-5 shadow-sm transition-colors hover:border-primary/30 ${
              acct.positionCount === 0
                ? "border-dashed bg-card/50"
                : "bg-card"
            }`}
          >
            {/* Top row: type · currency + menu */}
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                {t(`accountType${acct.type}` as Parameters<typeof t>[0])} ·{" "}
                {acct.currency}
              </p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground"
                    onClick={(e) => e.preventDefault()}
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
                    onClick={() => setEditingAccount(acct)}
                  >
                    {tc("edit")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setDeleteTarget(acct)}
                  >
                    {tc("delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Account name */}
            <p className="mt-1 text-sm font-medium">{acct.name}</p>

            {/* Hero value */}
            <p className="mt-4 text-center text-2xl font-bold tabular-nums">
              {formatMoney(acct.marketValue, locale)}
            </p>

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

            {/* Mini stats row */}
            <div className="mt-4 grid grid-cols-3 divide-x text-center">
              <div className="px-2">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {t("weight")}
                </p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums">
                  {formatPercent(acct.weight, locale, 1)}
                </p>
              </div>
              <div className="px-2">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {t("income")}
                </p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums">
                  {formatMoney(acct.income, locale)}
                </p>
              </div>
              <div className="px-2">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {t("yield")}
                </p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums">
                  {acct.yieldPct !== null
                    ? formatPercent(acct.yieldPct, locale)
                    : "—"}
                </p>
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
          </Link>
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
            ? t("deleteAccountDesc", { name: deleteTarget.name, currency: deleteTarget.currency })
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
