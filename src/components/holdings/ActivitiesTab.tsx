"use client";

import { useState, useMemo, useRef, useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { SlidersHorizontalIcon, PlusIcon, XIcon } from "lucide-react";
import type { SerializedTransaction } from "@/lib/actions/transactions";
import { deleteTransactionAction } from "@/lib/actions/transactions";
import { formatMoney, formatNumber } from "@/lib/money/format";
import { TransactionForm } from "./TransactionForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { TXN_TYPES } from "@/lib/constants/transactions";

interface Account {
  id: string;
  name: string;
  currency: string;
}

interface Props {
  transactions: SerializedTransaction[];
  accounts: Account[];
  locale: string;
}

const DELETE_UNDO_DURATION = 10_000;

function formatDate(isoDate: string, locale: string): string {
  return new Date(isoDate + "T00:00:00").toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ActivitiesTab({
  transactions,
  accounts,
  locale,
}: Props) {
  const t = useTranslations("holdings");
  const tc = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterAccount, setFilterAccount] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterSecurity, setFilterSecurity] = useState(() => searchParams.get("security") ?? "all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);
  const [txnDialogOpen, setTxnDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<SerializedTransaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SerializedTransaction | null>(null);
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());

  // Track undo state per pending delete so we can cancel
  const undoRef = useRef<Map<string, boolean>>(new Map());

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
    let result = transactions.filter((txn) => !pendingDeletes.has(txn.id));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (txn) =>
          txn.securitySymbol?.toLowerCase().includes(q) ||
          txn.securityName?.toLowerCase().includes(q) ||
          txn.accountName.toLowerCase().includes(q) ||
          txn.note?.toLowerCase().includes(q),
      );
    }
    if (filterAccount !== "all")
      result = result.filter((txn) => txn.accountId === filterAccount);
    if (filterType !== "all")
      result = result.filter((txn) => txn.type === filterType);
    if (filterSecurity !== "all")
      result = result.filter((txn) => txn.securitySymbol === filterSecurity);
    if (filterDateFrom)
      result = result.filter((txn) => txn.date >= filterDateFrom);
    if (filterDateTo)
      result = result.filter((txn) => txn.date <= filterDateTo);
    return result;
  }, [transactions, searchQuery, filterAccount, filterType, filterSecurity, filterDateFrom, filterDateTo, pendingDeletes]);

  const isFiltered =
    searchQuery !== "" ||
    filterAccount !== "all" ||
    filterType !== "all" ||
    filterSecurity !== "all" ||
    filterDateFrom !== "" ||
    filterDateTo !== "";

  const activeFilterCount = [
    filterAccount !== "all",
    filterType !== "all",
    filterSecurity !== "all",
    filterDateFrom !== "",
    filterDateTo !== "",
  ].filter(Boolean).length;

  function resetFilters() {
    setSearchQuery("");
    setFilterAccount("all");
    setFilterType("all");
    setFilterSecurity("all");
    setFilterDateFrom("");
    setFilterDateTo("");
  }

  const handleDeleteWithUndo = useCallback((id: string) => {
    // Optimistically hide the row
    setPendingDeletes((prev) => new Set(prev).add(id));
    undoRef.current.set(id, false);

    const finalize = async () => {
      if (undoRef.current.get(id)) {
        // Undo was clicked — restore the row
        undoRef.current.delete(id);
        return;
      }
      undoRef.current.delete(id);
      await deleteTransactionAction(id);
      startTransition(() => router.refresh());
    };

    toast(t("transactionDeleted"), {
      duration: DELETE_UNDO_DURATION,
      action: {
        label: t("undo"),
        onClick: () => {
          undoRef.current.set(id, true);
          setPendingDeletes((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        },
      },
      onDismiss: finalize,
      onAutoClose: finalize,
    });
  }, [t, router, startTransition]);

  function handleTxnSuccess() {
    setTxnDialogOpen(false);
    toast.success(t("transactionAdded"));
    startTransition(() => router.refresh());
  }

  function handleEditSuccess() {
    setEditingTransaction(null);
    toast.success(t("transactionUpdated"));
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-4">
      {/* Primary row: Search + Filters + Add */}
      <div className="flex items-center gap-3">
        <Input
          type="search"
          placeholder={t("searchTransactions")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="min-w-0 flex-1 sm:max-w-[260px]"
        />

        {/* Desktop: Popover filters */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="hidden shrink-0 sm:inline-flex">
              <SlidersHorizontalIcon className="size-4" />
              {activeFilterCount > 0
                ? t("filtersCount", { count: activeFilterCount })
                : t("filters")}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80">
            <FilterForm
              t={t}
              accounts={accounts}
              uniqueSecurities={uniqueSecurities}
              filterAccount={filterAccount}
              setFilterAccount={setFilterAccount}
              filterType={filterType}
              setFilterType={setFilterType}
              filterSecurity={filterSecurity}
              setFilterSecurity={setFilterSecurity}
              filterDateFrom={filterDateFrom}
              setFilterDateFrom={setFilterDateFrom}
              filterDateTo={filterDateTo}
              setFilterDateTo={setFilterDateTo}
              isFiltered={isFiltered}
              resetFilters={resetFilters}
            />
          </PopoverContent>
        </Popover>

        {/* Mobile: Sheet filters */}
        <Button
          variant="outline"
          size="icon-sm"
          className="relative shrink-0 sm:hidden"
          onClick={() => setFiltersSheetOpen(true)}
        >
          <SlidersHorizontalIcon className="size-4" />
          {activeFilterCount > 0 && (
            <span className="absolute -right-1 -top-1 size-2 rounded-full bg-primary" />
          )}
        </Button>
        <Sheet open={filtersSheetOpen} onOpenChange={setFiltersSheetOpen}>
          <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{t("filters")}</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-4">
              <FilterForm
                t={t}
                accounts={accounts}
                uniqueSecurities={uniqueSecurities}
                filterAccount={filterAccount}
                setFilterAccount={setFilterAccount}
                filterType={filterType}
                setFilterType={setFilterType}
                filterSecurity={filterSecurity}
                setFilterSecurity={setFilterSecurity}
                filterDateFrom={filterDateFrom}
                setFilterDateFrom={setFilterDateFrom}
                filterDateTo={filterDateTo}
                setFilterDateTo={setFilterDateTo}
                isFiltered={isFiltered}
                resetFilters={resetFilters}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Add transaction */}
        <Button
          onClick={() => setTxnDialogOpen(true)}
          size="icon-sm"
          className="ml-auto shrink-0 sm:hidden"
        >
          <PlusIcon className="size-4" />
        </Button>
        <Button
          onClick={() => setTxnDialogOpen(true)}
          className="ml-auto hidden shrink-0 sm:inline-flex"
        >
          {t("addTransaction")}
        </Button>
      </div>

      {/* Active filter chips */}
      {isFiltered && (
        <div className="flex flex-wrap items-center gap-2">
          {filterAccount !== "all" && (
            <Badge variant="secondary" className="gap-1 pr-1">
              {accounts.find((a) => a.id === filterAccount)?.name}
              <button type="button" onClick={() => setFilterAccount("all")} className="ml-0.5 rounded-sm hover:text-foreground">
                <XIcon className="size-3" />
              </button>
            </Badge>
          )}
          {filterType !== "all" && (
            <Badge variant="secondary" className="gap-1 pr-1">
              {t(`txnType${filterType}` as Parameters<typeof t>[0])}
              <button type="button" onClick={() => setFilterType("all")} className="ml-0.5 rounded-sm hover:text-foreground">
                <XIcon className="size-3" />
              </button>
            </Badge>
          )}
          {filterSecurity !== "all" && (
            <Badge variant="secondary" className="gap-1 pr-1">
              {filterSecurity}
              <button type="button" onClick={() => setFilterSecurity("all")} className="ml-0.5 rounded-sm hover:text-foreground">
                <XIcon className="size-3" />
              </button>
            </Badge>
          )}
          {filterDateFrom && (
            <Badge variant="secondary" className="gap-1 pr-1">
              {t("from")}: {filterDateFrom}
              <button type="button" onClick={() => setFilterDateFrom("")} className="ml-0.5 rounded-sm hover:text-foreground">
                <XIcon className="size-3" />
              </button>
            </Badge>
          )}
          {filterDateTo && (
            <Badge variant="secondary" className="gap-1 pr-1">
              {t("to")}: {filterDateTo}
              <button type="button" onClick={() => setFilterDateTo("")} className="ml-0.5 rounded-sm hover:text-foreground">
                <XIcon className="size-3" />
              </button>
            </Badge>
          )}
          <Button variant="ghost" size="xs" onClick={resetFilters}>
            {t("clearAll")}
          </Button>
          {filtered.length > 0 && (
            <span className="ml-auto text-sm text-muted-foreground">
              {t("showingTransactions", { count: filtered.length, total: transactions.length - pendingDeletes.size })}
            </span>
          )}
        </div>
      )}

      {/* Transactions table */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <p>{isFiltered ? t("noTransactionsFiltered") : t("noTransactions")}</p>
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
                <TableHead className="text-right">{t("price")}</TableHead>
                <TableHead className="text-right">{t("amount")}</TableHead>
                <TableHead className="text-right">{t("fee")}</TableHead>
                <TableHead>{t("note")}</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((txn) => (
                <TableRow key={txn.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(txn.date, locale)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{t(`txnType${txn.type}` as Parameters<typeof t>[0])}</Badge>
                  </TableCell>
                  <TableCell>{txn.accountName}</TableCell>
                  <TableCell>
                    {txn.securitySymbol ? (
                      <>
                        <span className="font-medium">{txn.securitySymbol}</span>
                        {txn.securityName && (
                          <p className="text-xs text-muted-foreground">
                            {txn.securityName}
                          </p>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
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
                  <TableCell className="text-right">
                    <span
                      className={`font-mono ${txn.amountCents >= 0 ? "text-gain" : "text-loss"}`}
                    >
                      {formatMoney(txn.amountCents, locale)}
                    </span>
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      {txn.currency}
                    </span>
                    {txn.taxWithheldCents > 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        {t("grossAmount")}: {formatMoney(txn.amountCents + txn.taxWithheldCents + txn.feeCents, locale)}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {txn.feeCents > 0 ? formatMoney(txn.feeCents, locale) : "—"}
                  </TableCell>
                  <TableCell
                    className="max-w-[120px] truncate text-xs text-muted-foreground"
                    title={txn.note ?? undefined}
                  >
                    {txn.note ?? ""}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="5" r="2" />
                            <circle cx="12" cy="12" r="2" />
                            <circle cx="12" cy="19" r="2" />
                          </svg>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingTransaction(txn)}>
                          {tc("edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteTarget(txn)}
                        >
                          {tc("delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={t("deleteTransactionTitle")}
        description={
          deleteTarget
            ? deleteTarget.securitySymbol
              ? t("deleteTransactionDesc", {
                  type: t(`txnType${deleteTarget.type}` as Parameters<typeof t>[0]),
                  symbol: deleteTarget.securitySymbol,
                  date: formatDate(deleteTarget.date, locale),
                })
              : t("deleteTransactionDescNoSecurity", {
                  type: t(`txnType${deleteTarget.type}` as Parameters<typeof t>[0]),
                  date: formatDate(deleteTarget.date, locale),
                })
            : ""
        }
        confirmLabel={tc("delete")}
        cancelLabel={tc("cancel")}
        onConfirm={() => {
          if (deleteTarget) handleDeleteWithUndo(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />

      {/* Add Transaction Dialog */}
      <Dialog open={txnDialogOpen} onOpenChange={setTxnDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("addTransaction")}</DialogTitle>
          </DialogHeader>
          <TransactionForm
            accounts={accounts}
            onSuccess={handleTxnSuccess}
            onCancel={() => setTxnDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Transaction Dialog */}
      <Dialog
        open={!!editingTransaction}
        onOpenChange={(open) => { if (!open) setEditingTransaction(null); }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("editTransaction")}</DialogTitle>
          </DialogHeader>
          {editingTransaction && (
            <TransactionForm
              key={editingTransaction.id}
              accounts={accounts}
              transaction={editingTransaction}
              onSuccess={handleEditSuccess}
              onCancel={() => setEditingTransaction(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Shared filter form used in both Popover (desktop) and Sheet (mobile) ── */

interface FilterFormProps {
  t: ReturnType<typeof useTranslations<"holdings">>;
  accounts: Account[];
  uniqueSecurities: [string, string][];
  filterAccount: string;
  setFilterAccount: (v: string) => void;
  filterType: string;
  setFilterType: (v: string) => void;
  filterSecurity: string;
  setFilterSecurity: (v: string) => void;
  filterDateFrom: string;
  setFilterDateFrom: (v: string) => void;
  filterDateTo: string;
  setFilterDateTo: (v: string) => void;
  isFiltered: boolean;
  resetFilters: () => void;
}

function FilterForm({
  t,
  accounts,
  uniqueSecurities,
  filterAccount,
  setFilterAccount,
  filterType,
  setFilterType,
  filterSecurity,
  setFilterSecurity,
  filterDateFrom,
  setFilterDateFrom,
  filterDateTo,
  setFilterDateTo,
  isFiltered,
  resetFilters,
}: FilterFormProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t("account")}</Label>
        <Select value={filterAccount} onValueChange={setFilterAccount}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("allAccounts")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allAccounts")}</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>{t("type")}</Label>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("allTypes")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allTypes")}</SelectItem>
            {TXN_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {t(`txnType${type}` as Parameters<typeof t>[0])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>{t("symbol")}</Label>
        <Select value={filterSecurity} onValueChange={setFilterSecurity}>
          <SelectTrigger className="w-full">
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
      </div>

      <div className="space-y-2">
        <Label>{t("dateRange")}</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            aria-label={t("from")}
          />
          <Input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            aria-label={t("to")}
          />
        </div>
      </div>

      {isFiltered && (
        <Button variant="ghost" size="sm" onClick={resetFilters} className="w-full">
          {t("resetFilters")}
        </Button>
      )}
    </div>
  );
}
