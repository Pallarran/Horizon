"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { SlidersHorizontalIcon, XIcon } from "lucide-react";
import type { SerializedPosition } from "@/lib/positions/serialize";
import type { SecurityProfileMap } from "@/lib/positions/security-profile";
import { formatMoney, formatPercent } from "@/lib/money/format";
import { HoldingsTable } from "./HoldingsTable";
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

interface Props {
  positions: SerializedPosition[];
  accounts: Account[];
  securityProfiles: SecurityProfileMap;
  locale: string;
}

export function HoldingsPageClient({ positions, accounts, securityProfiles, locale }: Props) {
  const t = useTranslations("holdings");
  const router = useRouter();
  const searchParams = useSearchParams();

  // Position detail sheet state
  const [selectedPosition, setSelectedPosition] = useState<SerializedPosition | null>(null);

  // Add-transaction dialog state (triggered from sheet)
  const [txnDialogOpen, setTxnDialogOpen] = useState(false);
  const [txnDefaults, setTxnDefaults] = useState<{ accountId: string; securityId: string; symbol: string; name: string } | null>(null);

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

  // Compute summary metrics from filtered positions
  const metrics = useMemo(() => {
    const totalCost = filtered.reduce((s, p) => s + p.totalCostCents, 0);
    const marketValue = filtered.reduce(
      (s, p) => s + (p.marketValueCents ?? p.totalCostCents),
      0
    );
    const gain = marketValue - totalCost;
    const gainPercent = totalCost > 0 ? gain / totalCost : null;
    const income = filtered.reduce(
      (s, p) => s + (p.expectedIncomeCents ?? 0),
      0
    );
    const yieldPercent = marketValue > 0 ? income / marketValue : null;

    return { count: filtered.length, totalCost, marketValue, gain, gainPercent, income, yieldPercent };
  }, [filtered]);

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
      {/* Primary row: Search + Filters */}
      <div className="flex items-center gap-3">
        <Input
          type="search"
          placeholder={t("searchHoldings")}
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

      {/* Summary metrics strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard
          label={t("positions")}
          value={String(metrics.count)}
          sub={isFiltered ? `/ ${positions.length}` : undefined}
        />
        <MetricCard
          label={t("totalCost")}
          value={formatMoney(metrics.totalCost, locale)}
        />
        <MetricCard
          label={t("marketValue")}
          value={formatMoney(metrics.marketValue, locale)}
          highlight
        />
        <MetricCard
          label={t("unrealizedGain")}
          value={`${metrics.gain >= 0 ? "+" : ""}${formatMoney(metrics.gain, locale)}`}
          sub={metrics.gainPercent !== null ? `${metrics.gainPercent >= 0 ? "+" : ""}${formatPercent(metrics.gainPercent, locale)}` : undefined}
          color={metrics.gain >= 0 ? "gain" : "loss"}
        />
        <MetricCard
          label={t("annualIncome")}
          value={formatMoney(metrics.income, locale)}
          sub={metrics.yieldPercent !== null ? formatPercent(metrics.yieldPercent, locale) : undefined}
        />
      </div>

      {/* Holdings table */}
      <HoldingsTable
        positions={filtered}
        locale={locale}
        onSelectPosition={setSelectedPosition}
      />

      {/* Position detail sheet */}
      <PositionDetailSheet
        position={selectedPosition}
        profile={selectedPosition ? securityProfiles[selectedPosition.securityId] : undefined}
        open={selectedPosition !== null}
        onOpenChange={(open) => { if (!open) setSelectedPosition(null); }}
        locale={locale}
        onAddTransaction={handleAddTransaction}
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

function MetricCard({
  label,
  value,
  sub,
  color,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: "gain" | "loss";
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-5 py-4 text-center ${
        highlight
          ? "border-primary/30 bg-primary/5"
          : "bg-card"
      }`}
    >
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-semibold tabular-nums ${
          color === "gain"
            ? "text-gain"
            : color === "loss"
              ? "text-loss"
              : highlight
                ? "text-primary"
                : ""
        }`}
      >
        {value}
      </p>
      {sub && (
        <p
          className={`mt-0.5 text-xs tabular-nums ${
            color === "gain"
              ? "text-gain"
              : color === "loss"
                ? "text-loss"
                : "text-muted-foreground"
          }`}
        >
          {sub}
        </p>
      )}
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
