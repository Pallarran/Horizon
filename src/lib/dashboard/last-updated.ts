/**
 * Get the most recent price date for the "last updated" indicator.
 */
import type { ScopedPrisma } from "@/lib/db/scoped";

export async function getLastPriceDate(
  db: ScopedPrisma,
): Promise<Date | null> {
  const latest = await db.price.findFirst({
    orderBy: { date: "desc" },
    select: { date: true },
  });
  return latest?.date ?? null;
}
