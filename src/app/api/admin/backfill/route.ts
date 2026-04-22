import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth/middleware";
import { backfillPrices } from "../../../../../jobs/backfill";

export async function POST(request: Request) {
  await requireApiAdmin();

  const body = await request.json().catch(() => ({}));
  const securityIds = Array.isArray(body.securityIds) ? body.securityIds : undefined;

  try {
    const result = await backfillPrices(securityIds);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: "Backfill failed", details: String(err) },
      { status: 500 },
    );
  }
}
