"use server";

import { requireAuth } from "@/lib/auth/middleware";
import { scopedPrisma } from "@/lib/db/scoped";
import { createTransactionSchema } from "@/lib/validators/transaction";
import { dollarsToCents } from "@/lib/money/arithmetic";

export interface TransactionActionState {
  error?: string;
  success?: boolean;
  transactionId?: string;
}

export async function createTransactionAction(
  _prev: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const { user } = await requireAuth();
  const db = scopedPrisma(user.id);

  const raw = {
    accountId: formData.get("accountId"),
    securityId: formData.get("securityId") || null,
    type: formData.get("type"),
    date: formData.get("date"),
    quantity: formData.get("quantity") || null,
    priceDollars: formData.get("priceDollars") || null,
    amountDollars: formData.get("amountDollars"),
    currency: formData.get("currency"),
    feeDollars: formData.get("feeDollars") || 0,
    note: formData.get("note") || undefined,
  };

  const result = createTransactionSchema.safeParse(raw);
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid input" };
  }

  const { priceDollars, amountDollars, feeDollars, date, quantity, ...rest } = result.data;

  const txn = await db.transaction.create({
    data: {
      ...rest,
      date: new Date(date),
      quantity: quantity,
      priceCents: priceDollars !== null ? dollarsToCents(priceDollars) : null,
      amountCents: dollarsToCents(amountDollars),
      feeCents: dollarsToCents(feeDollars),
    },
  });

  return { success: true, transactionId: txn.id };
}

/**
 * Delete a transaction. Only allowed within 60 seconds of creation.
 */
export async function deleteTransactionAction(
  id: string,
): Promise<TransactionActionState> {
  const { user } = await requireAuth();
  const db = scopedPrisma(user.id);

  // Find the transaction (scoped will verify ownership)
  const transactions = await db.transaction.findMany({
    where: { id },
  });
  const txn = transactions[0];

  if (!txn) {
    return { error: "Transaction not found" };
  }

  // 60-second delete window
  const ageMs = Date.now() - txn.createdAt.getTime();
  const SIXTY_SECONDS = 60 * 1000;
  if (ageMs > SIXTY_SECONDS) {
    return { error: "Deletion window expired (60 seconds). Contact admin to adjust." };
  }

  await db.transaction.delete({ where: { id } });
  return { success: true };
}
