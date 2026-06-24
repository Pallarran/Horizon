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
  className?: string;
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
 * Persistent left facet rail — group-by and all filters always visible instead
 * of hidden behind popovers. Single-select semantics, presented as lists/pills.
 */
export function HoldingsFacetRail({
  className,
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
    <aside className={`rounded-xl border bg-card p-4 ${className ?? ""}`}>
      {/* Search */}
      <div className="relative mb-4">
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
      <FacetTitle>{t("groupBy")}</FacetTitle>
      <div className="mb-5 flex flex-wrap gap-1.5">
        {groupOptions.map((opt) => (
          <Chip key={opt.value} active={groupBy === opt.value} onClick={() => onGroupByChange(opt.value)}>
            {opt.label}
          </Chip>
        ))}
      </div>

      {/* Account */}
      <FacetTitle>{t("account")}</FacetTitle>
      <div className="mb-5 flex flex-col gap-0.5">
        <ListItem active={filterAccount === "all"} onClick={() => setFilterAccount("all")}>
          {t("allAccounts")}
        </ListItem>
        {accounts.map((a) => (
          <ListItem key={a.id} active={filterAccount === a.id} onClick={() => setFilterAccount(a.id)}>
            {a.name}
          </ListItem>
        ))}
      </div>

      {/* Currency */}
      {currencies.length > 1 && (
        <>
          <FacetTitle>{t("currency")}</FacetTitle>
          <div className="mb-5 flex gap-1.5">
            <Pill active={filterCurrency === "all"} onClick={() => setFilterCurrency("all")}>
              {t("all")}
            </Pill>
            {currencies.map((c) => (
              <Pill key={c} active={filterCurrency === c} onClick={() => setFilterCurrency(c)}>
                {c}
              </Pill>
            ))}
          </div>
        </>
      )}

      {/* Asset class */}
      {assetClasses.length > 0 && (
        <>
          <FacetTitle>{t("assetClass")}</FacetTitle>
          <div className="mb-5 flex flex-col gap-0.5">
            <ListItem active={filterAssetClass === "all"} onClick={() => setFilterAssetClass("all")}>
              {t("allAssetClasses")}
            </ListItem>
            {assetClasses.map((ac) => (
              <ListItem
                key={ac}
                active={filterAssetClass === ac}
                onClick={() => setFilterAssetClass(ac)}
              >
                {t(`assetClass${ac}` as Parameters<typeof t>[0])}
              </ListItem>
            ))}
          </div>
        </>
      )}

      {/* Industry / Sector */}
      {industries.length > 0 && (
        <>
          <FacetTitle>{t("industry")}</FacetTitle>
          <div className="mb-2 flex flex-col gap-0.5">
            <ListItem active={filterIndustry === "all"} onClick={() => setFilterIndustry("all")}>
              {t("allIndustries")}
            </ListItem>
            {industries.map((ind) => (
              <ListItem key={ind} active={filterIndustry === ind} onClick={() => setFilterIndustry(ind)}>
                {ind}
              </ListItem>
            ))}
          </div>
        </>
      )}

      {isFiltered && (
        <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={resetFilters}>
          {t("clearAll")}
        </Button>
      )}
    </aside>
  );
}

function FacetTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

function Chip({
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
      className={`rounded-md border px-3 py-1 text-xs transition-colors ${
        active ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function ListItem({
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
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-muted ${
        active ? "font-semibold text-foreground" : "text-foreground/70"
      }`}
    >
      <span
        className={`size-1.5 shrink-0 rounded-full ${active ? "bg-primary" : "bg-transparent"}`}
      />
      <span className="truncate">{children}</span>
    </button>
  );
}
