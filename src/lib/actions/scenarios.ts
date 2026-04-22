"use server";

import { requireAuth } from "@/lib/auth/middleware";
import { scopedPrisma } from "@/lib/db/scoped";
import { createScenarioSchema } from "@/lib/validators/retirement";

export interface ScenarioActionState {
  error?: string;
  success?: boolean;
}

export async function createScenarioAction(
  _prev: ScenarioActionState,
  formData: FormData,
): Promise<ScenarioActionState> {
  const { user } = await requireAuth();
  const db = scopedPrisma(user.id);

  const raw = Object.fromEntries(formData);
  const result = createScenarioSchema.safeParse(raw);
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid input" };
  }

  const { monthlyContributionDollars, ...rest } = result.data;

  try {
    // If this is baseline, unset any existing baseline
    if (rest.isBaseline) {
      const existing = await db.scenario.findMany({ where: { isBaseline: true } });
      for (const s of existing) {
        await db.scenario.update({
          where: { id: s.id },
          data: { isBaseline: false },
        });
      }
    }

    await db.scenario.create({
      data: {
        ...rest,
        monthlyContributionCents: BigInt(Math.round(monthlyContributionDollars * 100)),
        contributionAllocation: {},
      } as never,
    });
    return { success: true };
  } catch (err) {
    return { error: String(err) };
  }
}

export async function updateScenarioAction(
  _prev: ScenarioActionState,
  formData: FormData,
): Promise<ScenarioActionState> {
  const { user } = await requireAuth();
  const db = scopedPrisma(user.id);

  const id = formData.get("id") as string;
  if (!id) return { error: "Missing scenario ID" };

  const raw = Object.fromEntries(formData);
  const result = createScenarioSchema.safeParse(raw);
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid input" };
  }

  const { monthlyContributionDollars, ...rest } = result.data;

  try {
    if (rest.isBaseline) {
      const existing = await db.scenario.findMany({ where: { isBaseline: true } });
      for (const s of existing) {
        if (s.id !== id) {
          await db.scenario.update({
            where: { id: s.id },
            data: { isBaseline: false },
          });
        }
      }
    }

    await db.scenario.update({
      where: { id },
      data: {
        ...rest,
        monthlyContributionCents: BigInt(Math.round(monthlyContributionDollars * 100)),
      },
    });
    return { success: true };
  } catch (err) {
    return { error: String(err) };
  }
}

export async function deleteScenarioAction(id: string): Promise<ScenarioActionState> {
  const { user } = await requireAuth();
  const db = scopedPrisma(user.id);

  try {
    await db.scenario.delete({ where: { id } });
    return { success: true };
  } catch (err) {
    return { error: String(err) };
  }
}
