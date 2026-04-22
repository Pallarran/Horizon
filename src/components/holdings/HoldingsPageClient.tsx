"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { SerializedPosition } from "@/lib/positions/serialize";
import type { SerializedTransaction } from "@/lib/actions/transactions";
import { HoldingsTable } from "./HoldingsTable";
import { AccountSummaryCards } from "./AccountSummaryCards";
import { AccountsTab } from "./AccountsTab";
import { ActivitiesTab } from "./ActivitiesTab";
import { TransactionForm } from "./TransactionForm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Account {
  id: string;
  name: string;
  type: string;
  currency: string;
  externalId: string | null;
}

interface Props {
  positions: SerializedPosition[];
  accounts: Account[];
  transactions: SerializedTransaction[];
  locale: string;
}

export function HoldingsPageClient({
  positions,
  accounts,
  transactions,
  locale,
}: Props) {
  const t = useTranslations("holdings");
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("holdings");
  const [txnDialogOpen, setTxnDialogOpen] = useState(false);

  function handleMutationSuccess() {
    setTxnDialogOpen(false);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <Button onClick={() => setTxnDialogOpen(true)}>
          {t("addTransaction")}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="holdings">{t("holdingsTab")}</TabsTrigger>
          <TabsTrigger value="accounts">{t("accountsTab")}</TabsTrigger>
          <TabsTrigger value="activities">{t("activitiesTab")}</TabsTrigger>
        </TabsList>

        <TabsContent value="holdings">
          <AccountSummaryCards
            positions={positions}
            accounts={accounts}
            locale={locale}
          />
          <HoldingsTable positions={positions} locale={locale} />
        </TabsContent>

        <TabsContent value="accounts">
          <AccountsTab
            accounts={accounts}
            positions={positions}
            locale={locale}
          />
        </TabsContent>

        <TabsContent value="activities">
          <ActivitiesTab
            transactions={transactions}
            accounts={accounts}
            locale={locale}
            onAddTransaction={() => setTxnDialogOpen(true)}
          />
        </TabsContent>
      </Tabs>

      {/* Transaction Dialog — simplified, no more inner tabs */}
      <Dialog open={txnDialogOpen} onOpenChange={setTxnDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("addTransaction")}</DialogTitle>
          </DialogHeader>

          {accounts.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground">
              <p>{t("createAccountFirst")}</p>
              <Button
                variant="outline"
                className="mt-2"
                onClick={() => {
                  setTxnDialogOpen(false);
                  setActiveTab("accounts");
                }}
              >
                {t("goToAccounts")}
              </Button>
            </div>
          ) : (
            <TransactionForm
              accounts={accounts}
              onSuccess={handleMutationSuccess}
              onCancel={() => setTxnDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
