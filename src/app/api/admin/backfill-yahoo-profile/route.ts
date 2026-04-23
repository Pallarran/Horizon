import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth/middleware";
import { backfillYahooProfiles } from "../../../../../jobs/backfill-yahoo-profile";

export async function POST(request: Request) {
  await requireApiAdmin();

  const body = await request.json().catch(() => ({}));
  const securityIds = Array.isArray(body.securityIds) ? body.securityIds : undefined;
  const force = body.force === true;

  try {
    const result = await backfillYahooProfiles(securityIds, force);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: "Yahoo profile backfill failed", details: String(err) },
      { status: 500 },
    );
  }
}
