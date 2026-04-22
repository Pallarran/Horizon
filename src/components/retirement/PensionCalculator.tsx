"use client";

import { useState, useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { formatMoney, formatPercent } from "@/lib/money/format";
import { calculatePension, type PensionResult } from "@/lib/pension/calculate";
import { createPensionAction, updatePensionAction } from "@/lib/actions/pensions";
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

interface SerializedPension {
  id: string;
  name: string;
  startYear: number;
  baseAccrualRate: number;
  initialBaseYears: number;
  earlyRetirementReduction: number;
  normalRetirementAge: number;
  salaryBasisCents: number;
  isActive: boolean;
}

interface PensionCalculatorProps {
  pensions: SerializedPension[];
  locale: string;
  retirementAge: number;
  birthYear: number;
}

export function PensionCalculator({
  pensions,
  locale,
  retirementAge,
  birthYear,
}: PensionCalculatorProps) {
  const t = useTranslations("retirement");
  const router = useRouter();

  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Existing pensions */}
      {pensions.map((pension) => (
        <PensionCard
          key={pension.id}
          pension={pension}
          locale={locale}
          retirementAge={retirementAge}
          birthYear={birthYear}
          isEditing={editing === pension.id}
          onEdit={() => setEditing(pension.id)}
          onDone={() => {
            setEditing(null);
            router.refresh();
          }}
          t={t}
        />
      ))}

      {/* New pension form */}
      <NewPensionForm
        locale={locale}
        retirementAge={retirementAge}
        birthYear={birthYear}
        onDone={() => router.refresh()}
        t={t}
      />
    </div>
  );
}

function PensionCard({
  pension,
  locale,
  retirementAge,
  birthYear,
  isEditing,
  onEdit,
  onDone,
  t,
}: {
  pension: SerializedPension;
  locale: string;
  retirementAge: number;
  birthYear: number;
  isEditing: boolean;
  onEdit: () => void;
  onDone: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const td = useTranslations("dashboard");
  const currentYear = new Date().getFullYear();
  const retirementYear = birthYear + retirementAge;
  const result = calculatePension({
    startYear: pension.startYear,
    retirementYear,
    salaryBasisCents: pension.salaryBasisCents,
    baseAccrualRate: pension.baseAccrualRate,
    initialBaseYears: pension.initialBaseYears,
    normalRetirementAge: pension.normalRetirementAge,
    earlyRetirementReduction: pension.earlyRetirementReduction,
    retirementAge,
  });

  if (isEditing) {
    return (
      <PensionForm
        pension={pension}
        action={updatePensionAction}
        onDone={onDone}
        t={t}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{pension.name}</CardTitle>
            <CardDescription>
              {t("yearsOfService")}: {result.yearsOfService} |{" "}
              {t("retirementAge")}: {retirementAge}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onEdit}>
            {t("edit")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">{t("annualPension")}</p>
            <p className="text-2xl font-bold">
              {formatMoney(result.annualPensionCents, locale)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t("monthlyPension")}</p>
            <p className="text-2xl font-bold">
              {formatMoney(result.monthlyPensionCents, locale)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t("reductionApplied")}</p>
            <p className="text-2xl font-bold">
              {formatPercent(result.reductionPercent, locale, 0)}
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
          <div>{td("preReduction")}: {formatMoney(result.preReductionCents, locale)}</div>
          <div>{td("baseA")}: {formatMoney(result.baseACents, locale)} | {td("baseB")}: {formatMoney(result.baseBCents, locale)}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function PensionForm({
  pension,
  action,
  onDone,
  t,
}: {
  pension?: SerializedPension;
  action: typeof createPensionAction | typeof updatePensionAction;
  onDone: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [state, formAction, isPending] = useActionState(action, {});

  useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={formAction} className="space-y-4">
          {pension && <input type="hidden" name="id" value={pension.id} />}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>{t("pensionName")}</Label>
              <Input name="name" defaultValue={pension?.name ?? "RRMD"} required />
            </div>
            <div>
              <Label>{t("startYear")}</Label>
              <Input
                name="startYear"
                type="number"
                defaultValue={pension?.startYear ?? 2010}
                required
              />
            </div>
            <div>
              <Label>{t("salaryBasis")}</Label>
              <Input
                name="salaryBasisDollars"
                type="number"
                step="0.01"
                defaultValue={pension ? (pension.salaryBasisCents / 100).toFixed(2) : ""}
                required
              />
            </div>
            <div>
              <Label>{t("accrualRate")}</Label>
              <Input
                name="baseAccrualRate"
                type="number"
                step="0.001"
                defaultValue={pension?.baseAccrualRate ?? 0.015}
                required
              />
            </div>
            <div>
              <Label>{t("initialBaseYears")}</Label>
              <Input
                name="initialBaseYears"
                type="number"
                defaultValue={pension?.initialBaseYears ?? 2}
              />
            </div>
            <div>
              <Label>{t("normalRetirementAge")}</Label>
              <Input
                name="normalRetirementAge"
                type="number"
                defaultValue={pension?.normalRetirementAge ?? 65}
              />
            </div>
            <div>
              <Label>{t("earlyReduction")}</Label>
              <Input
                name="earlyRetirementReduction"
                type="number"
                step="0.01"
                defaultValue={pension?.earlyRetirementReduction ?? 0.04}
              />
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

function NewPensionForm({
  locale,
  retirementAge,
  birthYear,
  onDone,
  t,
}: {
  locale: string;
  retirementAge: number;
  birthYear: number;
  onDone: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [showForm, setShowForm] = useState(false);

  if (!showForm) {
    return (
      <Button variant="outline" onClick={() => setShowForm(true)}>
        {t("addPension")}
      </Button>
    );
  }

  return (
    <PensionForm
      action={createPensionAction}
      onDone={() => {
        setShowForm(false);
        onDone();
      }}
      t={t}
    />
  );
}
