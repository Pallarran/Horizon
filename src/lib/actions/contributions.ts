"use server";

import { requireAuth } from "@/lib/auth/middleware";
import { scopedPrisma } from "@/lib/db/scoped";
import {
  upsertContributionYear,
  type ContributionYearRow,
} from "@/lib/contributions/compute";

export interface ContributionActionState {
  error?: string;
  success?: boolean;
  rows?: ContributionYearRow[];
}

/**
 * Server action to save a contribution year row.
 * Amounts arrive as dollar strings from the form; converted to cents.
 */
export async function saveContributionYearAction(
  _prev: ContributionActionState,
  formData: FormData,
): Promise<ContributionActionState> {
  const { user } = await requireAuth();
  const db = scopedPrisma(user.id);

  const year = Number(formData.get("year"));
  if (!year || year < 2009 || year > new Date().getFullYear()) {
    return { error: "Invalid year" };
  }

  function dollarsToCentsNum(key: string): number {
    const val = formData.get(key);
    if (!val || val === "") return 0;
    const dollars = parseFloat(String(val));
    if (isNaN(dollars)) return 0;
    return Math.round(dollars * 100);
  }

  try {
    const rows = await upsertContributionYear(db, user.id, user.birthYear, {
      year,
      reerLimitCents: dollarsToCentsNum("reerLimit"),
      reerContributionCents: dollarsToCentsNum("reerContribution"),
      celiLimitCents: dollarsToCentsNum("celiLimit"),
      celiContributionCents: dollarsToCentsNum("celiContribution"),
      margeContributionCents: dollarsToCentsNum("margeContribution"),
      crcdContributionCents: dollarsToCentsNum("crcdContribution"),
      notes: (formData.get("notes") as string) || null,
    });

    return { success: true, rows };
  } catch (err) {
    return { error: String(err) };
  }
}
