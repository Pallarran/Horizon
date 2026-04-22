"use server";

import { requireAuth } from "@/lib/auth/middleware";
import { scopedPrisma } from "@/lib/db/scoped";
import { createIncomeStreamSchema } from "@/lib/validators/retirement";

export interface IncomeStreamActionState {
  error?: string;
  success?: boolean;
}

export async function createIncomeStreamAction(
  _prev: IncomeStreamActionState,
  formData: FormData,
): Promise<IncomeStreamActionState> {
  const { user } = await requireAuth();
  const db = scopedPrisma(user.id);

  const raw = Object.fromEntries(formData);
  const result = createIncomeStreamSchema.safeParse(raw);
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid input" };
  }

  const { annualAmountDollars, ...rest } = result.data;

  try {
    await db.incomeStream.create({
      data: {
        ...rest,
        annualAmountCents: annualAmountDollars
          ? BigInt(Math.round(annualAmountDollars * 100))
          : null,
      } as never,
    });
    return { success: true };
  } catch (err) {
    return { error: String(err) };
  }
}

export async function updateIncomeStreamAction(
  _prev: IncomeStreamActionState,
  formData: FormData,
): Promise<IncomeStreamActionState> {
  const { user } = await requireAuth();
  const db = scopedPrisma(user.id);

  const id = formData.get("id") as string;
  if (!id) return { error: "Missing income stream ID" };

  const raw = Object.fromEntries(formData);
  const result = createIncomeStreamSchema.safeParse(raw);
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid input" };
  }

  const { annualAmountDollars, ...rest } = result.data;

  try {
    await db.incomeStream.update({
      where: { id },
      data: {
        ...rest,
        annualAmountCents: annualAmountDollars
          ? BigInt(Math.round(annualAmountDollars * 100))
          : null,
      },
    });
    return { success: true };
  } catch (err) {
    return { error: String(err) };
  }
}

export async function deleteIncomeStreamAction(id: string): Promise<IncomeStreamActionState> {
  const { user } = await requireAuth();
  const db = scopedPrisma(user.id);

  try {
    // Clear computedFromPensionId from existing streams first
    // (in case other streams referenced this one — but this is for IncomeStream, not Pension)
    // Just delete directly
    const existing = await db.incomeStream.findMany();
    const stream = existing.find((s) => s.id === id);
    if (!stream) return { error: "Not found" };

    // Use raw prisma since scoped doesn't have delete for incomeStream
    const { prisma } = await import("@/lib/db/prisma");
    const check = await prisma.incomeStream.findUnique({ where: { id } });
    if (!check || check.userId !== (await requireAuth()).user.id) {
      return { error: "Not found" };
    }
    await prisma.incomeStream.delete({ where: { id } });
    return { success: true };
  } catch (err) {
    return { error: String(err) };
  }
}
