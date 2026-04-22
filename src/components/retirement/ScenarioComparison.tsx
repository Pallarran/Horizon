"use client";

import { useState, useActionState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { formatMoney, formatPercent } from "@/lib/money/format";
import type { FireResult } from "@/lib/projections/fire";
import {
  createScenarioAction,
  updateScenarioAction,
  deleteScenarioAction,
} from "@/lib/actions/scenarios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SerializedScenario {
  id: string;
  name: string;
  retirementAge: number;
  targetIncomeReplacement: number;
  assumedPriceGrowth: number;
  assumedDividendGrowth: number;
  assumedInflation: number;
  monthlyContributionCents: number;
  reinvestDividends: boolean;
  isBaseline: boolean;
}

interface ScenarioWithProjection {
  scenario: SerializedScenario;
  projection: FireResult;
}

interface ScenarioComparisonProps {
  scenarios: ScenarioWithProjection[];
  locale: string;
}

export function ScenarioComparison({ scenarios, locale }: ScenarioComparisonProps) {
  const t = useTranslations("retirement");
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    const result = await deleteScenarioAction(id);
    if (result.success) router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("scenarios")}</h2>
        {scenarios.length < 4 && (
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
            {t("addScenario")}
          </Button>
        )}
      </div>

      {scenarios.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noScenarios")}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {scenarios.map(({ scenario, projection }) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              projection={projection}
              locale={locale}
              onEdit={() => setEditingId(scenario.id)}
              onDelete={() => handleDelete(scenario.id)}
              t={t}
            />
          ))}
        </div>
      )}

      {showForm && (
        <ScenarioForm
          action={createScenarioAction}
          onDone={() => {
            setShowForm(false);
            router.refresh();
          }}
          t={t}
        />
      )}

      {editingId && (
        <ScenarioForm
          scenario={scenarios.find((s) => s.scenario.id === editingId)?.scenario}
          action={updateScenarioAction}
          onDone={() => {
            setEditingId(null);
            router.refresh();
          }}
          t={t}
        />
      )}
    </div>
  );
}

function ScenarioCard({
  scenario,
  projection,
  locale,
  onEdit,
  onDelete,
  t,
}: {
  scenario: SerializedScenario;
  projection: FireResult;
  locale: string;
  onEdit: () => void;
  onDelete: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{scenario.name}</CardTitle>
            {scenario.isBaseline && <Badge variant="secondary">Baseline</Badge>}
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit}>
              {t("edit")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={onDelete}
            >
              {t("delete")}
            </Button>
          </div>
        </div>
        <CardDescription>
          {t("retirementAge")}: {scenario.retirementAge} |{" "}
          {formatMoney(scenario.monthlyContributionCents, locale)}/mo
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">{t("portfolioAtRetirement")}</p>
            <p className="text-lg font-semibold">
              {formatMoney(projection.portfolioAtRetirementCents, locale)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("incomeAtRetirement")}</p>
            <p className="text-lg font-semibold">
              {formatMoney(projection.incomeAtRetirementCents, locale)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("freedomAge")}</p>
            <p className="text-lg font-semibold">
              {projection.freedomAge ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("assumptions")}</p>
            <p className="text-xs text-muted-foreground">
              Growth: {formatPercent(scenario.assumedPriceGrowth, locale, 1)} |{" "}
              Div: {formatPercent(scenario.assumedDividendGrowth, locale, 1)} |{" "}
              Infl: {formatPercent(scenario.assumedInflation, locale, 1)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ScenarioForm({
  scenario,
  action,
  onDone,
  t,
}: {
  scenario?: SerializedScenario;
  action: typeof createScenarioAction | typeof updateScenarioAction;
  onDone: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [state, formAction, isPending] = useActionState(action, {});

  if (state.success) {
    onDone();
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={formAction} className="space-y-4">
          {scenario && <input type="hidden" name="id" value={scenario.id} />}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>{t("scenarioName")}</Label>
              <Input name="name" defaultValue={scenario?.name ?? ""} required />
            </div>
            <div>
              <Label>{t("retirementAge")}</Label>
              <Input
                name="retirementAge"
                type="number"
                defaultValue={scenario?.retirementAge ?? 55}
                required
              />
            </div>
            <div>
              <Label>{t("targetReplacement")}</Label>
              <Input
                name="targetIncomeReplacement"
                type="number"
                step="0.01"
                defaultValue={scenario?.targetIncomeReplacement ?? 0.7}
              />
            </div>
            <div>
              <Label>{t("monthlyContribution")}</Label>
              <Input
                name="monthlyContributionDollars"
                type="number"
                step="0.01"
                defaultValue={
                  scenario
                    ? (scenario.monthlyContributionCents / 100).toFixed(2)
                    : "0"
                }
              />
            </div>
            <div>
              <Label>{t("priceGrowth")}</Label>
              <Input
                name="assumedPriceGrowth"
                type="number"
                step="0.001"
                defaultValue={scenario?.assumedPriceGrowth ?? 0.02}
              />
            </div>
            <div>
              <Label>{t("dividendGrowth")}</Label>
              <Input
                name="assumedDividendGrowth"
                type="number"
                step="0.001"
                defaultValue={scenario?.assumedDividendGrowth ?? 0.01}
              />
            </div>
            <div>
              <Label>{t("inflation")}</Label>
              <Input
                name="assumedInflation"
                type="number"
                step="0.001"
                defaultValue={scenario?.assumedInflation ?? 0.025}
              />
            </div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="reinvestDividends"
                  value="true"
                  defaultChecked={scenario?.reinvestDividends ?? true}
                />
                {t("reinvestDividends")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="isBaseline"
                  value="true"
                  defaultChecked={scenario?.isBaseline ?? false}
                />
                Baseline
              </label>
            </div>
          </div>

          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? t("saving") : t("save")}
            </Button>
            <Button type="button" variant="ghost" onClick={onDone}>
              {t("cancel")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
