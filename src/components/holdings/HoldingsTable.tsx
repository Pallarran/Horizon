"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
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

interface Props {
  positions: SerializedPosition[];
  locale: string;
}

export function HoldingsTable({ positions, locale }: Props) {
  const t = useTranslations("holdings");
  const [sortKey, setSortKey] = useState<SortKey>("marketValueCents");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
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
  }, [positions, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
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

  // Totals
  const totalMarketValue = positions.reduce((s, h) => s + (h.marketValueCents ?? h.totalCostCents), 0);
  const totalCost = positions.reduce((s, h) => s + h.totalCostCents, 0);
  const totalGain = totalMarketValue - totalCost;
  const totalIncome = positions.reduce((s, h) => s + (h.expectedIncomeCents ?? 0), 0);

  if (positions.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p className="text-lg">{t("noPositions")}</p>
        <p className="mt-1 text-sm">{t("createAccountFirst")}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">
          {t("marketValue")}: {formatMoney(totalMarketValue, locale)}
          {" · "}
          {t("unrealizedGain")}:{" "}
          <span className={totalGain >= 0 ? "text-gain" : "text-loss"}>
            {totalGain >= 0 ? "+" : ""}{formatMoney(totalGain, locale)}
            {totalCost > 0 && <> ({formatPercent(totalGain / totalCost, locale)})</>}
          </span>
          {" · "}
          {t("expectedIncome")}: {formatMoney(totalIncome, locale)}
        </p>
      </div>

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
              <SortableHead k="dayChangePercent" right className="hidden lg:table-cell">{t("dayChange")}</SortableHead>
              <SortableHead k="unrealizedGainCents" right>{t("unrealizedGain")}</SortableHead>
              <SortableHead k="expectedIncomeCents" right className="hidden md:table-cell">{t("expectedIncome")}</SortableHead>
              <SortableHead k="yieldPercent" right className="hidden lg:table-cell">{t("yield")}</SortableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((h) => (
              <TableRow key={`${h.securityId}-${h.accountId}`}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{h.symbol}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {h.currency}
                    </Badge>
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
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
