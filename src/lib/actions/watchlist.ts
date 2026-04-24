"use server";

import { requireAuth } from "@/lib/auth/middleware";
import { scopedPrisma } from "@/lib/db/scoped";
import { prisma } from "@/lib/db/prisma";
import {
  addToWatchlistSchema,
  updateWatchlistItemSchema,
} from "@/lib/validators/watchlist";

export interface WatchlistActionState {
  error?: string;
  success?: boolean;
}

export async function addToWatchlistAction(
  _prev: WatchlistActionState,
  formData: FormData,
): Promise<WatchlistActionState> {
  const { user } = await requireAuth();
  const db = scopedPrisma(user.id);

  const raw = Object.fromEntries(formData);
  const result = addToWatchlistSchema.safeParse(raw);
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await db.watchlistItem.create({
      data: {
        securityId: result.data.securityId,
        targetBuyPriceCents: result.data.targetBuyPriceDollars
          ? BigInt(Math.round(result.data.targetBuyPriceDollars * 100))
          : null,
        note: result.data.note || null,
      } as never,
    });
    return { success: true };
  } catch {
    return { error: "Already on watchlist" };
  }
}

export async function updateWatchlistItemAction(
  _prev: WatchlistActionState,
  formData: FormData,
): Promise<WatchlistActionState> {
  const { user } = await requireAuth();
  const db = scopedPrisma(user.id);

  const raw = Object.fromEntries(formData);
  const result = updateWatchlistItemSchema.safeParse(raw);
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const { id, targetBuyPriceDollars, note } = result.data;
    await db.watchlistItem.update({
      where: { id },
      data: {
        targetBuyPriceCents:
          targetBuyPriceDollars != null
            ? BigInt(Math.round(targetBuyPriceDollars * 100))
            : null,
        note: note ?? null,
      },
    });
    return { success: true };
  } catch {
    return { error: "Update failed" };
  }
}

export async function removeFromWatchlistAction(
  id: string,
): Promise<WatchlistActionState> {
  const { user } = await requireAuth();
  const db = scopedPrisma(user.id);

  try {
    await db.watchlistItem.delete({ where: { id } });
    return { success: true };
  } catch {
    return { error: "Not found" };
  }
}

export async function getWatchlistAction() {
  const { user } = await requireAuth();
  const db = scopedPrisma(user.id);

  const items = await db.watchlistItem.findMany({
    orderBy: { addedAt: "desc" },
  });

  if (items.length === 0) return [];

  // Fetch securities in a separate query
  const secIds = [...new Set(items.map((i) => i.securityId))];
  const securities = await prisma.security.findMany({
    where: { id: { in: secIds } },
  });
  const secMap = new Map(securities.map((s) => [s.id, s]));

  return items.map((item) => {
    const sec = secMap.get(item.securityId)!;
    return {
      id: item.id,
      securityId: item.securityId,
      symbol: sec.symbol,
      name: sec.name,
      exchange: sec.exchange,
      currency: sec.currency,
      assetClass: sec.assetClass,
      targetBuyPriceCents: item.targetBuyPriceCents
        ? Number(item.targetBuyPriceCents)
        : null,
      note: item.note,
      addedAt: item.addedAt.toISOString(),
      annualDividendCents: sec.annualDividendCents
        ? Number(sec.annualDividendCents)
        : null,
      sector: sec.sector,
      industry: sec.industry,
      dividendFrequency: sec.dividendFrequency,
      dividendGrowthYears: sec.dividendGrowthYears,
      isDividendAristocrat: sec.isDividendAristocrat,
      isDividendKing: sec.isDividendKing,
      isPaysMonthly: sec.isPaysMonthly,
    };
  });
}

export type SerializedWatchlistItem = Awaited<
  ReturnType<typeof getWatchlistAction>
>[number];
