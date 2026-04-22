"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { SerializedPosition } from "@/lib/positions/serialize";
import { HoldingsTable } from "./HoldingsTable";
import { TransactionForm } from "./TransactionForm";
import { NewSecurityForm } from "./NewSecurityForm";
import { NewAccountForm } from "./NewAccountForm";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Account {
  id: string;
  name: string;
  currency: string;
}

interface Props {
  positions: SerializedPosition[];
  accounts: Account[];
  locale: string;
}

export function HoldingsPageClient({ positions, accounts, locale }: Props) {
  const t = useTranslations("holdings");
  const tn = useTranslations("nav");
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("transaction");

  function handleSuccess() {
    setDialogOpen(false);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <Button onClick={() => setDialogOpen(true)}>
          {tn("addTransaction")}
        </Button>
      </div>

      <HoldingsTable positions={positions} locale={locale} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tn("addTransaction")}</DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="transaction">Transaction</TabsTrigger>
              <TabsTrigger value="security">New Security</TabsTrigger>
              <TabsTrigger value="account">New Account</TabsTrigger>
            </TabsList>

            <TabsContent value="transaction">
              {accounts.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground">
                  <p>Create an account first before adding transactions.</p>
                  <Button
                    variant="outline"
                    className="mt-2"
                    onClick={() => setActiveTab("account")}
                  >
                    Create Account
                  </Button>
                </div>
              ) : (
                <TransactionForm
                  accounts={accounts}
                  onSuccess={handleSuccess}
                  onCancel={() => setDialogOpen(false)}
                />
              )}
            </TabsContent>

            <TabsContent value="security">
              <NewSecurityForm
                onSuccess={() => setActiveTab("transaction")}
                onCancel={() => setActiveTab("transaction")}
              />
            </TabsContent>

            <TabsContent value="account">
              <NewAccountForm
                onSuccess={() => {
                  setActiveTab("transaction");
                  router.refresh();
                }}
                onCancel={() => setActiveTab("transaction")}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
