"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { SerializedTransaction } from "@/lib/actions/transactions";
import { deleteTransactionAction } from "@/lib/actions/transactions";
import { formatMoney, formatNumber } from "@/lib/money/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface Account {
  id: string;
  name: string;
}

interface Props {
  transactions: SerializedTransaction[];
  accounts: Account[];
  locale: string;
  onAddTransaction: () => void;
}

const TXN_TYPES = [
  "BUY", "SELL", "DIVIDEND", "DRIP", "DEPOSIT", "WITHDRAWAL",
  "INTEREST", "FEE", "TAX_WITHHELD", "SPLIT", "MERGER", "ADJUSTMENT",
];

export function ActivitiesTab({
  transactions,
  accounts,
  locale,
  onAddTransaction,
}: Props) {
  const t = useTranslations("holdings");
  const tc = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [filterAccount, setFilterAccount] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterSecurity, setFilterSecurity] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const uniqueSecurities = useMemo(() => {
    const map = new Map<string, string>();
    for (const txn of transactions) {
      if (txn.securitySymbol) {
        map.set(txn.securitySymbol, txn.securityName ?? txn.securitySymbol);
      }
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [transactions]);

  const filtered = useMemo(() => {
    let result = transactions;
    if (filterAccount !== "all")
      result = result.filter((txn) => txn.accountId === filterAccount);
    if (filterType !== "all")
      result = result.filter((txn) => txn.type === filterType);
    if (filterSecurity !== "all")
      result = result.filter((txn) => txn.securitySymbol === filterSecurity);
    return result;
  }, [transactions, filterAccount, filterType, filterSecurity]);

  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeleteError(null);
    const result = await deleteTransactionAction(id);
    if (result.error) {
      setDeleteError(result.error);
      return;
    }
    startTransition(() => router.refresh());
  }

  function isWithinDeleteWindow(createdAt: string): boolean {
    return Date.now() - new Date(createdAt).getTime() < 60_000;
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={filterAccount} onValueChange={setFilterAccount}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("allAccounts")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allAccounts")}</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder={t("allTypes")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allTypes")}</SelectItem>
            {TXN_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterSecurity} onValueChange={setFilterSecurity}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("allSecurities")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allSecurities")}</SelectItem>
            {uniqueSecurities.map(([symbol, name]) => (
              <SelectItem key={symbol} value={symbol}>
                {symbol} — {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto">
          <Button onClick={onAddTransaction}>{t("addTransaction")}</Button>
        </div>
      </div>

      {deleteError && (
        <p className="mb-4 text-sm text-destructive">{deleteError}</p>
      )}

      {/* Delete Transaction Confirm */}
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

      {/* Transactions table */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <p>{t("noTransactions")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("type")}</TableHead>
                <TableHead>{t("account")}</TableHead>
                <TableHead>{t("symbol")}</TableHead>
                <TableHead className="text-right">{t("quantity")}</TableHead>
                <TableHead className="text-right">{t("currentPrice")}</TableHead>
                <TableHead className="text-right">{t("amount")}</TableHead>
                <TableHead className="text-right">{t("fee")}</TableHead>
                <TableHead>{t("note")}</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((txn) => (
                <TableRow key={txn.id}>
                  <TableCell className="whitespace-nowrap">{txn.date}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{txn.type}</Badge>
                  </TableCell>
                  <TableCell>{txn.accountName}</TableCell>
                  <TableCell className="font-medium">
                    {txn.securitySymbol ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {txn.quantity !== null
                      ? formatNumber(txn.quantity, locale)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {txn.priceCents !== null
                      ? formatMoney(txn.priceCents, locale)
                      : "—"}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono ${txn.amountCents >= 0 ? "text-gain" : "text-loss"}`}
                  >
                    {formatMoney(txn.amountCents, locale)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {txn.feeCents > 0 ? formatMoney(txn.feeCents, locale) : "—"}
                  </TableCell>
                  <TableCell className="max-w-[120px] truncate text-xs text-muted-foreground">
                    {txn.note ?? ""}
                  </TableCell>
                  <TableCell>
                    {isWithinDeleteWindow(txn.createdAt) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive"
                        onClick={() => setDeleteTarget(txn.id)}
                        disabled={isPending}
                      >
                        {tc("delete")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
