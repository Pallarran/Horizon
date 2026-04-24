"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/middleware";
import { scopedPrisma } from "@/lib/db/scoped";
import { prisma } from "@/lib/db/prisma";
import { dollarsToCents } from "@/lib/money/arithmetic";

export interface CrcdHoldingActionState {
  error?: string;
  success?: boolean;
}

export interface SerializedCrcdHolding {
  id: string;
  accountId: string;
  accountName: string;
  purchaseYear: number;
  quantity: number;
  averagePriceCents: number;
  redemptionEligibleDate: string;
  notes: string | null;
}

/**
 * Ensure a CRCD Account exists for the given user.
 * Returns the account ID.
 */
async function ensureCrcdAccount(userId: string): Promise<string> {
  const existing = await prisma.account.findFirst({
    where: { userId, type: "CRCD" },
  });
  if (existing) return existing.id;

  const account = await prisma.account.create({
    data: {
      userId,
      name: "CRCD – Desjardins",
      type: "CRCD",
      currency: "CAD",
    },
  });
  return account.id;
}

/**
 * Ensure a CRCD Security record exists (symbol "CRCD", exchange "DESJARDINS").
 * Returns the security ID.
 */
async function ensureCrcdSecurity(): Promise<string> {
  const existing = await prisma.security.findUnique({
    where: { symbol_exchange: { symbol: "CRCD", exchange: "DESJARDINS" } },
  });
  if (existing) return existing.id;

  const security = await prisma.security.create({
    data: {
      symbol: "CRCD",
      exchange: "DESJARDINS",
      name: "Capital régional et coopératif Desjardins",
      currency: "CAD",
      assetClass: "CRCD_SHARE",
      dataSource: "MANUAL",
    },
  });
  return security.id;
}

/**
 * Fetch all CRCD holdings for the authenticated user.
 */
export async function getCrcdHoldingsAction(): Promise<SerializedCrcdHolding[]> {
  const { user } = await requireAuth();
  const db = scopedPrisma(user.id);

  const holdings = await db.crcdHolding.findMany({
    orderBy: { purchaseYear: "desc" } as never,
  });

  if (holdings.length === 0) return [];

  const accountIds = [...new Set(holdings.map((h) => h.accountId))];
  const accounts = await prisma.account.findMany({
    where: { id: { in: accountIds } },
  });
  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));

  return holdings.map((h) => ({
    id: h.id,
    accountId: h.accountId,
    accountName: accountMap.get(h.accountId) ?? "Unknown",
    purchaseYear: h.purchaseYear,
    quantity: Number(h.quantity),
    averagePriceCents: Number(h.averagePriceCents),
    redemptionEligibleDate: h.redemptionEligibleDate.toISOString().split("T")[0]!,
    notes: h.notes,
  }));
}

/**
 * Create or update a CRCD holding tranche.
 */
export async function saveCrcdHoldingAction(
  _prev: CrcdHoldingActionState,
  formData: FormData,
): Promise<CrcdHoldingActionState> {
  const { user } = await requireAuth();
  const db = scopedPrisma(user.id);

  const id = formData.get("id") as string | null;
  let accountId = (formData.get("accountId") as string) || "";
  const purchaseYear = Number(formData.get("purchaseYear"));
  const quantity = parseFloat(String(formData.get("quantity") ?? "0"));
  const priceDollars = parseFloat(String(formData.get("priceDollars") ?? "0"));
  const redemptionDate = formData.get("redemptionDate") as string;
  const notes = (formData.get("notes") as string) || null;

  // Auto-create CRCD account if none provided
  if (!accountId) {
    accountId = await ensureCrcdAccount(user.id);
  }
  if (!purchaseYear || purchaseYear < 2001 || purchaseYear > new Date().getFullYear()) {
    return { error: "Invalid purchase year" };
  }
  if (isNaN(quantity) || quantity <= 0) return { error: "Quantity must be positive" };
  if (isNaN(priceDollars) || priceDollars <= 0) return { error: "Price must be positive" };
  if (!redemptionDate) return { error: "Redemption date is required" };

  const averagePriceCents = dollarsToCents(priceDollars);

  // Ensure CRCD security exists
  await ensureCrcdSecurity();

  const data = {
    accountId,
    purchaseYear,
    quantity,
    averagePriceCents,
    redemptionEligibleDate: new Date(redemptionDate),
    notes,
  };

  try {
    if (id) {
      await db.crcdHolding.update({
        where: { id },
        data,
      });
    } else {
      await db.crcdHolding.create({ data });
    }
  } catch {
    return { error: id ? "Tranche not found" : "Failed to create tranche" };
  }

  revalidatePath("/holdings");
  revalidatePath("/contributions");
  return { success: true };
}

/**
 * Delete a CRCD holding tranche.
 */
export async function deleteCrcdHoldingAction(
  id: string,
): Promise<CrcdHoldingActionState> {
  const { user } = await requireAuth();
  const db = scopedPrisma(user.id);

  try {
    await db.crcdHolding.delete({ where: { id } });
  } catch {
    return { error: "Tranche not found" };
  }

  revalidatePath("/holdings");
  revalidatePath("/contributions");
  return { success: true };
}

/**
 * Update the CRCD share price.
 * Stores as both Security.manualPrice AND a Price record for today.
 */
export async function updateCrcdPriceAction(
  priceDollars: number,
): Promise<CrcdHoldingActionState> {
  await requireAuth();

  if (isNaN(priceDollars) || priceDollars <= 0) {
    return { error: "Price must be positive" };
  }

  const securityId = await ensureCrcdSecurity();
  const priceCents = dollarsToCents(priceDollars);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await Promise.all([
    // Update manualPrice on Security
    prisma.security.update({
      where: { id: securityId },
      data: { manualPrice: priceDollars },
    }),
    // Upsert Price record for today
    prisma.price.upsert({
      where: { securityId_date: { securityId, date: today } },
      update: { priceCents, source: "manual" },
      create: { securityId, date: today, priceCents, source: "manual" },
    }),
  ]);

  revalidatePath("/holdings");
  return { success: true };
}
