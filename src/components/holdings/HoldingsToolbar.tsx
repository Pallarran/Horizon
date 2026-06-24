"use client";

import { useTranslations } from "next-intl";
import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

interface Account {
  id: string;
  name: string;
  currency: string;
}

type GroupByMode = "none" | "account" | "sector" | "assetClass";

interface Props {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  groupBy: GroupByMode;
  onGroupByChange: (v: GroupByMode) => void;
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
}

/**
 * Holdings toolbar — search, a visible group-by segmented control, and the
 * filters exposed as individual dropdowns on a single horizontal row.
 */
export function HoldingsToolbar({
  searchQuery,
  setSearchQuery,
  groupBy,
  onGroupByChange,
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
}: Props) {
  const t = useTranslations("holdings");

  const groupOptions: { value: GroupByMode; label: string }[] = [
    { value: "account", label: t("groupByAccount") },
    { value: "sector", label: t("groupBySector") },
    { value: "assetClass", label: t("groupByAssetClass") },
    { value: "none", label: t("groupByNone") },
  ];

  const selectedAccountName = accounts.find((a) => a.id === filterAccount)?.name;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {/* Search */}
      <div className="relative min-w-[200px] flex-1 sm:max-w-[300px]">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder={t("searchHoldings")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-9 pl-8 text-sm"
        />
      </div>

      {/* Group-by segmented control */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{t("groupBy")}</span>
        <div className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5">
          {groupOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onGroupByChange(opt.value)}
              className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                groupBy === opt.value
                  ? "bg-card font-semibold shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filter dropdowns */}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <FilterSelect
          label={t("account")}
          value={filterAccount}
          display={filterAccount === "all" ? undefined : selectedAccountName}
          onChange={setFilterAccount}
          options={[
            { value: "all", label: t("allAccounts") },
            ...accounts.map((a) => ({ value: a.id, label: a.name })),
          ]}
        />
        {assetClasses.length > 0 && (
          <FilterSelect
            label={t("assetClass")}
            value={filterAssetClass}
            display={
              filterAssetClass === "all"
                ? undefined
                : t(`assetClass${filterAssetClass}` as Parameters<typeof t>[0])
            }
            onChange={setFilterAssetClass}
            options={[
              { value: "all", label: t("allAssetClasses") },
              ...assetClasses.map((ac) => ({
                value: ac,
                label: t(`assetClass${ac}` as Parameters<typeof t>[0]),
              })),
            ]}
          />
        )}
        {currencies.length > 1 && (
          <FilterSelect
            label={t("currency")}
            value={filterCurrency}
            display={filterCurrency === "all" ? undefined : filterCurrency}
            onChange={setFilterCurrency}
            options={[
              { value: "all", label: t("allCurrencies") },
              ...currencies.map((c) => ({ value: c, label: c })),
            ]}
          />
        )}
        {industries.length > 0 && (
          <FilterSelect
            label={t("industry")}
            value={filterIndustry}
            display={filterIndustry === "all" ? undefined : filterIndustry}
            onChange={setFilterIndustry}
            options={[
              { value: "all", label: t("allIndustries") },
              ...industries.map((ind) => ({ value: ind, label: ind })),
            ]}
          />
        )}
        {isFiltered && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            {t("clearAll")}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * A single filter dropdown whose trigger shows the facet name until a value is
 * picked, then shows the chosen value (and highlights as active).
 */
function FilterSelect({
  label,
  value,
  display,
  onChange,
  options,
}: {
  label: string;
  value: string;
  display?: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const active = value !== "all";
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        size="sm"
        className={active ? "border-primary text-primary" : "text-foreground"}
      >
        <span className="text-xs">{active ? display ?? label : label}</span>
      </SelectTrigger>
      <SelectContent align="end">
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
