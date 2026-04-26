/**
 * Get the most recent price update timestamp for the "last updated" indicator.
 */
import type { ScopedPrisma } from "@/lib/db/scoped";

export async function getLastPriceDate(
  db: ScopedPrisma,
): Promise<Date | null> {
  const latest = await db.price.findFirst({
    orderBy: { updatedAt: "desc" },
    select: { updatedAt: true },
  });
  return latest?.updatedAt ?? null;
}
