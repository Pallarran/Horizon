"use client";

import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface RetirementTabsProps {
  pensionTab: React.ReactNode;
  scenarioTab: React.ReactNode;
  incomeTab: React.ReactNode;
}

export function RetirementTabs({
  pensionTab,
  scenarioTab,
  incomeTab,
}: RetirementTabsProps) {
  const t = useTranslations("retirement");

  return (
    <Tabs defaultValue="scenarios" className="space-y-6">
      <TabsList>
        <TabsTrigger value="scenarios">{t("scenarios")}</TabsTrigger>
        <TabsTrigger value="pension">{t("pension")}</TabsTrigger>
        <TabsTrigger value="income">{t("incomeStreams")}</TabsTrigger>
      </TabsList>

      <TabsContent value="scenarios">{scenarioTab}</TabsContent>
      <TabsContent value="pension">{pensionTab}</TabsContent>
      <TabsContent value="income">{incomeTab}</TabsContent>
    </Tabs>
  );
}
