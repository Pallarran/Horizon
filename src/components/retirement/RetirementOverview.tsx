"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatMoney, formatPercent } from "@/lib/money/format";
import { calculatePension } from "@/lib/pension/calculate";
import { buildCalcParams, type SerializedPension } from "@/lib/pension/build-params";
import {
  projectFire,
  type IncomeStreamInput,
} from "@/lib/projections/fire";

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
  historicalMonthlyContributionCents: number;
  locale: string;
  retirementAge: number;
  onRetirementAgeChange: (age: number) => void;
}

/* ── Helpers ── */

function buildIncomeStreams(
  pensions: SerializedPension[],
  incomeStreams: SerializedIncomeStream[],
  retirementAge: number,
  birthYear: number,
): IncomeStreamInput[] {
  const result: IncomeStreamInput[] = [];
  const linkedPensionIds = new Set<string>();

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

/* ── Component ── */

export function RetirementOverview(props: RetirementOverviewProps) {
  const t = useTranslations("retirement");
  const {
    retirementAge,
    onRetirementAgeChange,
    locale,
  } = props;

  const currentYear = new Date().getFullYear();
  const currentAge = currentYear - props.birthYear;

  // Editable assumptions (initialized from baseline scenario / defaults)
  const [priceGrowth, setPriceGrowth] = useState(props.assumedPriceGrowth * 100);
  const [dividendGrowth, setDividendGrowth] = useState(props.assumedDividendGrowth * 100);
  const [inflation, setInflation] = useState(props.assumedInflation * 100);
  const [annualContrib, setAnnualContrib] = useState(
    props.monthlyContributionCents * 12 / 100,
  );
  const [reinvestDividends, setReinvestDividends] = useState(props.reinvestDividends);

  const targetIncomeCents = props.salaryCents * props.targetReplacement;

  // Run full projection
  const projection = useMemo(() => {
    const streams = buildIncomeStreams(
      props.pensions,
      props.incomeStreams,
      retirementAge,
      props.birthYear,
    );

    return projectFire(
      {
        currentAge,
        retirementAge,
        currentPortfolioValueCents: props.portfolioValueCents,
        currentAnnualDividendsCents: props.annualDividendsCents,
        annualContributionCents: annualContrib * 100,
        assumedPriceGrowth: priceGrowth / 100,
        assumedDividendGrowth: dividendGrowth / 100,
        assumedInflation: inflation / 100,
        reinvestDividends,
        incomeStreams: streams,
      },
      targetIncomeCents,
    );
  }, [
    currentAge, retirementAge, props.pensions, props.incomeStreams,
    props.portfolioValueCents, props.annualDividendsCents, props.birthYear,
    annualContrib, priceGrowth, dividendGrowth, inflation, reinvestDividends,
    targetIncomeCents,
  ]);

  // Snapshot at chosen retirement age
  const retirementSnapshot = projection.projections.find(
    (p) => p.age === retirementAge,
  );

  const coverageColor = (pct: number) =>
    pct >= 1
      ? "text-gain"
      : pct >= 0.8
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

      {/* Assumptions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("assumptions")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <AssumptionInput
              label={t("priceGrowth")}
              value={priceGrowth}
              onChange={setPriceGrowth}
              suffix="%"
              step={0.5}
            />
            <AssumptionInput
              label={t("dividendGrowth")}
              value={dividendGrowth}
              onChange={setDividendGrowth}
              suffix="%"
              step={0.5}
            />
            <AssumptionInput
              label={t("inflation")}
              value={inflation}
              onChange={setInflation}
              suffix="%"
              step={0.5}
            />
            <AssumptionInput
              label={t("annualContribution")}
              value={annualContrib}
              onChange={setAnnualContrib}
              prefix="$"
              step={1000}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {t("reinvestDividends")}
              </label>
              <div className="flex h-9 items-center">
                <Switch
                  checked={reinvestDividends}
                  onCheckedChange={setReinvestDividends}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Income breakdown at retirement age */}
      {retirementSnapshot && (
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
                value={formatMoney(retirementSnapshot.dividendIncomeCents, locale)}
              />
              <IncomeRow
                label={t("pensionIncome")}
                value={formatMoney(retirementSnapshot.pensionIncomeCents, locale)}
              />
              {retirementSnapshot.otherIncomeCents > 0 && (
                <IncomeRow
                  label={t("otherIncome")}
                  value={formatMoney(retirementSnapshot.otherIncomeCents, locale)}
                />
              )}
              <Separator />
              <IncomeRow
                label={t("totalIncome")}
                value={formatMoney(retirementSnapshot.totalIncomeCents, locale)}
                bold
              />
              <IncomeRow
                label={t("targetIncome", {
                  percent: formatPercent(props.targetReplacement, locale, 0),
                })}
                value={formatMoney(targetIncomeCents, locale)}
                muted
              />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t("coverage")}</span>
                <span className={`text-lg font-bold ${coverageColor(retirementSnapshot.coveragePercent)}`}>
                  {formatPercent(retirementSnapshot.coveragePercent, locale, 0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key stats */}
      {retirementSnapshot && (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label={t("portfolioAtAge", { age: retirementAge })}
            value={formatMoney(retirementSnapshot.portfolioValueCents, locale)}
          />
          <StatCard
            label={t("monthlyIncome")}
            value={formatMoney(Math.round(retirementSnapshot.totalIncomeCents / 12), locale)}
          />
          <StatCard
            label={t("yearsRemaining")}
            value={String(Math.max(0, retirementAge - currentAge))}
          />
        </div>
      )}

      {/* Year-by-year projection table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("projectedIncome")}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="sticky left-0 bg-card py-2 text-left font-medium">{t("retirementAge")}</th>
                <th className="py-2 text-right font-medium">{t("portfolioAtRetirement")}</th>
                <th className="py-2 text-right font-medium">{t("dividendIncome")}</th>
                <th className="py-2 text-right font-medium">{t("pensionIncome")}</th>
                <th className="hidden py-2 text-right font-medium sm:table-cell">{t("otherIncome")}</th>
                <th className="py-2 text-right font-medium">{t("totalIncome")}</th>
                <th className="hidden py-2 text-right font-medium sm:table-cell">{t("annualContribution")}</th>
                <th className="py-2 text-right font-medium">{t("coverage")}</th>
              </tr>
            </thead>
            <tbody>
              {projection.projections.map((row) => {
                const isRetirement = row.age === retirementAge;
                const rowCovColor = coverageColor(row.coveragePercent);

                return (
                  <tr
                    key={row.age}
                    className={
                      isRetirement
                        ? "bg-primary/5 font-medium"
                        : "hover:bg-muted/50"
                    }
                  >
                    <td className="sticky left-0 bg-inherit py-1.5 tabular-nums">
                      {row.age}
                      <span className="ml-1 text-xs text-muted-foreground">({row.year})</span>
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {formatMoney(row.portfolioValueCents, locale)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {formatMoney(row.dividendIncomeCents, locale)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {formatMoney(row.pensionIncomeCents, locale)}
                    </td>
                    <td className="hidden py-1.5 text-right tabular-nums sm:table-cell">
                      {formatMoney(row.otherIncomeCents, locale)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {formatMoney(row.totalIncomeCents, locale)}
                    </td>
                    <td className="hidden py-1.5 text-right tabular-nums sm:table-cell">
                      {row.contributionCents > 0
                        ? formatMoney(row.contributionCents, locale)
                        : "—"}
                    </td>
                    <td className={`py-1.5 text-right tabular-nums ${rowCovColor}`}>
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

function AssumptionInput({
  label,
  value,
  onChange,
  suffix,
  prefix,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  prefix?: string;
  step?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {prefix}
          </span>
        )}
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          step={step}
          className={`tabular-nums ${prefix ? "pl-7" : ""} ${suffix ? "pr-7" : ""}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

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
