"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatMoney, formatPercent } from "@/lib/money/format";
import {
  calculatePension,
  type PensionParams,
} from "@/lib/pension/calculate";
import {
  projectFire,
  type IncomeStreamInput,
} from "@/lib/projections/fire";

/* ── Serialized types (from server) ── */

interface SerializedPension {
  id: string;
  name: string;
  planType: "DB_FORMULA" | "DB_STATEMENT" | "DC";
  isActive: boolean;
  startYear: number | null;
  baseAccrualRate: number | null;
  earlyRetirementReduction: number | null;
  normalRetirementAge: number | null;
  salaryBasisCents: number | null;
  statementAnnualCents: number | null;
  statementRetirementAge: number | null;
  bridgeBenefitCents: number | null;
  bridgeEndAge: number | null;
  indexationRate: number | null;
  currentBalanceCents: number | null;
  employeeContribRate: number | null;
  employerContribRate: number | null;
  dcSalaryCents: number | null;
  assumedGrowthRate: number | null;
}

interface SerializedIncomeStream {
  id: string;
  name: string;
  type: string;
  startAge: number;
  endAge: number | null;
  annualAmountCents: number | null;
  computedFromPensionId: string | null;
  inflationIndexed: boolean;
  notes: string | null;
}

interface RetirementOverviewProps {
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
  locale: string;
  retirementAge: number;
  onRetirementAgeChange: (age: number) => void;
}

/* ── Helpers ── */

function buildCalcParams(
  pension: SerializedPension,
  retirementAge: number,
  birthYear: number,
): PensionParams | null {
  const currentYear = new Date().getFullYear();
  const currentAge = currentYear - birthYear;
  const yearsToRetirement = Math.max(0, retirementAge - currentAge);
  const retirementYear = currentYear + yearsToRetirement;

  const bridge = {
    bridgeBenefitCents: pension.bridgeBenefitCents,
    bridgeEndAge: pension.bridgeEndAge,
    indexationRate: pension.indexationRate,
  };

  switch (pension.planType) {
    case "DB_FORMULA": {
      if (!pension.startYear || !pension.salaryBasisCents || !pension.baseAccrualRate) return null;
      return {
        planType: "DB_FORMULA",
        startYear: pension.startYear,
        retirementYear,
        salaryBasisCents: pension.salaryBasisCents,
        baseAccrualRate: pension.baseAccrualRate,
        normalRetirementAge: pension.normalRetirementAge ?? 65,
        earlyRetirementReduction: pension.earlyRetirementReduction ?? 0.04,
        retirementAge,
        ...bridge,
      };
    }
    case "DB_STATEMENT": {
      if (!pension.statementAnnualCents || !pension.statementRetirementAge) return null;
      return {
        planType: "DB_STATEMENT",
        statementAnnualCents: pension.statementAnnualCents,
        statementRetirementAge: pension.statementRetirementAge,
        earlyRetirementReduction: pension.earlyRetirementReduction,
        retirementAge,
        ...bridge,
      };
    }
    case "DC": {
      if (!pension.currentBalanceCents || !pension.dcSalaryCents) return null;
      const salary = pension.dcSalaryCents;
      const empRate = pension.employeeContribRate ?? 0;
      const erRate = pension.employerContribRate ?? 0;
      return {
        planType: "DC",
        currentBalanceCents: pension.currentBalanceCents,
        annualContributionCents: Math.round(salary * (empRate + erRate)),
        assumedGrowthRate: pension.assumedGrowthRate ?? 0.05,
        yearsToRetirement,
        retirementAge,
      };
    }
  }
}

