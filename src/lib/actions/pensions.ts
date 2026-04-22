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

  const { salaryBasisDollars, ...rest } = result.data;

  try {
    await db.pension.create({
      data: {
        ...rest,
        salaryBasisCents: BigInt(Math.round(salaryBasisDollars * 100)),
      } as never,
    });
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

  const { salaryBasisDollars, ...rest } = result.data;

  try {
    await db.pension.update({
      where: { id },
      data: {
        ...rest,
        salaryBasisCents: BigInt(Math.round(salaryBasisDollars * 100)),
      },
    });
    return { success: true };
  } catch (err) {
    return { error: String(err) };
  }
}

export async function getPensionsAction() {
  const { user } = await requireAuth();
  const db = scopedPrisma(user.id);
  const pensions = await db.pension.findMany();
  return pensions.map((p) => ({
    ...p,
    salaryBasisCents: Number(p.salaryBasisCents),
    baseAccrualRate: Number(p.baseAccrualRate),
    earlyRetirementReduction: Number(p.earlyRetirementReduction),
  }));
}
