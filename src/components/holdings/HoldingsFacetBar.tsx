"use client";

import { useTranslations } from "next-intl";
import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
 * Horizontal facet bar above the table — search, group-by, and all filters
 * always visible as pills, without stealing width from the table.
 */
export function HoldingsFacetBar({
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

  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {/* Search */}
        <div className="relative min-w-[180px] flex-1 sm:max-w-[240px]">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t("searchHoldings")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-8 text-sm"
          />
        </div>

        {/* Group by */}
        <FacetGroup label={t("groupBy")}>
          {groupOptions.map((opt) => (
            <Pill key={opt.value} active={groupBy === opt.value} onClick={() => onGroupByChange(opt.value)}>
              {opt.label}
            </Pill>
          ))}
        </FacetGroup>

        {/* Account */}
        <FacetGroup label={t("account")}>
          <Pill active={filterAccount === "all"} onClick={() => setFilterAccount("all")}>
            {t("all")}
          </Pill>
          {accounts.map((a) => (
            <Pill key={a.id} active={filterAccount === a.id} onClick={() => setFilterAccount(a.id)}>
              {a.name}
            </Pill>
          ))}
        </FacetGroup>

        {/* Currency */}
        {currencies.length > 1 && (
          <FacetGroup label={t("currency")}>
            <Pill active={filterCurrency === "all"} onClick={() => setFilterCurrency("all")}>
              {t("all")}
            </Pill>
            {currencies.map((c) => (
              <Pill key={c} active={filterCurrency === c} onClick={() => setFilterCurrency(c)}>
                {c}
              </Pill>
            ))}
          </FacetGroup>
        )}

        {/* Asset class */}
        {assetClasses.length > 0 && (
          <FacetGroup label={t("assetClass")}>
            <Pill active={filterAssetClass === "all"} onClick={() => setFilterAssetClass("all")}>
              {t("all")}
            </Pill>
            {assetClasses.map((ac) => (
              <Pill key={ac} active={filterAssetClass === ac} onClick={() => setFilterAssetClass(ac)}>
                {t(`assetClass${ac}` as Parameters<typeof t>[0])}
              </Pill>
            ))}
          </FacetGroup>
        )}

        {/* Industry / Sector */}
        {industries.length > 0 && (
          <FacetGroup label={t("industry")}>
            <Pill active={filterIndustry === "all"} onClick={() => setFilterIndustry("all")}>
              {t("all")}
            </Pill>
            {industries.map((ind) => (
              <Pill key={ind} active={filterIndustry === ind} onClick={() => setFilterIndustry(ind)}>
                {ind}
              </Pill>
            ))}
          </FacetGroup>
        )}

        {isFiltered && (
          <Button variant="ghost" size="sm" className="ml-auto shrink-0" onClick={resetFilters}>
            {t("clearAll")}
          </Button>
        )}
      </div>
    </div>
  );
}

function FacetGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
        active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/70 hover:bg-muted/70"
      }`}
    >
      {children}
    </button>
  );
}