function buildIncomeStreams(
  pensions: SerializedPension[],
  incomeStreams: SerializedIncomeStream[],
  retirementAge: number,
  birthYear: number,
): IncomeStreamInput[] {
  const result: IncomeStreamInput[] = [];
  const linkedPensionIds = new Set<string>();

  // Process income streams with pension links
  for (const stream of incomeStreams) {
    if (stream.computedFromPensionId) {
      linkedPensionIds.add(stream.computedFromPensionId);
      const pension = pensions.find((p) => p.id === stream.computedFromPensionId);
      if (pension) {
        const params = buildCalcParams(pension, retirementAge, birthYear);
        if (params) {
          const calc = calculatePension(params);
          const indexRate = pension.indexationRate ?? 0;
          result.push({
            name: stream.name,
            startAge: stream.startAge,
            endAge: stream.endAge,
            annualAmountCents: calc.annualPensionCents,
            inflationIndexed: indexRate > 0,
            customGrowthRate: indexRate > 0 ? indexRate : undefined,
            isPension: true,
          });
        }
      }
    } else if (stream.annualAmountCents) {
      result.push({
        name: stream.name,
        startAge: stream.startAge,
        endAge: stream.endAge,
        annualAmountCents: stream.annualAmountCents,
        inflationIndexed: stream.inflationIndexed,
        isPension: stream.type === "PENSION",
      });
    }
  }

  // Include standalone pensions not linked to income streams
  for (const pension of pensions) {
    if (linkedPensionIds.has(pension.id)) continue;
    const params = buildCalcParams(pension, retirementAge, birthYear);
    if (!params) continue;
    const calc = calculatePension(params);
    const indexRate = pension.indexationRate ?? 0;

    result.push({
      name: pension.name,
      startAge: retirementAge,
      endAge: null,
      annualAmountCents: calc.annualPensionCents,
      inflationIndexed: indexRate > 0,
      customGrowthRate: indexRate > 0 ? indexRate : undefined,
      isPension: true,
    });

    if (calc.bridgeAnnualCents && calc.bridgeEndAge) {
      result.push({
        name: `${pension.name} (bridge)`,
        startAge: retirementAge,
        endAge: calc.bridgeEndAge,
        annualAmountCents: calc.bridgeAnnualCents,
        inflationIndexed: false,
        isPension: true,
      });
    }
  }

  return result;
}

interface RetirementSnapshot {
  dividendIncomeCents: number;
  pensionIncomeCents: number;
  otherIncomeCents: number;
  totalIncomeCents: number;
  portfolioValueCents: number;
  coveragePercent: number;
  yearsRemaining: number;
}

function computeSnapshot(
  age: number,
  props: RetirementOverviewProps,
): RetirementSnapshot {
  const currentYear = new Date().getFullYear();
  const currentAge = currentYear - props.birthYear;
  const yearsRemaining = Math.max(0, age - currentAge);

  const streams = buildIncomeStreams(
    props.pensions,
    props.incomeStreams,
    age,
    props.birthYear,
  );

  const targetIncomeCents = props.salaryCents * props.targetReplacement;

  const result = projectFire(
    {
      currentAge,
      retirementAge: age,
      currentPortfolioValueCents: props.portfolioValueCents,
      currentAnnualDividendsCents: props.annualDividendsCents,
      annualContributionCents: props.monthlyContributionCents * 12,
      assumedPriceGrowth: props.assumedPriceGrowth,
      assumedDividendGrowth: props.assumedDividendGrowth,
      assumedInflation: props.assumedInflation,
      reinvestDividends: props.reinvestDividends,
      incomeStreams: streams,
    },
    targetIncomeCents,
  );

  const retProj = result.projections.find((p) => p.age === age);

  // Split income streams into pension vs other
  let pensionCents = 0;
  let otherCents = 0;
  for (const s of streams) {
    if (age < s.startAge) continue;
    if (s.endAge !== null && age > s.endAge) continue;
    const yearsFromNow = age - currentAge;
    const growthRate = s.customGrowthRate ?? (s.inflationIndexed ? props.assumedInflation : 0);
    const amount = Math.round(s.annualAmountCents * Math.pow(1 + growthRate, yearsFromNow));
    if (s.isPension) {
      pensionCents += amount;
    } else {
      otherCents += amount;
    }
  }

  return {
    dividendIncomeCents: retProj?.dividendIncomeCents ?? 0,
    pensionIncomeCents: pensionCents,
    otherIncomeCents: otherCents,
    totalIncomeCents: retProj?.totalIncomeCents ?? 0,
    portfolioValueCents: retProj?.portfolioValueCents ?? result.portfolioAtRetirementCents,
    coveragePercent: retProj?.coveragePercent ?? 0,
    yearsRemaining,
  };
}

/* ── Component ── */

