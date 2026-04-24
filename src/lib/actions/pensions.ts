"use server";

import { requireAuth } from "@/lib/auth/middleware";
import { scopedPrisma } from "@/lib/db/scoped";
import { createPensionSchema } from "@/lib/validators/retirement";

export interface PensionActionState {
  error?: string;
  success?: boolean;
}

export async function createPensionAction(
  _prev: PensionActionState,
  formData: FormData,
): Promise<PensionActionState> {
  const { user } = await requireAuth();
  const db = scopedPrisma(user.id);

  const raw = Object.fromEntries(formData);
  const result = createPensionSchema.safeParse(raw);
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await db.pension.create({ data: buildPrismaData(result.data) as never });
    return { success: true };
  } catch (err) {
    return { error: String(err) };
  }
}

export async function updatePensionAction(
  _prev: PensionActionState,
  formData: FormData,
): Promise<PensionActionState> {
  const { user } = await requireAuth();
  const db = scopedPrisma(user.id);

  const id = formData.get("id") as string;
  if (!id) return { error: "Missing pension ID" };

  const raw = Object.fromEntries(formData);
  const result = createPensionSchema.safeParse(raw);
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await db.pension.update({ where: { id }, data: buildPrismaData(result.data) });
    return { success: true };
  } catch (err) {
    return { error: String(err) };
  }
}

export async function deletePensionAction(id: string): Promise<PensionActionState> {
  const { user } = await requireAuth();
  const db = scopedPrisma(user.id);

  try {
    await db.pension.delete({ where: { id } });
    return { success: true };
  } catch (err) {
    return { error: String(err) };
  }
}

export async function getPensionsAction() {
  const { user } = await requireAuth();
  const db = scopedPrisma(user.id);
  const pensions = await db.pension.findMany();
  return pensions.map(serializePension);
}

/* ── Helpers ── */

function buildPrismaData(data: ReturnType<typeof createPensionSchema.parse>) {
  const base = { name: data.name, planType: data.planType };

  // Null out fields not relevant to this plan type
  const nullDbFormula = {
    startYear: null,
    baseAccrualRate: null,
    earlyRetirementReduction: null,
    normalRetirementAge: null,
    salaryBasisCents: null,
  };
  const nullDbStatement = {
    statementAnnualCents: null,
    statementRetirementAge: null,
  };
  const nullDc = {
    currentBalanceCents: null,
    employeeContribRate: null,
    employerContribRate: null,
    dcSalaryCents: null,
    assumedGrowthRate: null,
  };
  const nullBridge = {
    bridgeBenefitCents: null,
    bridgeEndAge: null,
    indexationRate: null,
  };

  switch (data.planType) {
    case "DB_FORMULA": {
      const bridgeCents = data.bridgeBenefitDollars
        ? BigInt(Math.round(data.bridgeBenefitDollars * 100))
        : null;
      return {
        ...base,
        ...nullDbStatement,
        ...nullDc,
        startYear: data.startYear,
        baseAccrualRate: data.baseAccrualRate,
        salaryBasisCents: BigInt(Math.round(data.salaryBasisDollars * 100)),
        normalRetirementAge: data.normalRetirementAge,
        earlyRetirementReduction: data.earlyRetirementReduction,
        bridgeBenefitCents: bridgeCents,
        bridgeEndAge: data.bridgeEndAge,
        indexationRate: data.indexationRate,
      };
    }
    case "DB_STATEMENT": {
      const bridgeCents = data.bridgeBenefitDollars
        ? BigInt(Math.round(data.bridgeBenefitDollars * 100))
        : null;
      return {
        ...base,
        ...nullDbFormula,
        ...nullDc,
        statementAnnualCents: BigInt(Math.round(data.statementAnnualDollars * 100)),
        statementRetirementAge: data.statementRetirementAge,
        earlyRetirementReduction: data.earlyRetirementReduction || null,
        bridgeBenefitCents: bridgeCents,
        bridgeEndAge: data.bridgeEndAge,
        indexationRate: data.indexationRate,
      };
    }
    case "DC": {
      return {
        ...base,
        ...nullDbFormula,
        ...nullDbStatement,
        ...nullBridge,
        currentBalanceCents: BigInt(Math.round(data.currentBalanceDollars * 100)),
        employeeContribRate: data.employeeContribRate,
        employerContribRate: data.employerContribRate,
        dcSalaryCents: BigInt(Math.round(data.dcSalaryDollars * 100)),
        assumedGrowthRate: data.assumedGrowthRate,
      };
    }
  }
}

function serializePension(p: {
  id: string;
  name: string;
  planType: string;
  isActive: boolean;
  startYear: number | null;
  baseAccrualRate: unknown;
  earlyRetirementReduction: unknown;
  normalRetirementAge: number | null;
  salaryBasisCents: bigint | null;
  statementAnnualCents: bigint | null;
  statementRetirementAge: number | null;
  bridgeBenefitCents: bigint | null;
  bridgeEndAge: number | null;
  indexationRate: unknown;
  currentBalanceCents: bigint | null;
  employeeContribRate: unknown;
  employerContribRate: unknown;
  dcSalaryCents: bigint | null;
  assumedGrowthRate: unknown;
}) {
  return {
    id: p.id,
    name: p.name,
    planType: p.planType as "DB_FORMULA" | "DB_STATEMENT" | "DC",
    isActive: p.isActive,
    // DB_FORMULA
    startYear: p.startYear,
    baseAccrualRate: p.baseAccrualRate !== null ? Number(p.baseAccrualRate) : null,
    earlyRetirementReduction: p.earlyRetirementReduction !== null ? Number(p.earlyRetirementReduction) : null,
    normalRetirementAge: p.normalRetirementAge,
    salaryBasisCents: p.salaryBasisCents !== null ? Number(p.salaryBasisCents) : null,
    // DB_STATEMENT
    statementAnnualCents: p.statementAnnualCents !== null ? Number(p.statementAnnualCents) : null,
    statementRetirementAge: p.statementRetirementAge,
    // Shared DB
    bridgeBenefitCents: p.bridgeBenefitCents !== null ? Number(p.bridgeBenefitCents) : null,
    bridgeEndAge: p.bridgeEndAge,
    indexationRate: p.indexationRate !== null ? Number(p.indexationRate) : null,
    // DC
    currentBalanceCents: p.currentBalanceCents !== null ? Number(p.currentBalanceCents) : null,
    employeeContribRate: p.employeeContribRate !== null ? Number(p.employeeContribRate) : null,
    employerContribRate: p.employerContribRate !== null ? Number(p.employerContribRate) : null,
    dcSalaryCents: p.dcSalaryCents !== null ? Number(p.dcSalaryCents) : null,
    assumedGrowthRate: p.assumedGrowthRate !== null ? Number(p.assumedGrowthRate) : null,
  };
}
