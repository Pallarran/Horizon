"use client";

import { useState, useActionState, useEffect, useCallback, useRef, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";
import { formatMoney, formatPercent } from "@/lib/money/format";
import { calculatePension, type PensionParams, type PensionResult } from "@/lib/pension/calculate";
import { createPensionAction, updatePensionAction, deletePensionAction } from "@/lib/actions/pensions";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const DELETE_UNDO_DURATION = 10_000;

type PlanType = "DB_FORMULA" | "DB_STATEMENT" | "DC";

interface SerializedPension {
  id: string;
  name: string;
  planType: PlanType;
  isActive: boolean;
  // DB_FORMULA
  startYear: number | null;
  baseAccrualRate: number | null;
  earlyRetirementReduction: number | null;
  normalRetirementAge: number | null;
  salaryBasisCents: number | null;
  // DB_STATEMENT
  statementAnnualCents: number | null;
  statementRetirementAge: number | null;
  // Shared DB
  bridgeBenefitCents: number | null;
  bridgeEndAge: number | null;
  indexationRate: number | null;
  // DC
  currentBalanceCents: number | null;
  employeeContribRate: number | null;
  employerContribRate: number | null;
  dcSalaryCents: number | null;
  assumedGrowthRate: number | null;
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
  const tc = useTranslations("common");
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [editingPension, setEditingPension] = useState<SerializedPension | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SerializedPension | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Optimistic deletes
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(() => new Set());
  const undoRef = useRef<Map<string, boolean>>(new Map());

  const handleDeleteWithUndo = useCallback((pension: SerializedPension) => {
    const id = pension.id;
    setPendingDeletes((prev) => new Set(prev).add(id));
    undoRef.current.set(id, false);

    const finalize = async () => {
      if (undoRef.current.get(id)) {
        undoRef.current.delete(id);
        return;
      }
      undoRef.current.delete(id);
      await deletePensionAction(id);
      startTransition(() => router.refresh());
    };

    toast(t("pensionDeleted"), {
      duration: DELETE_UNDO_DURATION,
      action: {
        label: t("undo"),
        onClick: () => {
          undoRef.current.set(id, true);
          setPendingDeletes((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        },
      },
      onDismiss: finalize,
      onAutoClose: finalize,
    });
  }, [t, router, startTransition]);

  const handleEditSuccess = useCallback(() => {
    setEditingPension(null);
    toast.success(t("pensionUpdated"));
    router.refresh();
  }, [t, router]);

  const handleAddSuccess = useCallback(() => {
    setShowAddForm(false);
    toast.success(t("pensionAdded"));
    router.refresh();
  }, [t, router]);

  const visiblePensions = pensions.filter((p) => !pendingDeletes.has(p.id));

  return (
    <div className="space-y-4">
      {/* Add button at top */}
      <div className="flex justify-end">
        <Button
          onClick={() => setShowAddForm(true)}
          size="icon-sm"
          className="sm:hidden"
        >
          <PlusIcon className="size-4" />
        </Button>
        <Button
          onClick={() => setShowAddForm(true)}
          className="hidden sm:inline-flex"
        >
          {t("addPension")}
        </Button>
      </div>

      {visiblePensions.length === 0 && !showAddForm ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <p className="text-muted-foreground">{t("noPensions")}</p>
        </div>
      ) : (
        visiblePensions.map((pension) => (
          <PensionCard
            key={pension.id}
            pension={pension}
            locale={locale}
            retirementAge={retirementAge}
            birthYear={birthYear}
            onEdit={() => setEditingPension(pension)}
            onDelete={() => setDeleteTarget(pension)}
            t={t}
            tc={tc}
          />
        ))
      )}

      {/* Add pension dialog */}
      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("addPension")}</DialogTitle>
          </DialogHeader>
          <PensionForm
            action={createPensionAction}
            onDone={handleAddSuccess}
            t={t}
            tc={tc}
          />
        </DialogContent>
      </Dialog>

      {/* Edit pension dialog */}
      <Dialog
        open={!!editingPension}
        onOpenChange={(open) => { if (!open) setEditingPension(null); }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{tc("edit")} — {editingPension?.name}</DialogTitle>
          </DialogHeader>
          {editingPension && (
            <PensionForm
              pension={editingPension}
              action={updatePensionAction}
              onDone={handleEditSuccess}
              t={t}
              tc={tc}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={t("deletePensionTitle")}
        description={
          deleteTarget
            ? t("deletePensionDesc", { name: deleteTarget.name })
            : ""
        }
        confirmLabel={tc("delete")}
        cancelLabel={tc("cancel")}
        onConfirm={() => {
          if (deleteTarget) handleDeleteWithUndo(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
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

function planTypeLabel(planType: PlanType, t: ReturnType<typeof useTranslations>): string {
  switch (planType) {
    case "DB_FORMULA": return t("planTypeDbFormula");
    case "DB_STATEMENT": return t("planTypeDbStatement");
    case "DC": return t("planTypeDc");
  }
}

/* ── Pension Card ── */

function PensionCard({
  pension,
  locale,
  retirementAge,
  birthYear,
  onEdit,
  onDelete,
  t,
  tc,
}: {
  pension: SerializedPension;
  locale: string;
  retirementAge: number;
  birthYear: number;
  onEdit: () => void;
  onDelete: () => void;
  t: ReturnType<typeof useTranslations>;
  tc: ReturnType<typeof useTranslations>;
}) {
  const params = buildCalcParams(pension, retirementAge, birthYear);
  const result = params ? calculatePension(params) : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{pension.name}</CardTitle>
            <CardDescription>{planTypeLabel(pension.planType, t)}</CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="19" r="2" />
                </svg>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                {tc("edit")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={onDelete}
              >
                {tc("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        {result ? (
          <PensionResultDisplay
            pension={pension}
            result={result}
            locale={locale}
            retirementAge={retirementAge}
            t={t}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t("incompleteData")}</p>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Result Display (type-specific) ── */

function PensionResultDisplay({
  pension,
  result,
  locale,
  retirementAge,
  t,
}: {
  pension: SerializedPension;
  result: PensionResult;
  locale: string;
  retirementAge: number;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="space-y-4">
      {/* Primary metrics */}
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

        {/* Third metric depends on type */}
        {result.planType === "DB_FORMULA" && result.reductionPercent !== undefined && (
          <div>
            <p className="text-sm text-muted-foreground">{t("reductionApplied")}</p>
            <p className="text-2xl font-bold">
              {formatPercent(result.reductionPercent, locale, 0)}
            </p>
          </div>
        )}
        {result.planType === "DB_STATEMENT" && pension.statementRetirementAge && (
          <div>
            <p className="text-sm text-muted-foreground">{t("statementAge")}</p>
            <p className="text-2xl font-bold">{pension.statementRetirementAge}</p>
          </div>
        )}
        {result.planType === "DC" && result.projectedBalanceCents !== undefined && (
          <div>
            <p className="text-sm text-muted-foreground">{t("projectedBalance")}</p>
            <p className="text-2xl font-bold">
              {formatMoney(result.projectedBalanceCents, locale)}
            </p>
          </div>
        )}
      </div>

      {/* Secondary details */}
      <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
        {result.planType === "DB_FORMULA" && (
          <>
            <div>
              {t("yearsOfService")}: {result.yearsOfService}
            </div>
            <div>
              {t("preReduction")}: {formatMoney(result.preReductionCents ?? 0, locale)}
            </div>
          </>
        )}
        {result.planType === "DB_STATEMENT" && pension.statementRetirementAge !== retirementAge && (
          <div>{t("adjustedForAge", { target: retirementAge, statement: pension.statementRetirementAge ?? 65 })}</div>
        )}
        {result.planType === "DC" && (
          <>
            <div>
              {t("assumedGrowth")}: {formatPercent(pension.assumedGrowthRate ?? 0.05, locale, 1)}
            </div>
            <div>
              {t("withdrawalRate")}: {formatPercent(0.04, locale, 0)}
            </div>
          </>
        )}
      </div>

      {/* Bridge & indexation */}
      {(result.bridgeAnnualCents || result.indexationRate) && (
        <>
          <Separator />
          <div className="grid gap-2 text-sm md:grid-cols-2">
            {result.bridgeAnnualCents && result.bridgeEndAge && (
              <div>
                <span className="text-muted-foreground">{t("bridgeBenefit")}:</span>{" "}
                {formatMoney(result.bridgeAnnualCents, locale)}{t("perYear")}{" "}
                <span className="text-muted-foreground">
                  ({t("bridgeNote", { age: result.bridgeEndAge })})
                </span>
              </div>
            )}
            {result.indexationRate && result.indexationRate > 0 && (
              <div>
                <span className="text-muted-foreground">{t("indexation")}:</span>{" "}
                {t("indexedAt", { rate: formatPercent(result.indexationRate, locale, 1) })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Pension Form (create/edit — now rendered inside a Dialog) ── */

function PensionForm({
  pension,
  action,
  onDone,
  t,
  tc,
}: {
  pension?: SerializedPension;
  action: typeof createPensionAction | typeof updatePensionAction;
  onDone: () => void;
  t: ReturnType<typeof useTranslations>;
  tc: ReturnType<typeof useTranslations>;
}) {
  const [state, formAction, isPending] = useActionState(action, {});
  const [planType, setPlanType] = useState<PlanType>(pension?.planType ?? "DB_FORMULA");

  useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);

  return (
    <form action={formAction} className="space-y-4">
      {pension && <input type="hidden" name="id" value={pension.id} />}
      <input type="hidden" name="planType" value={planType} />

      {/* Name (shared) */}
      <div>
        <Label>{t("pensionName")}</Label>
        <Input name="name" defaultValue={pension?.name ?? ""} required />
      </div>

      {/* Plan type tabs + type-specific fields */}
      <Tabs
        value={planType}
        onValueChange={(v) => setPlanType(v as PlanType)}
      >
        <TabsList className="w-full">
          <TabsTrigger value="DB_FORMULA">{t("planTypeDbFormula")}</TabsTrigger>
          <TabsTrigger value="DB_STATEMENT">{t("planTypeDbStatement")}</TabsTrigger>
          <TabsTrigger value="DC">{t("planTypeDc")}</TabsTrigger>
        </TabsList>

        <TabsContent value="DB_FORMULA" className="space-y-4 pt-2">
          <SectionLabel>{t("planDetails")}</SectionLabel>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>{t("startYear")}</Label>
              <Input
                name="startYear"
                type="number"
                defaultValue={pension?.startYear ?? ""}
                required
              />
            </div>
            <div className="col-span-2">
              <Label>{t("salaryBasis")}</Label>
              <Input
                name="salaryBasisDollars"
                type="number"
                step="0.01"
                defaultValue={pension?.salaryBasisCents ? (pension.salaryBasisCents / 100).toFixed(2) : ""}
                required
              />
            </div>
          </div>

          <SectionLabel>{t("benefitCalculation")}</SectionLabel>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>{t("accrualRate")} (%)</Label>
              <Input
                name="baseAccrualRate"
                type="number"
                step="0.1"
                defaultValue={pension?.baseAccrualRate != null ? +(pension.baseAccrualRate * 100).toFixed(2) : 1.5}
                required
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
              <Label>{t("earlyReduction")} (%)</Label>
              <Input
                name="earlyRetirementReduction"
                type="number"
                step="0.1"
                defaultValue={pension?.earlyRetirementReduction != null ? +(pension.earlyRetirementReduction * 100).toFixed(1) : 4}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="DB_STATEMENT" className="space-y-4 pt-2">
          <SectionLabel>{t("statementDetails")}</SectionLabel>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>{t("statementAmount")}</Label>
              <Input
                name="statementAnnualDollars"
                type="number"
                step="0.01"
                defaultValue={pension?.statementAnnualCents ? (pension.statementAnnualCents / 100).toFixed(2) : ""}
                required
              />
            </div>
            <div>
              <Label>{t("statementAge")}</Label>
              <Input
                name="statementRetirementAge"
                type="number"
                defaultValue={pension?.statementRetirementAge ?? 65}
                required
              />
            </div>
            <div>
              <Label>{t("earlyReduction")} (%)</Label>
              <Input
                name="earlyRetirementReduction"
                type="number"
                step="0.1"
                defaultValue={pension?.earlyRetirementReduction != null && pension.earlyRetirementReduction > 0 ? +(pension.earlyRetirementReduction * 100).toFixed(1) : ""}
                placeholder="4"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="DC" className="space-y-4 pt-2">
          <SectionLabel>{t("accountDetails")}</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("currentBalance")}</Label>
              <Input
                name="currentBalanceDollars"
                type="number"
                step="0.01"
                defaultValue={pension?.currentBalanceCents ? (pension.currentBalanceCents / 100).toFixed(2) : ""}
                required
              />
            </div>
            <div>
              <Label>{t("dcSalary")}</Label>
              <Input
                name="dcSalaryDollars"
                type="number"
                step="0.01"
                defaultValue={pension?.dcSalaryCents ? (pension.dcSalaryCents / 100).toFixed(2) : ""}
                required
              />
            </div>
          </div>

          <SectionLabel>{t("contributionAndGrowth")}</SectionLabel>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>{t("employeeContribRate")} (%)</Label>
              <Input
                name="employeeContribRate"
                type="number"
                step="0.1"
                defaultValue={pension?.employeeContribRate != null ? +(pension.employeeContribRate * 100).toFixed(1) : 5}
                required
              />
            </div>
            <div>
              <Label>{t("employerContribRate")} (%)</Label>
              <Input
                name="employerContribRate"
                type="number"
                step="0.1"
                defaultValue={pension?.employerContribRate != null ? +(pension.employerContribRate * 100).toFixed(1) : 5}
                required
              />
            </div>
            <div>
              <Label>{t("assumedGrowth")} (%)</Label>
              <Input
                name="assumedGrowthRate"
                type="number"
                step="0.1"
                defaultValue={pension?.assumedGrowthRate != null ? +(pension.assumedGrowthRate * 100).toFixed(1) : 5}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Bridge & indexation (DB types only) */}
      {planType !== "DC" && (
        <>
          <Separator />
          <SectionLabel>{t("bridgeAndIndexation")}</SectionLabel>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>{t("bridgeBenefit")}</Label>
              <Input
                name="bridgeBenefitDollars"
                type="number"
                step="0.01"
                defaultValue={pension?.bridgeBenefitCents ? (pension.bridgeBenefitCents / 100).toFixed(2) : "0"}
              />
            </div>
            <div>
              <Label>{t("bridgeEndAge")}</Label>
              <Input
                name="bridgeEndAge"
                type="number"
                defaultValue={pension?.bridgeEndAge ?? 65}
              />
            </div>
            <div>
              <Label>{t("indexation")} (%)</Label>
              <Input
                name="indexationRate"
                type="number"
                step="0.1"
                defaultValue={pension?.indexationRate != null ? +(pension.indexationRate * 100).toFixed(1) : 0}
              />
            </div>
          </div>
        </>
      )}

      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? t("saving") : tc("save")}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          {tc("cancel")}
        </Button>
      </div>
    </form>
  );
}

/* ── Section label helper ── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-medium text-muted-foreground">{children}</p>
  );
}
