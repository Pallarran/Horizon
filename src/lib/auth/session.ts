import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";

const SESSION_COOKIE = "horizon_session";
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 1 day

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export async function createSession(
  userId: string,
  userAgent?: string,
  ipAddress?: string,
) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);

  const session = await prisma.session.create({
    data: { userId, token, expiresAt, userAgent, ipAddress },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && process.env.ALLOW_HTTP !== "true",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });

  return session;
}

export async function validateSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) return null;

  // Expired
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  // Inactive user
  if (!session.user.isActive) {
    return null;
  }

  // Sliding expiry: refresh if created more than 1 day ago
  const age = Date.now() - session.createdAt.getTime();
  if (age > REFRESH_THRESHOLD_MS) {
    await prisma.session.update({
      where: { id: session.id },
      data: { expiresAt: new Date(Date.now() + SESSION_MAX_AGE_MS) },
    });
  }

  return session;
}

export async function deleteSession(sessionId: string) {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
}

export async function deleteAllUserSessions(userId: string, exceptSessionId?: string) {
  await prisma.session.deleteMany({
    where: {
      userId,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
  });
}
