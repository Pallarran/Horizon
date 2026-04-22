import { validateSession, deleteSession } from "@/lib/auth/session";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await validateSession();
  if (session) {
    await deleteSession(session.id);
  }
  return NextResponse.json({ ok: true });
}
