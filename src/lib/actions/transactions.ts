"use server";

import { requireAuth } from "@/lib/auth/middleware";
import { scopedPrisma, type ScopedPrisma } from "@/lib/db/scoped";
import { createTransactionSchema } from "@/lib/validators/transaction";
import { dollarsToCents } from "@/lib/money/arithmetic";
import { prisma } from "@/lib/db/prisma";
import { getFxRateForDate } from "@/lib/money/fx";

export interface TransactionActionState {
  error?: string;
  success?: boolean;
  transactionId?: string;
  duplicateWarning?: string;
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
    taxWithheldDollars: formData.get("taxWithheldDollars") || 0,
    note: formData.get("note") || undefined,
  };

  const result = createTransactionSchema.safeParse(raw);
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid input" };
  }

  const { priceDollars, amountDollars, feeDollars, taxWithheldDollars, date, quantity, ...rest } = result.data;
  const amountCents = dollarsToCents(amountDollars);

  // Duplicate detection (skip if user chose "Save anyway")
  const force = formData.get("force") === "1";
  if (!force) {
    const existing = await db.transaction.findMany({
      where: {
        accountId: rest.accountId,
        securityId: rest.securityId,
        type: rest.type as never,
        date: new Date(date),
        amountCents,
      },
    });
    if (existing.length > 0) {
      return {
        duplicateWarning: `${rest.type} · ${date} · $${Math.abs(amountDollars).toFixed(2)}`,
      };
    }
  }

  // Look up historical FX rate for USD transactions
  const txnDate = new Date(date);
  let fxRateAtDate: number | null = null;
  if (rest.currency === "USD") {
    fxRateAtDate = await getFxRateForDate(db, "USD", "CAD", txnDate);
  }

  const txn = await db.transaction.create({
    data: {
      ...rest,
      date: txnDate,
      quantity: quantity,
      priceCents: priceDollars !== null ? dollarsToCents(priceDollars) : null,
      amountCents,
      feeCents: dollarsToCents(feeDollars),
      taxWithheldCents: dollarsToCents(taxWithheldDollars),
      fxRateAtDate,
    },
  });

  return { success: true, transactionId: txn.id };
}

export async function updateTransactionAction(
  _prev: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const { user } = await requireAuth();
  const db = scopedPrisma(user.id);

  const id = formData.get("id") as string;
  if (!id) return { error: "Missing transaction ID" };

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
    taxWithheldDollars: formData.get("taxWithheldDollars") || 0,
    note: formData.get("note") || undefined,
  };

  const result = createTransactionSchema.safeParse(raw);
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid input" };
  }

  const { priceDollars, amountDollars, feeDollars, taxWithheldDollars, date, quantity, ...rest } = result.data;

  // Look up historical FX rate for USD transactions
  const txnDate = new Date(date);
  let fxRateAtDate: number | null = null;
  if (rest.currency === "USD") {
    fxRateAtDate = await getFxRateForDate(db, "USD", "CAD", txnDate);
  }

  try {
    await db.transaction.update({
      where: { id },
      data: {
        ...rest,
        date: txnDate,
        quantity: quantity,
        priceCents: priceDollars !== null ? dollarsToCents(priceDollars) : null,
        amountCents: dollarsToCents(amountDollars),
        feeCents: dollarsToCents(feeDollars),
        taxWithheldCents: dollarsToCents(taxWithheldDollars),
        fxRateAtDate,
      },
    });
  } catch {
    return { error: "Transaction not found" };
  }

  return { success: true };
}

export async function deleteTransactionAction(
  id: string,
): Promise<TransactionActionState> {
  const { user } = await requireAuth();
  const db = scopedPrisma(user.id);

  const transactions = await db.transaction.findMany({
    where: { id },
  });

  if (!transactions[0]) {
    return { error: "Transaction not found" };
  }

  await db.transaction.delete({ where: { id } });
  return { success: true };
}

// --------------- Transaction query for Activities tab ---------------

export interface SerializedTransaction {
  id: string;
  accountId: string;
  accountName: string;
  securityId: string | null;
  securitySymbol: string | null;
  securityName: string | null;
  type: string;
  date: string;
  quantity: number | null;
  priceCents: number | null;
  amountCents: number;
  currency: string;
  feeCents: number;
  taxWithheldCents: number;
  note: string | null;
  createdAt: string;
}

/**
 * Fetch all transactions for the user, enriched with account/security names.
 * Called from the server component, not as a form action.
 */
export async function getTransactions(
  db: ScopedPrisma,
): Promise<SerializedTransaction[]> {
  const transactions = await db.transaction.findMany({
    orderBy: { date: "desc" },
  });

  if (transactions.length === 0) return [];

  const acctIds = [...new Set(transactions.map((t) => t.accountId))];
  const secIds = [
    ...new Set(
      transactions.filter((t) => t.securityId).map((t) => t.securityId!),
    ),
  ];

  const [accounts, securities] = await Promise.all([
    prisma.account.findMany({ where: { id: { in: acctIds } } }),
    secIds.length > 0
      ? prisma.security.findMany({ where: { id: { in: secIds } } })
      : Promise.resolve([]),
  ]);

  const acctMap = new Map(accounts.map((a) => [a.id, a]));
  const secMap = new Map(securities.map((s) => [s.id, s]));

  return transactions.map((t) => ({
    id: t.id,
    accountId: t.accountId,
    accountName: acctMap.get(t.accountId)?.name ?? "Unknown",
    securityId: t.securityId,
    securitySymbol: t.securityId
      ? (secMap.get(t.securityId)?.symbol ?? null)
      : null,
    securityName: t.securityId
      ? (secMap.get(t.securityId)?.name ?? null)
      : null,
    type: t.type,
    date: t.date.toISOString().split("T")[0]!,
    quantity: t.quantity !== null ? Number(t.quantity) : null,
    priceCents: t.priceCents !== null ? Number(t.priceCents) : null,
    amountCents: Number(t.amountCents),
    currency: t.currency,
    feeCents: Number(t.feeCents),
    taxWithheldCents: Number(t.taxWithheldCents),
    note: t.note,
    createdAt: t.createdAt.toISOString(),
  }));
}
