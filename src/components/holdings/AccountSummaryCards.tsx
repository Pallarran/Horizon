"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { SerializedPosition } from "@/lib/positions/serialize";
import { formatMoney } from "@/lib/money/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Account {
  id: string;
  name: string;
  type: string;
  currency: string;
}

interface Props {
  positions: SerializedPosition[];
  accounts: Account[];
  locale: string;
}

export function AccountSummaryCards({ positions, accounts, locale }: Props) {
  const t = useTranslations("holdings");

  const accountSummaries = useMemo(() => {
    const grouped = new Map<string, SerializedPosition[]>();
    for (const p of positions) {
      const list = grouped.get(p.accountId) ?? [];
      list.push(p);
      grouped.set(p.accountId, list);
    }

    return accounts.map((acct) => {
      const acctPositions = grouped.get(acct.id) ?? [];
      const totalValue = acctPositions.reduce(
        (s, p) => s + (p.marketValueCents ?? p.totalCostCents),
        0,
      );
      const totalCost = acctPositions.reduce(
        (s, p) => s + p.totalCostCents,
        0,
      );
      const unrealizedGain = totalValue - totalCost;
      const unrealizedPct =
        totalCost > 0 ? (unrealizedGain / totalCost) * 100 : 0;

      return {
        account: acct,
        totalValue,
        unrealizedGain,
        unrealizedPct,
        positionCount: acctPositions.length,
      };
    });
  }, [positions, accounts]);

  // Only show accounts that have positions or are active
  const visibleAccounts = accountSummaries.filter(
    (s) => s.positionCount > 0 || s.totalValue > 0,
  );

  if (visibleAccounts.length === 0) return null;

  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {visibleAccounts.map((summary) => (
        <Card key={summary.account.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                {summary.account.name}
              </CardTitle>
              <Badge variant="outline">{summary.account.type}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {formatMoney(summary.totalValue, locale)}
            </p>
            <div className="mt-1 flex items-center gap-2 text-sm">
              <span
                className={
                  summary.unrealizedGain >= 0 ? "text-gain" : "text-loss"
                }
              >
                {summary.unrealizedGain >= 0 ? "+" : ""}
                {formatMoney(summary.unrealizedGain, locale)} (
                {summary.unrealizedPct >= 0 ? "+" : ""}
                {summary.unrealizedPct.toFixed(1)}%)
              </span>
              <span className="text-muted-foreground">
                · {summary.positionCount} {t("positions")}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
