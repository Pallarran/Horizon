import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth/middleware";
import { fetchPrices } from "../../../../../jobs/price-fetch";
import { fetchFxRates } from "../../../../../jobs/fx-fetch";

export async function POST() {
  await requireApiAdmin();

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
