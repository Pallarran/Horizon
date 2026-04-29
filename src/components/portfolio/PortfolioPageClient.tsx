"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { HoldingsPageClient } from "@/components/holdings/HoldingsPageClient";
import { AccountsTab } from "@/components/holdings/AccountsTab";
import { ContributionsPageClient } from "@/components/contributions/ContributionsPageClient";
import type { SerializedPosition } from "@/lib/positions/serialize";
import type { SecurityProfileMap } from "@/lib/positions/security-profile";
import type { SerializedCrcdHolding } from "@/lib/actions/crcd-holdings";
import type { PortfolioHistoryPoint } from "@/lib/dashboard/portfolio-history";
import type { ContributionYearRow } from "@/lib/contributions/compute";

interface HoldingsAccount {
  id: string;
  name: string;
  currency: string;
}

interface FullAccount {
  id: string;
  name: string;
  type: string;
  currency: string;
  externalId: string | null;
}

interface PortfolioPageClientProps {
  // Holdings (Positions) tab
  positions: SerializedPosition[];
  accountsForHoldings: HoldingsAccount[];
  securityProfiles: SecurityProfileMap;
  usdCadRate: number;
  watchedSecurityIds: string[];
  crcdHoldings: SerializedCrcdHolding[];
  // Accounts tab
  accountsForAccounts: FullAccount[];
  accountHistories: Record<string, PortfolioHistoryPoint[]>;
  cashBalances: Record<string, number>;
  // Contributions tab
  contributionRows: ContributionYearRow[];
  hasCrcdHoldings: boolean;
  // Shared
  locale: string;
}

export function PortfolioPageClient({
  positions,
  accountsForHoldings,
  securityProfiles,
  usdCadRate,
  watchedSecurityIds,
  crcdHoldings,
  accountsForAccounts,
  accountHistories,
  cashBalances,
  contributionRows,
  hasCrcdHoldings,
  locale,
}: PortfolioPageClientProps) {
  const t = useTranslations("holdings");
  const tContrib = useTranslations("contributions");
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab");
  const activeTab = tabParam === "holdings" || tabParam === "contributions" ? tabParam : "accounts";

  const handleTabChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "accounts") {
        params.delete("tab");
      } else {
        params.set("tab", value);
      }
      // Preserve account filter only on holdings tab
      if (value === "accounts") params.delete("account");
      const qs = params.toString();
      router.replace(`/portfolio${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="accounts">{t("accountsTab")}</TabsTrigger>
        <TabsTrigger value="holdings">{t("holdingsTab")}</TabsTrigger>
        <TabsTrigger value="contributions">{tContrib("title")}</TabsTrigger>
      </TabsList>

      <TabsContent value="accounts" className="mt-4">
        <AccountsTab
          accounts={accountsForAccounts}
          positions={positions}
          accountHistories={accountHistories}
          cashBalances={cashBalances}
          usdCadRate={usdCadRate}
          locale={locale}
        />
      </TabsContent>

      <TabsContent value="holdings" className="mt-4">
        <HoldingsPageClient
          positions={positions}
          accounts={accountsForHoldings}
          securityProfiles={securityProfiles}
          locale={locale}
          usdCadRate={usdCadRate}
          watchedSecurityIds={watchedSecurityIds}
          crcdHoldings={crcdHoldings}
        />
      </TabsContent>

      <TabsContent value="contributions" className="mt-4">
        <ContributionsPageClient
          initialRows={contributionRows}
          locale={locale}
          hasCrcdHoldings={hasCrcdHoldings}
        />
      </TabsContent>
    </Tabs>
  );
}
