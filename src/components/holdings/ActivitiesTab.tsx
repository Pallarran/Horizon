"use client";

import { useState, useMemo, useRef, useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import Link from "next/link";
import { SlidersHorizontalIcon, PlusIcon, XIcon, UploadIcon, Trash2Icon } from "lucide-react";
import type { SerializedTransaction } from "@/lib/actions/transactions";
import { deleteTransactionAction, deleteTransactionsAction } from "@/lib/actions/transactions";
import { Checkbox } from "@/components/ui/checkbox";
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
import { MultiSelect } from "@/components/ui/multi-select";
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
  const tNav = useTranslations("nav");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [searchQuery, setSearchQuery] = useState(() => searchParams.get("q") ?? "");
  const [filterAccounts, setFilterAccounts] = useState<string[]>(() => {
    const p = searchParams.get("account");
    return p ? p.split(",") : [];
  });
  const [filterTypes, setFilterTypes] = useState<string[]>(() => {
    const p = searchParams.get("type");
    return p ? p.split(",") : [];
  });
  const [filterSecurities, setFilterSecurities] = useState<string[]>(() => {
    const p = searchParams.get("security");
    return p ? p.split(",") : [];
  });
  const [filterDateFrom, setFilterDateFrom] = useState(() => searchParams.get("from") ?? "");
  const [filterDateTo, setFilterDateTo] = useState(() => searchParams.get("to") ?? "");
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);
  const [txnDialogOpen, setTxnDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<SerializedTransaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SerializedTransaction | null>(null);
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, startBulkDelete] = useTransition();

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

  const transactionYears = useMemo(() => {
    const years = new Set<number>();
    for (const txn of transactions) {
      years.add(parseInt(txn.date.substring(0, 4)));
    }
    return [...years].sort((a, b) => b - a);
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
    if (filterAccounts.length > 0)
      result = result.filter((txn) => filterAccounts.includes(txn.accountId));
    if (filterTypes.length > 0)
      result = result.filter((txn) => filterTypes.includes(txn.type));
    if (filterSecurities.length > 0)
      result = result.filter((txn) => filterSecurities.includes(txn.securitySymbol ?? ""));
    if (filterDateFrom)
      result = result.filter((txn) => txn.date >= filterDateFrom);
    if (filterDateTo)
      result = result.filter((txn) => txn.date <= filterDateTo);
    return result;
  }, [transactions, searchQuery, filterAccounts, filterTypes, filterSecurities, filterDateFrom, filterDateTo, pendingDeletes]);

  const isFiltered =
    searchQuery !== "" ||
    filterAccounts.length > 0 ||
    filterTypes.length > 0 ||
    filterSecurities.length > 0 ||
    filterDateFrom !== "" ||
    filterDateTo !== "";

  const activeFilterCount = [
    filterAccounts.length > 0,
    filterTypes.length > 0,
    filterSecurities.length > 0,
    filterDateFrom !== "",
    filterDateTo !== "",
  ].filter(Boolean).length;

  // Sync filter changes to URL search params so they survive router.refresh()
  const updateURL = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === "all") params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    router.replace(`${window.location.pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [router, searchParams]);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => updateURL({ q: value }), 300);
  }, [updateURL]);

  const handleFilterAccounts = useCallback((values: string[]) => {
    setFilterAccounts(values);
    updateURL({ account: values.join(",") });
  }, [updateURL]);

  const handleFilterTypes = useCallback((values: string[]) => {
    setFilterTypes(values);
    updateURL({ type: values.join(",") });
  }, [updateURL]);

  const handleFilterSecurities = useCallback((values: string[]) => {
    setFilterSecurities(values);
    updateURL({ security: values.join(",") });
  }, [updateURL]);

  const handleFilterDateFrom = useCallback((value: string) => {
    setFilterDateFrom(value);
    updateURL({ from: value });
  }, [updateURL]);

  const handleFilterDateTo = useCallback((value: string) => {
    setFilterDateTo(value);
    updateURL({ to: value });
  }, [updateURL]);

  function resetFilters() {
    setSearchQuery("");
    setFilterAccounts([]);
    setFilterTypes([]);
    setFilterSecurities([]);
    setFilterDateFrom("");
    setFilterDateTo("");
    router.replace(window.location.pathname, { scroll: false });
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

  const allFilteredSelected = filtered.length > 0 && filtered.every((txn) => selected.has(txn.id));
  const someFilteredSelected = filtered.some((txn) => selected.has(txn.id));

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((txn) => txn.id)));
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBulkDelete() {
    startBulkDelete(async () => {
      const ids = [...selected];
      const result = await deleteTransactionsAction(ids);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t("deleteSelected") + ` (${result.deletedCount})`);
        setSelected(new Set());
        router.refresh();
      }
      setBulkDeleteOpen(false);
    });
  }

  return (
    <div className="space-y-4">
      {/* Primary row: Search + Filters + Add */}
      <div className="flex items-center gap-3">
        <Input
          type="search"
          placeholder={t("searchTransactions")}
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
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
              years={transactionYears}
              filterAccounts={filterAccounts}
              setFilterAccounts={handleFilterAccounts}
              filterTypes={filterTypes}
              setFilterTypes={handleFilterTypes}
              filterSecurities={filterSecurities}
              setFilterSecurities={handleFilterSecurities}
              filterDateFrom={filterDateFrom}
              setFilterDateFrom={handleFilterDateFrom}
              filterDateTo={filterDateTo}
              setFilterDateTo={handleFilterDateTo}
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
                years={transactionYears}
                filterAccounts={filterAccounts}
                setFilterAccounts={handleFilterAccounts}
                filterTypes={filterTypes}
                setFilterTypes={handleFilterTypes}
                filterSecurities={filterSecurities}
                setFilterSecurities={handleFilterSecurities}
                filterDateFrom={filterDateFrom}
                setFilterDateFrom={handleFilterDateFrom}
                filterDateTo={filterDateTo}
                setFilterDateTo={handleFilterDateTo}
                isFiltered={isFiltered}
                resetFilters={resetFilters}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Mobile: Import + Add transaction */}
        <div className="ml-auto flex shrink-0 gap-2 sm:hidden">
          <Button asChild variant="outline" size="icon-sm">
            <Link href="/transactions/import">
              <UploadIcon className="size-4" />
            </Link>
          </Button>
          <Button onClick={() => setTxnDialogOpen(true)} size="icon-sm">
            <PlusIcon className="size-4" />
          </Button>
        </div>

        {/* Desktop: Import + Add transaction */}
        <div className="ml-auto hidden shrink-0 gap-2 sm:flex">
          <Button asChild variant="outline">
            <Link href="/transactions/import">
              <UploadIcon className="mr-1.5 size-4" />
              {tNav("import")}
            </Link>
          </Button>
          <Button onClick={() => setTxnDialogOpen(true)}>
            {t("addTransaction")}
          </Button>
        </div>
      </div>

      {/* Active filter chips */}
      {isFiltered && (
        <div className="flex flex-wrap items-center gap-2">
          {filterAccounts.map((id) => (
            <Badge key={`acc-${id}`} variant="secondary" className="gap-1 pr-1">
              {accounts.find((a) => a.id === id)?.name ?? id}
              <button type="button" onClick={() => handleFilterAccounts(filterAccounts.filter((v) => v !== id))} className="ml-0.5 rounded-sm hover:text-foreground">
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
          {filterTypes.map((type) => (
            <Badge key={`type-${type}`} variant="secondary" className="gap-1 pr-1">
              {t(`txnType${type}` as Parameters<typeof t>[0])}
              <button type="button" onClick={() => handleFilterTypes(filterTypes.filter((v) => v !== type))} className="ml-0.5 rounded-sm hover:text-foreground">
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
          {filterSecurities.map((symbol) => (
            <Badge key={`sec-${symbol}`} variant="secondary" className="gap-1 pr-1">
              {symbol}
              <button type="button" onClick={() => handleFilterSecurities(filterSecurities.filter((v) => v !== symbol))} className="ml-0.5 rounded-sm hover:text-foreground">
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
          {filterDateFrom && (
            <Badge variant="secondary" className="gap-1 pr-1">
              {t("from")}: {filterDateFrom}
              <button type="button" onClick={() => handleFilterDateFrom("")} className="ml-0.5 rounded-sm hover:text-foreground">
                <XIcon className="size-3" />
              </button>
            </Badge>
          )}
          {filterDateTo && (
            <Badge variant="secondary" className="gap-1 pr-1">
              {t("to")}: {filterDateTo}
              <button type="button" onClick={() => handleFilterDateTo("")} className="ml-0.5 rounded-sm hover:text-foreground">
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
                <TableHead className="w-10 px-2">
                  <Checkbox
                    checked={allFilteredSelected ? true : someFilteredSelected ? "indeterminate" : false}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
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
                <TableRow key={txn.id} data-selected={selected.has(txn.id) || undefined}>
                  <TableCell className="px-2">
                    <Checkbox
                      checked={selected.has(txn.id)}
                      onCheckedChange={() => toggleSelect(txn.id)}
                    />
                  </TableCell>
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
                    {(txn.taxWithheldCents > 0 || txn.feeCents > 0) && (
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

      {/* Bulk selection bar */}
      {selected.size > 0 && (
        <div className="sticky bottom-4 z-10 mx-auto flex w-fit items-center gap-3 rounded-lg border bg-background px-4 py-2 shadow-lg">
          <span className="text-sm font-medium">{t("nSelected", { count: selected.size })}</span>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            {t("deselectAll")}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setBulkDeleteOpen(true)}
            disabled={bulkDeleting}
          >
            <Trash2Icon className="mr-1.5 h-3.5 w-3.5" />
            {t("deleteSelected")}
          </Button>
        </div>
      )}

      {/* Bulk Delete Confirmation */}
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={t("deleteSelected")}
        description={t("deleteSelectedConfirm", { count: selected.size })}
        confirmLabel={tc("delete")}
        cancelLabel={tc("cancel")}
        onConfirm={handleBulkDelete}
      />

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
  filterAccounts: string[];
  setFilterAccounts: (v: string[]) => void;
  filterTypes: string[];
  setFilterTypes: (v: string[]) => void;
  filterSecurities: string[];
  setFilterSecurities: (v: string[]) => void;
  years: number[];
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
  filterAccounts,
  setFilterAccounts,
  filterTypes,
  setFilterTypes,
  filterSecurities,
  setFilterSecurities,
  years,
  filterDateFrom,
  setFilterDateFrom,
  filterDateTo,
  setFilterDateTo,
  isFiltered,
  resetFilters,
}: FilterFormProps) {
  const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name }));
  const typeOptions = TXN_TYPES.map((type) => ({
    value: type,
    label: t(`txnType${type}` as Parameters<typeof t>[0]),
  }));
  const securityOptions = uniqueSecurities.map(([symbol, name]) => ({
    value: symbol,
    label: `${symbol} — ${name}`,
  }));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t("account")}</Label>
        <MultiSelect
          options={accountOptions}
          selected={filterAccounts}
          onSelectionChange={setFilterAccounts}
          placeholder={t("allAccounts")}
        />
      </div>

      <div className="space-y-2">
        <Label>{t("type")}</Label>
        <MultiSelect
          options={typeOptions}
          selected={filterTypes}
          onSelectionChange={setFilterTypes}
          placeholder={t("allTypes")}
        />
      </div>

      <div className="space-y-2">
        <Label>{t("symbol")}</Label>
        <MultiSelect
          options={securityOptions}
          selected={filterSecurities}
          onSelectionChange={setFilterSecurities}
          placeholder={t("allSecurities")}
        />
      </div>

      <div className="space-y-2">
        <Label>{t("dateRange")}</Label>
        {years.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {years.map((year) => {
              const isActive =
                filterDateFrom === `${year}-01-01` &&
                filterDateTo === `${year}-12-31`;
              return (
                <Button
                  key={year}
                  variant={isActive ? "default" : "outline"}
                  size="xs"
                  onClick={() => {
                    if (isActive) {
                      setFilterDateFrom("");
                      setFilterDateTo("");
                    } else {
                      setFilterDateFrom(`${year}-01-01`);
                      setFilterDateTo(`${year}-12-31`);
                    }
                  }}
                >
                  {year}
                </Button>
              );
            })}
          </div>
        )}
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
