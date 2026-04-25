"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/middleware";
import { scopedPrisma } from "@/lib/db/scoped";
import {
  computeContributionTable,
  type ContributionYearRow,
} from "@/lib/contributions/compute";
import { prisma } from "@/lib/db/prisma";

export interface ContributionActionState {
  error?: string;
  success?: boolean;
  rows?: ContributionYearRow[];
}

/** Minimum year — users can start from age 18. */
const MIN_YEAR = 1970;

/**
 * Save the user's REER limit for a given year.
 * The REER limit is salary-based and comes from the Notice of Assessment.
 */
export async function saveReerLimitAction(
  _prev: ContributionActionState,
  formData: FormData,
): Promise<ContributionActionState> {
  const { user } = await requireAuth();

  const year = Number(formData.get("year"));
  if (!year || year < MIN_YEAR || year > new Date().getFullYear()) {
    return { error: "Invalid year" };
  }

  const limitDollars = parseFloat(String(formData.get("limitDollars") ?? "0"));
  if (isNaN(limitDollars) || limitDollars < 0) {
    return { error: "Invalid limit" };
  }

  const limitCents = Math.round(limitDollars * 100);

  await prisma.contributionYear.upsert({
    where: { userId_year: { userId: user.id, year } },
    update: { reerLimitCents: limitCents },
    create: {
      userId: user.id,
      year,
      age: year - user.birthYear,
      reerLimitCents: limitCents,
    },
  });

  const db = scopedPrisma(user.id);
  const rows = await computeContributionTable(db, user.birthYear);
  revalidatePath("/portfolio");
  return { success: true, rows };
}

/**
 * Save the user's CRCD limit for a given year.
 * 0 = not participating in CRCD. The limit varies year to year.
 */
export async function saveCrcdLimitAction(
  _prev: ContributionActionState,
  formData: FormData,
): Promise<ContributionActionState> {
  const { user } = await requireAuth();

  const year = Number(formData.get("year"));
  if (!year || year < MIN_YEAR || year > new Date().getFullYear()) {
    return { error: "Invalid year" };
  }

  const limitDollars = parseFloat(String(formData.get("limitDollars") ?? "0"));
  if (isNaN(limitDollars) || limitDollars < 0) {
    return { error: "Invalid limit" };
  }

  const limitCents = Math.round(limitDollars * 100);

  await prisma.contributionYear.upsert({
    where: { userId_year: { userId: user.id, year } },
    update: { crcdLimitCents: limitCents },
    create: {
      userId: user.id,
      year,
      age: year - user.birthYear,
      crcdLimitCents: limitCents,
    },
  });

  const db = scopedPrisma(user.id);
  const rows = await computeContributionTable(db, user.birthYear);
  revalidatePath("/portfolio");
  return { success: true, rows };
}

/**
 * Save the user's annual savings goal for a given year.
 * Goals carry forward automatically to future years.
 */
export async function saveSavingsGoalAction(
  _prev: ContributionActionState,
  formData: FormData,
): Promise<ContributionActionState> {
  const { user } = await requireAuth();

  const year = Number(formData.get("year"));
  if (!year || year < MIN_YEAR || year > new Date().getFullYear()) {
    return { error: "Invalid year" };
  }

  const goalDollars = parseFloat(String(formData.get("goalDollars") ?? "0"));
  if (isNaN(goalDollars) || goalDollars < 0) {
    return { error: "Invalid goal" };
  }

  const goalCents = Math.round(goalDollars * 100);

  await prisma.contributionYear.upsert({
    where: { userId_year: { userId: user.id, year } },
    update: { savingsGoalCents: goalCents },
    create: {
      userId: user.id,
      year,
      age: year - user.birthYear,
      savingsGoalCents: goalCents,
    },
  });

  const db = scopedPrisma(user.id);
  const rows = await computeContributionTable(db, user.birthYear);
  revalidatePath("/portfolio");
  return { success: true, rows };
}