export function RetirementOverview(props: RetirementOverviewProps) {
  const t = useTranslations("retirement");
  const {
    retirementAge,
    onRetirementAgeChange,
    targetReplacement,
    locale,
  } = props;

  const targetIncomeCents = props.salaryCents * props.targetReplacement;

  // Main snapshot for the slider position
  const snapshot = useMemo(
    () => computeSnapshot(retirementAge, props),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [retirementAge, props.pensions, props.incomeStreams, props.portfolioValueCents,
     props.annualDividendsCents, props.salaryCents, props.targetReplacement,
     props.birthYear, props.monthlyContributionCents, props.assumedPriceGrowth,
     props.assumedDividendGrowth, props.assumedInflation, props.reinvestDividends],
  );

  // Comparison ages: user target ± spread to show 4 ages
  const comparisonAges = useMemo(() => {
    const target = props.targetRetirementAge;
    const ages = [
      Math.max(50, target - 5),
      Math.max(50, target - 2),
      target,
      Math.min(70, target + 3),
    ];
    // Deduplicate while preserving order
    return [...new Set(ages)].sort((a, b) => a - b);
  }, [props.targetRetirementAge]);

  const comparisonSnapshots = useMemo(
    () => comparisonAges.map((age) => ({ age, ...computeSnapshot(age, props) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [comparisonAges, props.pensions, props.incomeStreams, props.portfolioValueCents,
     props.annualDividendsCents, props.salaryCents, props.targetReplacement,
     props.birthYear, props.monthlyContributionCents, props.assumedPriceGrowth,
     props.assumedDividendGrowth, props.assumedInflation, props.reinvestDividends],
  );

  const coverageColor = snapshot.coveragePercent >= 1
    ? "text-gain"
    : snapshot.coveragePercent >= 0.8
      ? "text-yellow-600 dark:text-yellow-400"
      : "text-loss";

  return (
    <div className="space-y-6">
      {/* Retirement age slider */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("retirementAgeSlider")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">50</span>
            <Slider
              min={50}
              max={70}
              step={1}
              value={[retirementAge]}
              onValueChange={([v]) => onRetirementAgeChange(v)}
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground">70</span>
          </div>
          <p className="mt-2 text-center text-2xl font-bold tabular-nums">
            {retirementAge}
          </p>
        </CardContent>
      </Card>

      {/* Income breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {t("incomeAtAge", { age: retirementAge })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <IncomeRow
              label={t("dividendIncome")}
              value={formatMoney(snapshot.dividendIncomeCents, locale)}
            />
            <IncomeRow
              label={t("pensionIncome")}
              value={formatMoney(snapshot.pensionIncomeCents, locale)}
            />
            {snapshot.otherIncomeCents > 0 && (
              <IncomeRow
                label={t("otherIncome")}
                value={formatMoney(snapshot.otherIncomeCents, locale)}
              />
            )}
            <Separator />
            <IncomeRow
              label={t("totalIncome")}
              value={formatMoney(snapshot.totalIncomeCents, locale)}
              bold
            />
            <IncomeRow
              label={t("targetIncome", {
                percent: formatPercent(targetReplacement, locale, 0),
              })}
              value={formatMoney(targetIncomeCents, locale)}
              muted
            />
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t("coverage")}</span>
              <span className={`text-lg font-bold ${coverageColor}`}>
                {formatPercent(snapshot.coveragePercent, locale, 0)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label={t("portfolioAtAge", { age: retirementAge })}
          value={formatMoney(snapshot.portfolioValueCents, locale)}
        />
        <StatCard
          label={t("monthlyIncome")}
          value={formatMoney(Math.round(snapshot.totalIncomeCents / 12), locale)}
        />
        <StatCard
          label={t("yearsRemaining")}
          value={String(snapshot.yearsRemaining)}
        />
      </div>

      {/* Comparison table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("comparison")}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-2 text-left font-medium">{t("retirementAge")}</th>
                <th className="py-2 text-right font-medium">{t("dividendIncome")}</th>
                <th className="py-2 text-right font-medium">{t("pensionIncome")}</th>
                <th className="hidden py-2 text-right font-medium sm:table-cell">{t("otherIncome")}</th>
                <th className="py-2 text-right font-medium">{t("totalIncome")}</th>
                <th className="py-2 text-right font-medium">{t("coverage")}</th>
              </tr>
            </thead>
            <tbody>
              {comparisonSnapshots.map((row) => {
                const isActive = row.age === retirementAge;
                const rowCoverageColor = row.coveragePercent >= 1
                  ? "text-gain"
                  : row.coveragePercent >= 0.8
                    ? "text-yellow-600 dark:text-yellow-400"
                    : "text-loss";

                return (
                  <tr
                    key={row.age}
                    className={
                      isActive
                        ? "bg-primary/5 font-medium"
                        : "hover:bg-muted/50"
                    }
                  >
                    <td className="py-2">{row.age}</td>
                    <td className="py-2 text-right tabular-nums">
                      {formatMoney(row.dividendIncomeCents, locale)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatMoney(row.pensionIncomeCents, locale)}
                    </td>
                    <td className="hidden py-2 text-right tabular-nums sm:table-cell">
                      {formatMoney(row.otherIncomeCents, locale)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatMoney(row.totalIncomeCents, locale)}
                    </td>
                    <td className={`py-2 text-right tabular-nums ${rowCoverageColor}`}>
                      {formatPercent(row.coveragePercent, locale, 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Sub-components ── */

function IncomeRow({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={`text-sm ${bold ? "font-medium" : ""} ${muted ? "text-muted-foreground" : ""}`}
      >
        {label}
      </span>
      <span
        className={`tabular-nums ${bold ? "text-base font-bold" : "text-sm"} ${muted ? "text-muted-foreground" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

export type { SerializedPension, SerializedIncomeStream, RetirementOverviewProps };
