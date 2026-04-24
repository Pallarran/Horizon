"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { ChevronRightIcon } from "lucide-react";
import { formatMoney, formatPercent, formatNumber } from "@/lib/money/format";
import type { SerializedPosition } from "@/lib/positions/serialize";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type SortKey = keyof SerializedPosition;
type SortDir = "asc" | "desc";
type GroupByKey = "account" | "sector" | "assetClass";

interface Props {
  positions: SerializedPosition[];
  locale: string;
  totalMarketValueCents: number;
  onSelectPosition?: (position: SerializedPosition) => void;
  groupBy?: GroupByKey;
}

const COL_COUNT = 11;

interface GroupData {
  key: string;
  label: string;
  positions: SerializedPosition[];
  marketValueCents: number;
  totalCostCents: number;
  unrealizedGainCents: number;
  expectedIncomeCents: number;
}

function sortPositions(positions: SerializedPosition[], sortKey: SortKey, sortDir: SortDir) {
  return [...positions].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    if (typeof av === "number" && typeof bv === "number") {
      return sortDir === "asc" ? av - bv : bv - av;
    }
    return sortDir === "asc"
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av));
  });
}

export function HoldingsTable({ positions, locale, totalMarketValueCents, onSelectPosition, groupBy }: Props) {
  const t = useTranslations("holdings");
  const [sortKey, setSortKey] = useState<SortKey>("marketValueCents");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const sorted = useMemo(
    () => sortPositions(positions, sortKey, sortDir),
    [positions, sortKey, sortDir],
  );

  const groups = useMemo<GroupData[] | null>(() => {
    if (!groupBy) return null;

    const map = new Map<string, SerializedPosition[]>();
    for (const p of positions) {
      let key: string;
      if (groupBy === "account") key = p.accountName;
      else if (groupBy === "sector") key = p.sector ?? "—";
      else key = p.assetClass;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }

    const result: GroupData[] = [];
    for (const [key, items] of map) {
      let mv = 0, cost = 0, gain = 0, income = 0;
      for (const p of items) {
        mv += p.marketValueCents ?? p.totalCostCents;
        cost += p.totalCostCents;
        gain += p.unrealizedGainCents ?? 0;
        income += p.expectedIncomeCents ?? 0;
      }

      let label = key;
      if (groupBy === "assetClass") {
        const tKey = `assetClass${key}` as Parameters<typeof t>[0];
        label = t(tKey);
      }

      result.push({
        key,
        label,
        positions: sortPositions(items, sortKey, sortDir),
        marketValueCents: mv,
        totalCostCents: cost,
        unrealizedGainCents: gain,
        expectedIncomeCents: income,
      });
    }

    // Sort groups by market value descending
    result.sort((a, b) => b.marketValueCents - a.marketValueCents);
    return result;
  }, [positions, groupBy, sortKey, sortDir, t]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function SortableHead({ k, children, right, className: extraClass }: { k: SortKey; children: React.ReactNode; right?: boolean; className?: string }) {
    const active = sortKey === k;
    return (
      <TableHead
        className={`cursor-pointer select-none whitespace-nowrap ${right ? "text-right" : ""} ${extraClass ?? ""}`}
        onClick={() => toggleSort(k)}
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      >
        {children}
        {active && <span className="ml-1" aria-hidden="true">{sortDir === "asc" ? "↑" : "↓"}</span>}
      </TableHead>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p className="text-lg">{t("noPositions")}</p>
      </div>
    );
  }

  function renderPositionRow(h: SerializedPosition) {
    return (
      <TableRow
        key={`${h.securityId}-${h.accountId}`}
        className={onSelectPosition ? "cursor-pointer" : ""}
        onClick={() => onSelectPosition?.(h)}
      >
        <TableCell>
          <div className="flex items-center gap-2">
            <span className="font-medium">{h.symbol}</span>
            <Badge variant="outline" className="text-[10px]">
              {h.currency}
            </Badge>
            {h.dividendGrowthYears != null && h.dividendGrowthYears > 0 && (
              <span className="text-[10px] font-medium text-gain">
                ↗ {t("divGrowthYears", { count: h.dividendGrowthYears })}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{h.name}</p>
        </TableCell>
        <TableCell className="hidden lg:table-cell">
          <Badge variant="secondary" className="text-[10px]">
            {h.accountType}
          </Badge>
        </TableCell>
        <TableCell className="hidden text-right font-mono md:table-cell">
          {formatNumber(h.quantity, locale, 0)}
        </TableCell>
        <TableCell className="hidden text-right font-mono lg:table-cell">
          {formatMoney(h.avgCostCents, locale)}
        </TableCell>
        <TableCell className="hidden text-right font-mono md:table-cell">
          {h.currentPriceCents !== null ? formatMoney(h.currentPriceCents, locale) : "—"}
        </TableCell>
        <TableCell className="text-right font-mono font-medium">
          {h.marketValueCents !== null ? formatMoney(h.marketValueCents, locale) : formatMoney(h.totalCostCents, locale)}
        </TableCell>
        <TableCell className="hidden text-right font-mono text-sm lg:table-cell">
          {(() => {
            const mv = h.marketValueCents ?? h.totalCostCents;
            const weight = totalMarketValueCents > 0 ? mv / totalMarketValueCents : 0;
            return (
              <span className={weight > 0.1 ? "text-warning" : ""}>
                {formatPercent(weight, locale, 1)}
              </span>
            );
          })()}
        </TableCell>
        <TableCell className="hidden text-right lg:table-cell">
          {h.dayChangePercent !== null ? (
            <span className={`font-mono text-sm ${h.dayChangePercent >= 0 ? "text-gain" : "text-loss"}`}>
              {h.dayChangePercent >= 0 ? "+" : ""}
              {formatPercent(h.dayChangePercent, locale)}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="text-right">
          {h.unrealizedGainCents !== null ? (
            <>
              <span className={`font-mono text-sm ${h.unrealizedGainCents >= 0 ? "text-gain" : "text-loss"}`}>
                {h.unrealizedGainCents >= 0 ? "+" : ""}
                {formatMoney(h.unrealizedGainCents, locale)}
              </span>
              {h.unrealizedGainPercent !== null && (
                <p className="text-[10px] text-muted-foreground">
                  {h.unrealizedGainPercent >= 0 ? "+" : ""}
                  {formatPercent(h.unrealizedGainPercent, locale)}
                </p>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="hidden text-right font-mono md:table-cell">
          {h.expectedIncomeCents !== null ? formatMoney(h.expectedIncomeCents, locale) : "—"}
        </TableCell>
        <TableCell className="hidden text-right font-mono text-sm lg:table-cell">
          {h.yieldPercent !== null ? (
            <>
              {formatPercent(h.yieldPercent, locale)}
              {h.yieldOnCostPercent !== null && (
                <p className="text-[10px] text-muted-foreground">
                  YOC: {formatPercent(h.yieldOnCostPercent, locale)}
                </p>
              )}
            </>
          ) : (
            "—"
          )}
        </TableCell>
      </TableRow>
    );
  }

  function renderGroupHeader(group: GroupData) {
    const isCollapsed = collapsed.has(group.key);
    const weight = totalMarketValueCents > 0
      ? group.marketValueCents / totalMarketValueCents
      : 0;

    return (
      <TableRow
        key={`group-${group.key}`}
        className="cursor-pointer bg-muted/40 hover:bg-muted/60"
        onClick={() => toggleGroup(group.key)}
      >
        <TableCell colSpan={5}>
          <div className="flex items-center gap-2">
            <ChevronRightIcon
              className={`size-4 shrink-0 text-muted-foreground transition-transform ${isCollapsed ? "" : "rotate-90"}`}
            />
            <span className="font-semibold">{group.label}</span>
            <Badge variant="secondary" className="text-[10px]">
              {t("positionCount", { count: group.positions.length })}
            </Badge>
          </div>
        </TableCell>
        <TableCell className="text-right font-mono font-semibold">
          {formatMoney(group.marketValueCents, locale)}
        </TableCell>
        <TableCell className="hidden text-right font-mono text-sm lg:table-cell">
          <span className={weight > 0.1 ? "text-warning font-medium" : ""}>
            {formatPercent(weight, locale, 1)}
          </span>
        </TableCell>
        <TableCell className="hidden lg:table-cell" />
        <TableCell className="text-right">
          {group.unrealizedGainCents !== 0 && (
            <span className={`font-mono text-sm font-medium ${group.unrealizedGainCents >= 0 ? "text-gain" : "text-loss"}`}>
              {group.unrealizedGainCents >= 0 ? "+" : ""}
              {formatMoney(group.unrealizedGainCents, locale)}
            </span>
          )}
        </TableCell>
        <TableCell className="hidden text-right font-mono md:table-cell">
          {group.expectedIncomeCents > 0
            ? formatMoney(group.expectedIncomeCents, locale)
            : ""}
        </TableCell>
        <TableCell className="hidden lg:table-cell" />
      </TableRow>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHead k="symbol">{t("symbol")}</SortableHead>
            <SortableHead k="accountType" className="hidden lg:table-cell">{t("account")}</SortableHead>
            <SortableHead k="quantity" right className="hidden md:table-cell">{t("quantity")}</SortableHead>
            <SortableHead k="avgCostCents" right className="hidden lg:table-cell">{t("avgCost")}</SortableHead>
            <SortableHead k="currentPriceCents" right className="hidden md:table-cell">{t("currentPrice")}</SortableHead>
            <SortableHead k="marketValueCents" right>{t("marketValue")}</SortableHead>
            <TableHead className="hidden text-right lg:table-cell">{t("weight")}</TableHead>
            <SortableHead k="dayChangePercent" right className="hidden lg:table-cell">{t("dayChange")}</SortableHead>
            <SortableHead k="unrealizedGainCents" right>{t("unrealizedGain")}</SortableHead>
            <SortableHead k="expectedIncomeCents" right className="hidden md:table-cell">{t("expectedIncome")}</SortableHead>
            <SortableHead k="yieldPercent" right className="hidden lg:table-cell">{t("yield")}</SortableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups
            ? groups.map((group) => (
                <GroupRows
                  key={group.key}
                  group={group}
                  isCollapsed={collapsed.has(group.key)}
                  renderHeader={() => renderGroupHeader(group)}
                  renderRow={renderPositionRow}
                />
              ))
            : sorted.map(renderPositionRow)}
        </TableBody>
      </Table>
    </div>
  );
}

/** Fragment wrapper to render group header + position rows without extra DOM */
function GroupRows({
  group,
  isCollapsed,
  renderHeader,
  renderRow,
}: {
  group: GroupData;
  isCollapsed: boolean;
  renderHeader: () => React.ReactNode;
  renderRow: (h: SerializedPosition) => React.ReactNode;
}) {
  return (
    <>
      {renderHeader()}
      {!isCollapsed && group.positions.map(renderRow)}
    </>
  );
}
