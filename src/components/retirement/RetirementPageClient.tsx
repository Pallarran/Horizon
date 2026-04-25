"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RetirementOverview } from "./RetirementOverview";
import { PensionCalculator } from "./PensionCalculator";
import { IncomeStreamManager } from "@/components/income/IncomeStreamManager";
import { ProjectionsPageClient } from "@/components/projections/ProjectionsPageClient";
import type {
  SerializedPension,
  SerializedIncomeStream,
} from "./RetirementOverview";

interface RetirementPageClientProps {
  // Overview tab data
  pensions: SerializedPension[];
  incomeStreams: SerializedIncomeStream[];
  portfolioValueCents: number;
  annualDividendsCents: number;
  salaryCents: number;
  targetReplacement: number;
  birthYear: number;
  targetRetirementAge: number;
  monthlyContributionCents: number;
  assumedPriceGrowth: number;
  assumedDividendGrowth: number;
  assumedInflation: number;
  reinvestDividends: boolean;
  // Projections tab data
  startingYield: number;
  yearsToRetirement: number;
  // Shared
  locale: string;
}

type TabValue = "overview" | "income" | "projections";

const VALID_TABS: TabValue[] = ["overview", "income", "projections"];

export function RetirementPageClient(props: RetirementPageClientProps) {
  const t = useTranslations("retirement");
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab") as string | null;
  const activeTab: TabValue =
    tabParam && VALID_TABS.includes(tabParam as TabValue)
      ? (tabParam as TabValue)
      : "overview";

  const [retirementAge, setRetirementAge] = useState(props.targetRetirementAge);

  const handleTabChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "overview") {
        params.delete("tab");
      } else {
        params.set("tab", value);
      }
      const qs = params.toString();
      router.replace(`/retirement${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="overview">{t("overviewTab")}</TabsTrigger>
        <TabsTrigger value="income">{t("incomeSourcesTab")}</TabsTrigger>
        <TabsTrigger value="projections">{t("projectionsTab")}</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-4">
        <RetirementOverview
          pensions={props.pensions}
          incomeStreams={props.incomeStreams}
          portfolioValueCents={props.portfolioValueCents}
          annualDividendsCents={props.annualDividendsCents}
          salaryCents={props.salaryCents}
          targetReplacement={props.targetReplacement}
          birthYear={props.birthYear}
          targetRetirementAge={props.targetRetirementAge}
          monthlyContributionCents={props.monthlyContributionCents}
          assumedPriceGrowth={props.assumedPriceGrowth}
          assumedDividendGrowth={props.assumedDividendGrowth}
          assumedInflation={props.assumedInflation}
          reinvestDividends={props.reinvestDividends}
          locale={props.locale}
          retirementAge={retirementAge}
          onRetirementAgeChange={setRetirementAge}
        />
      </TabsContent>

      <TabsContent value="income" className="mt-4 space-y-8">
        <section>
          <h2 className="mb-4 text-lg font-semibold">{t("pension")}</h2>
          <PensionCalculator
            pensions={props.pensions}
            locale={props.locale}
            retirementAge={retirementAge}
            birthYear={props.birthYear}
          />
        </section>
        <section>
          <h2 className="mb-4 text-lg font-semibold">{t("incomeStreams")}</h2>
          <IncomeStreamManager
            streams={props.incomeStreams}
            locale={props.locale}
          />
        </section>
      </TabsContent>

      <TabsContent value="projections" className="mt-4">
        <ProjectionsPageClient
          portfolioValueCents={props.portfolioValueCents}
          startingYield={props.startingYield}
          yearsToRetirement={props.yearsToRetirement}
          locale={props.locale}
        />
      </TabsContent>
    </Tabs>
  );
}
