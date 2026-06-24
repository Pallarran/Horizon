"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { SlidersHorizontalIcon, XIcon, LayersIcon, CheckIcon } from "lucide-react";
import type { SerializedPosition } from "@/lib/positions/serialize";
import type { SecurityProfileMap } from "@/lib/positions/security-profile";
import type { SerializedCrcdHolding } from "@/lib/actions/crcd-holdings";
import {
  addToWatchlistAction,
  removeFromWatchlistAction,
} from "@/lib/actions/watchlist";
import { HoldingsTable } from "./HoldingsTable";
import { HoldingsSummaryBand } from "./HoldingsSummaryBand";
import { PositionDetailSheet } from "./PositionDetailSheet";
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

interface Account {
  id: string;
  name: string;
  currency: string;
}

/** Per-account accent palette (mirrors the Accounts tab + dashboard allocation). */
const ACCOUNT_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-4)",
  "var(--chart-3)",
  "var(--chart-5)",
  "var(--muted-foreground)",
];

interface Props {
  positions: SerializedPosition[];
  accounts: Account[];
  securityProfiles: SecurityProfileMap;
  locale: string;
  usdCadRate: number;
  watchedSecurityIds?: string[];
  crcdHoldings?: SerializedCrcdHolding[];
}

export function HoldingsPageClient({ positions, accounts, securityProfiles, locale, usdCadRate, watchedSecurityIds: watchedIds, crcdHoldings }: Props) {
  const t = useTranslations("holdings");
  const router = useRouter();
  const searchParams = useSearchParams();

  // Position detail sheet state
  const [selectedPosition, setSelectedPosition] = useState<SerializedPosition | null>(null);

  // Add-transaction dialog state (triggered from sheet)
  const [txnDialogOpen, setTxnDialogOpen] = useState(false);
  const [txnDefaults, setTxnDefaults] = useState<{ accountId: string; securityId: string; symbol: string; name: string } | null>(null);

  // Watchlist state
  const [watchedSet, setWatchedSet] = useState(() => new Set(watchedIds ?? []));

  const handleToggleWatch = useCallback(async (securityId: string, isWatched: boolean) => {
    if (isWatched) {
      // Find the watchlist item ID — we need to remove by ID, so do a quick removal
      // For simplicity, use the action that finds and removes
      const items = await import("@/lib/actions/watchlist").then(m => m.getWatchlistAction());
      const item = items.find(i => i.securityId === securityId);
      if (item) {
        await removeFromWatchlistAction(item.id);
        setWatchedSet(prev => { const next = new Set(prev); next.delete(securityId); return next; });
      }
    } else {
      const fd = new FormData();
      fd.set("securityId", securityId);
      await addToWatchlistAction({}, fd);
      setWatchedSet(prev => new Set(prev).add(securityId));
    }
    router.refresh();
  }, [router]);

  const handleAddTransaction = useCallback((accountId: string, securityId: string, symbol: string, name: string) => {
    setTxnDefaults({ accountId, securityId, symbol, name });
    setTxnDialogOpen(true);
  }, []);

  const handleTxnSuccess = useCallback(() => {
    setTxnDialogOpen(false);
    setTxnDefaults(null);
    toast.success(t("transactionAdded"));
    router.refresh();
  }, [t, router]);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterAccount, setFilterAccount] = useState(() => searchParams.get("account") ?? "all");
  const [filterAssetClass, setFilterAssetClass] = useState("all");
  const [filterCurrency, setFilterCurrency] = useState("all");
  const [filterIndustry, setFilterIndustry] = useState("all");
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);
  const [groupByOpen, setGroupByOpen] = useState(false);

  // Grouping
  type GroupByMode = "none" | "account" | "sector" | "assetClass";
  const [groupBy, setGroupBy] = useState<GroupByMode>(() => {
    if (typeof window === "undefined") return "none";
    return (localStorage.getItem("horizon-holdings-groupBy") as GroupByMode) ?? "none";
  });
  const handleGroupByChange = useCallback((value: string) => {
    const v = value as GroupByMode;
    setGroupBy(v);
    localStorage.setItem("horizon-holdings-groupBy", v);
  }, []);

  // Build unique filter options from positions
  const assetClasses = useMemo(() => {
    const set = new Set<string>();
    for (const p of positions) set.add(p.assetClass);
    return [...set].sort();
  }, [positions]);

  const currencies = useMemo(() => {
    const set = new Set<string>();
    for (const p of positions) set.add(p.currency);
    return [...set].sort();
  }, [positions]);

  const industries = useMemo(() => {
    const set = new Set<string>();
    for (const p of positions) {
      if (p.industry) set.add(p.industry);
    }
    return [...set].sort();
  }, [positions]);

  // Apply filters
  const filtered = useMemo(() => {
    let result = positions;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) => p.symbol.toLowerCase().includes(q) || p.name.toLowerCase().includes(q),
      );
    }
    if (filterAccount !== "all")
      result = result.filter((p) => p.accountId === filterAccount);
    if (filterAssetClass !== "all")
      result = result.filter((p) => p.assetClass === filterAssetClass);
    if (filterCurrency !== "all")
      result = result.filter((p) => p.currency === filterCurrency);
    if (filterIndustry !== "all")
      result = result.filter((p) => p.industry === filterIndustry);
    return result;
  }, [positions, searchQuery, filterAccount, filterAssetClass, filterCurrency, filterIndustry]);

  // Compute summary metrics from filtered positions (converting USD → CAD)
  const metrics = useMemo(() => {
    const toCad = (cents: number, currency: string) =>
      currency === "USD" ? Math.round(cents * usdCadRate) : cents;

    // Per-currency breakdown (native amounts + gain)
    const byCurrency: Record<string, {
      marketValueCents: number;
      totalCostCents: number;
      gainCents: number;
      gainPercent: number | null;
    }> = {};
    for (const p of filtered) {
      const entry = byCurrency[p.currency] ??= { marketValueCents: 0, totalCostCents: 0, gainCents: 0, gainPercent: null };
      entry.marketValueCents += p.marketValueCents ?? p.totalCostCents;
      entry.totalCostCents += p.totalCostCents;
    }
    for (const entry of Object.values(byCurrency)) {
      entry.gainCents = entry.marketValueCents - entry.totalCostCents;
      entry.gainPercent = entry.totalCostCents > 0 ? entry.gainCents / entry.totalCostCents : null;
    }

    // Combined totals in CAD (cost uses historical FX rates via totalCostCadCents)
    const totalCost = filtered.reduce(
      (s, p) => s + p.totalCostCadCents, 0,
    );
    const marketValue = filtered.reduce(
      (s, p) => s + (p.marketValueCents != null
        ? toCad(p.marketValueCents, p.currency)
        : p.totalCostCadCents), 0,
    );
    const gain = marketValue - totalCost;
    const gainPercent = totalCost > 0 ? gain / totalCost : null;
    const income = filtered.reduce(
      (s, p) => s + toCad(p.expectedIncomeCents ?? 0, p.currency), 0,
    );
    const yieldPercent = marketValue > 0 ? income / marketValue : null;
    const monthlyIncome = Math.round(income / 12);

    const hasUsd = "USD" in byCurrency;

    // By-account allocation (CAD market value) for the summary band
    const byAccountMap = new Map<string, number>();
    for (const p of filtered) {
      const cad = p.marketValueCents != null ? toCad(p.marketValueCents, p.currency) : p.totalCostCadCents;
      byAccountMap.set(p.accountName, (byAccountMap.get(p.accountName) ?? 0) + cad);
    }
    const byAccount = [...byAccountMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, cents], i) => ({
        name,
        cents,
        percent: marketValue > 0 ? cents / marketValue : 0,
        color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length],
      }));

    return { count: filtered.length, totalCost, marketValue, gain, gainPercent, income, monthlyIncome, yieldPercent, byCurrency, hasUsd, byAccount };
  }, [filtered, usdCadRate]);

  const isFiltered =
    searchQuery !== "" ||
    filterAccount !== "all" ||
    filterAssetClass !== "all" ||
    filterCurrency !== "all" ||
    filterIndustry !== "all";

  const activeFilterCount = [
    filterAccount !== "all",
    filterAssetClass !== "all",
    filterCurrency !== "all",
    filterIndustry !== "all",
  ].filter(Boolean).length;

  function resetFilters() {
    setSearchQuery("");
    setFilterAccount("all");
    setFilterAssetClass("all");
    setFilterCurrency("all");
    setFilterIndustry("all");
  }

  return (
    <div className="space-y-4">
      {/* Summary band */}
      <HoldingsSummaryBand
        locale={locale}
        usdCadRate={usdCadRate}
        metrics={metrics}
        byAccount={metrics.byAccount}
      />

      {/* Primary row: Search + Filters */}
      <div className="flex items-center gap-3">
        <Input
          type="search"
          placeholder={t("searchHoldings")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="min-w-0 flex-1 sm:max-w-[260px]"
        />

        {/* Group by popover */}
        <Popover open={groupByOpen} onOpenChange={setGroupByOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="hidden shrink-0 sm:inline-flex">
              <LayersIcon className="size-4" />
              {groupBy !== "none"
                ? t(`groupBy${groupBy.charAt(0).toUpperCase()}${groupBy.slice(1)}` as Parameters<typeof t>[0])
                : t("groupBy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-44 p-1">
            {(["none", "account", "sector", "assetClass"] as const).map((value) => {
              const label = value === "none"
                ? t("groupByNone")
                : t(`groupBy${value.charAt(0).toUpperCase()}${value.slice(1)}` as Parameters<typeof t>[0]);
              const active = groupBy === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => { handleGroupByChange(value); setGroupByOpen(false); }}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent ${active ? "font-medium" : ""}`}
                >
                  <CheckIcon className={`size-3.5 shrink-0 ${active ? "opacity-100" : "opacity-0"}`} />
                  {label}
                </button>
              );
            })}
          </PopoverContent>
        </Popover>

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
            <HoldingsFilterForm
              t={t}
              accounts={accounts}
              assetClasses={assetClasses}
              currencies={currencies}
              industries={industries}
              filterAccount={filterAccount}
              setFilterAccount={setFilterAccount}
              filterAssetClass={filterAssetClass}
              setFilterAssetClass={setFilterAssetClass}
              filterCurrency={filterCurrency}
              setFilterCurrency={setFilterCurrency}
              filterIndustry={filterIndustry}
              setFilterIndustry={setFilterIndustry}
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
              <HoldingsFilterForm
                t={t}
                accounts={accounts}
                assetClasses={assetClasses}
                currencies={currencies}
                industries={industries}
                filterAccount={filterAccount}
                setFilterAccount={setFilterAccount}
                filterAssetClass={filterAssetClass}
                setFilterAssetClass={setFilterAssetClass}
                filterCurrency={filterCurrency}
                setFilterCurrency={setFilterCurrency}
                filterIndustry={filterIndustry}
                setFilterIndustry={setFilterIndustry}
                isFiltered={isFiltered}
                resetFilters={resetFilters}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {filterAccount !== "all" && (
            <Badge variant="secondary" className="gap-1 pr-1">
              {accounts.find((a) => a.id === filterAccount)?.name}
              <button type="button" onClick={() => setFilterAccount("all")} className="ml-0.5 rounded-sm hover:text-foreground">
                <XIcon className="size-3" />
              </button>
            </Badge>
          )}
          {filterAssetClass !== "all" && (
            <Badge variant="secondary" className="gap-1 pr-1">
              {t(`assetClass${filterAssetClass}` as Parameters<typeof t>[0])}
              <button type="button" onClick={() => setFilterAssetClass("all")} className="ml-0.5 rounded-sm hover:text-foreground">
                <XIcon className="size-3" />
              </button>
            </Badge>
          )}
          {filterCurrency !== "all" && (
            <Badge variant="secondary" className="gap-1 pr-1">
              {filterCurrency}
              <button type="button" onClick={() => setFilterCurrency("all")} className="ml-0.5 rounded-sm hover:text-foreground">
                <XIcon className="size-3" />
              </button>
            </Badge>
          )}
          {filterIndustry !== "all" && (
            <Badge variant="secondary" className="gap-1 pr-1">
              {filterIndustry}
              <button type="button" onClick={() => setFilterIndustry("all")} className="ml-0.5 rounded-sm hover:text-foreground">
                <XIcon className="size-3" />
              </button>
            </Badge>
          )}
          <Button variant="ghost" size="xs" onClick={resetFilters}>
            {t("clearAll")}
          </Button>
        </div>
      )}

      {/* Holdings table */}
      <HoldingsTable
        positions={filtered}
        locale={locale}
        totalMarketValueCents={metrics.marketValue}
        onSelectPosition={setSelectedPosition}
        groupBy={groupBy !== "none" ? groupBy : undefined}
      />

      {/* Position detail sheet */}
      <PositionDetailSheet
        position={selectedPosition}
        profile={selectedPosition ? securityProfiles[selectedPosition.securityId] : undefined}
        open={selectedPosition !== null}
        onOpenChange={(open) => { if (!open) setSelectedPosition(null); }}
        locale={locale}
        onAddTransaction={handleAddTransaction}
        watchedSecurityIds={watchedSet}
        onToggleWatch={handleToggleWatch}
        crcdHoldings={crcdHoldings}
      />

      {/* Add transaction dialog (triggered from sheet) */}
      <Dialog open={txnDialogOpen} onOpenChange={setTxnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addTransaction")}</DialogTitle>
          </DialogHeader>
          <TransactionForm
            accounts={accounts}
            onSuccess={handleTxnSuccess}
            onCancel={() => setTxnDialogOpen(false)}
            defaultAccountId={txnDefaults?.accountId}
            defaultSecurityId={txnDefaults?.securityId}
            defaultSecuritySymbol={txnDefaults?.symbol}
            defaultSecurityName={txnDefaults?.name}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}


function HoldingsFilterForm({
  t,
  accounts,
  assetClasses,
  currencies,
  industries,
  filterAccount,
  setFilterAccount,
  filterAssetClass,
  setFilterAssetClass,
  filterCurrency,
  setFilterCurrency,
  filterIndustry,
  setFilterIndustry,
  isFiltered,
  resetFilters,
}: {
  t: ReturnType<typeof useTranslations<"holdings">>;
  accounts: Account[];
  assetClasses: string[];
  currencies: string[];
  industries: string[];
  filterAccount: string;
  setFilterAccount: (v: string) => void;
  filterAssetClass: string;
  setFilterAssetClass: (v: string) => void;
  filterCurrency: string;
  setFilterCurrency: (v: string) => void;
  filterIndustry: string;
  setFilterIndustry: (v: string) => void;
  isFiltered: boolean;
  resetFilters: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-1.5 text-xs">{t("account")}</Label>
        <Select value={filterAccount} onValueChange={setFilterAccount}>
          <SelectTrigger className="w-full">
            <SelectValue />
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
      </div>

      <div>
        <Label className="mb-1.5 text-xs">{t("assetClass")}</Label>
        <Select value={filterAssetClass} onValueChange={setFilterAssetClass}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allAssetClasses")}</SelectItem>
            {assetClasses.map((ac) => (
              <SelectItem key={ac} value={ac}>
                {t(`assetClass${ac}` as Parameters<typeof t>[0])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="mb-1.5 text-xs">{t("currency")}</Label>
        <Select value={filterCurrency} onValueChange={setFilterCurrency}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allCurrencies")}</SelectItem>
            {currencies.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="mb-1.5 text-xs">{t("industry")}</Label>
        <Select value={filterIndustry} onValueChange={setFilterIndustry}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allIndustries")}</SelectItem>
            {industries.map((ind) => (
              <SelectItem key={ind} value={ind}>
                {ind}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isFiltered && (
        <Button variant="ghost" size="sm" className="w-full" onClick={resetFilters}>
          {t("clearAll")}
        </Button>
      )}
    </div>
  );
}
