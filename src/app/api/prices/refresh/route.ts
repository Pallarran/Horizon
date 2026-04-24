import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { fetchPrices } from "../../../../../jobs/price-fetch";
import { fetchFxRates } from "../../../../../jobs/fx-fetch";

const STALE_MS = 4 * 60 * 60 * 1000; // 4 hours

export async function POST() {
  await requireApiAuth();

  // Check staleness: latest price date vs now
  const latest = await prisma.price.findFirst({
    orderBy: { date: "desc" },
    select: { date: true },
  });

  if (latest) {
    const age = Date.now() - new Date(latest.date).getTime();
    if (age < STALE_MS) {
      return NextResponse.json({ skipped: true });
    }
  }

  try {
    const [prices, fx] = await Promise.all([fetchPrices(), fetchFxRates()]);
    return NextResponse.json({ prices, fx });
  } catch (err) {
    return NextResponse.json(
      { error: "Fetch failed", details: String(err) },
      { status: 500 },
    );
  }
}
