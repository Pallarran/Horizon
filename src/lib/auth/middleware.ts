import { redirect } from "next/navigation";
import { validateSession } from "./session";
import type { User, Session } from "@/generated/prisma/client";

export type AuthResult = {
  user: User;
  session: Session & { user: User };
};

export async function requireAuth(): Promise<AuthResult> {
  const session = await validateSession();

  if (!session) {
    redirect("/login");
  }

  if (session.user.mustChangePassword) {
    redirect("/change-password");
  }

  return { user: session.user, session };
}

export async function requireAdmin(): Promise<AuthResult> {
  const result = await requireAuth();

  if (!result.user.isAdmin) {
    redirect("/");
  }

  return result;
}

/**
 * For API routes — returns null instead of redirecting.
 */
export async function getApiAuth(): Promise<AuthResult | null> {
  const session = await validateSession();
  if (!session) return null;
  return { user: session.user, session };
}

/**
 * For API routes — returns 401/403 Response instead of redirecting.
 */
export async function requireApiAuth(): Promise<AuthResult> {
  const result = await getApiAuth();
  if (!result) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return result;
}

export async function requireApiAdmin(): Promise<AuthResult> {
  const result = await requireApiAuth();
  if (!result.user.isAdmin) {
    throw new Response("Forbidden", { status: 403 });
  }
  return result;
}
