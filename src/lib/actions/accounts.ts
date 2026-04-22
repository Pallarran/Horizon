"use server";

import { requireAuth } from "@/lib/auth/middleware";
import { scopedPrisma } from "@/lib/db/scoped";
import { createAccountSchema } from "@/lib/validators/account";

export interface AccountActionState {
  error?: string;
  success?: boolean;
}

export async function createAccountAction(
  _prev: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const { user } = await requireAuth();
  const db = scopedPrisma(user.id);

  const raw = {
    name: formData.get("name"),
    type: formData.get("type"),
    currency: formData.get("currency"),
    externalId: formData.get("externalId") || undefined,
  };

  const result = createAccountSchema.safeParse(raw);
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid input" };
  }

  // scopedPrisma.create injects userId via withUserId
  await db.account.create({ data: result.data as never });
  return { success: true };
}

export async function deleteAccountAction(id: string): Promise<AccountActionState> {
  const { user } = await requireAuth();
  const db = scopedPrisma(user.id);

  // Check for existing transactions
  const txnCount = await db.transaction.findMany({
    where: { accountId: id },
  });
  if (txnCount.length > 0) {
    return { error: "Cannot delete account with existing transactions. Delete transactions first." };
  }

  try {
    await db.account.delete({ where: { id } });
  } catch {
    return { error: "Account not found" };
  }

  return { success: true };
}

export async function getAccountsAction() {
  const { user } = await requireAuth();
  const db = scopedPrisma(user.id);
  return db.account.findMany({ orderBy: { orderIndex: "asc" } });
}
