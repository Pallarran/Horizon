"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { SerializedPosition } from "@/lib/positions/serialize";
import { deleteAccountAction } from "@/lib/actions/accounts";
import { formatMoney } from "@/lib/money/format";
import { AccountForm } from "./AccountForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const accountStats = useMemo(() => {
    const grouped = new Map<string, SerializedPosition[]>();
    for (const p of positions) {
      const list = grouped.get(p.accountId) ?? [];
      list.push(p);
      grouped.set(p.accountId, list);
    }
    return grouped;
  }, [positions]);

  async function handleDelete(accountId: string) {
    setDeleteError(null);
    const result = await deleteAccountAction(accountId);
    if (result.error) {
      setDeleteError(result.error);
      return;
    }
    startTransition(() => router.refresh());
  }

  function handleSuccess() {
    setCreateDialogOpen(false);
    setEditingAccount(null);
    startTransition(() => router.refresh());
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("accountsTab")}</h2>
        <Button onClick={() => setCreateDialogOpen(true)}>
          {t("createAccount")}
        </Button>
      </div>

      {deleteError && (
        <p className="mb-4 text-sm text-destructive">{deleteError}</p>
      )}

      {accounts.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <p>{t("noAccounts")}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((acct) => {
            const acctPositions = accountStats.get(acct.id) ?? [];
            const totalValue = acctPositions.reduce(
              (s, p) => s + (p.marketValueCents ?? p.totalCostCents),
              0,
            );
            const totalCost = acctPositions.reduce(
              (s, p) => s + p.totalCostCents,
              0,
            );
            const unrealizedGain = totalValue - totalCost;
            const expectedIncome = acctPositions.reduce(
              (s, p) => s + (p.expectedIncomeCents ?? 0),
              0,
            );

            return (
              <Card key={acct.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{acct.name}</CardTitle>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          ···
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
                          onClick={() => setDeleteTarget(acct.id)}
                        >
                          {tc("delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{acct.type}</Badge>
                    <Badge variant="secondary">{acct.currency}</Badge>
                  </div>

                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t("totalValue")}
                      </span>
                      <span className="font-medium tabular-nums">
                        {formatMoney(totalValue, locale)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t("unrealizedGain")}
                      </span>
                      <span
                        className={`tabular-nums ${unrealizedGain >= 0 ? "text-gain" : "text-loss"}`}
                      >
                        {unrealizedGain >= 0 ? "+" : ""}
                        {formatMoney(unrealizedGain, locale)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t("expectedIncome")}
                      </span>
                      <span className="tabular-nums">
                        {formatMoney(expectedIncome, locale)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t("positions")}
                      </span>
                      <span>{acctPositions.length}</span>
                    </div>
                    {acct.externalId && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {t("broker")}
                        </span>
                        <span className="font-mono text-xs">
                          {acct.externalId}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Account Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("createAccount")}</DialogTitle>
          </DialogHeader>
          <AccountForm
            onSuccess={handleSuccess}
            onCancel={() => setCreateDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={tc("delete")}
        description={tc("confirm") + "?"}
        confirmLabel={tc("delete")}
        cancelLabel={tc("cancel")}
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget);
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
              onSuccess={handleSuccess}
              onCancel={() => setEditingAccount(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
