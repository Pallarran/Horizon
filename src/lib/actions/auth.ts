"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, validateSession, deleteAllUserSessions } from "@/lib/auth/session";
import { checkRateLimit, resetRateLimit } from "@/lib/auth/rate-limit";
import { loginSchema, setupSchema, changePasswordSchema } from "@/lib/validators/auth";

export type AuthActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
} | null;

// ---------------------------------------------------------------------------
// Setup — first-time admin account creation
// ---------------------------------------------------------------------------
export async function setupAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    return { error: "Setup already completed." };
  }

  const salaryInput = formData.get("currentSalary") as string;
  let salaryCents: bigint;
  try {
    salaryCents = BigInt(Math.round(parseFloat(salaryInput || "0") * 100));
  } catch {
    return { fieldErrors: { currentSalaryCents: ["Invalid salary amount"] } };
  }

  const raw = {
    email: formData.get("email") as string,
    displayName: formData.get("displayName") as string,
    birthYear: parseInt(formData.get("birthYear") as string, 10),
    password: formData.get("password") as string,
    confirmPassword: formData.get("confirmPassword") as string,
    locale: formData.get("locale") as string,
    currentSalaryCents: salaryCents,
    targetRetirementAge: parseInt(formData.get("targetRetirementAge") as string, 10),
  };

  const result = setupSchema.safeParse(raw);
  if (!result.success) {
    const flat = result.error.flatten();
    return { fieldErrors: flat.fieldErrors as Record<string, string[]> };
  }

  const { email, displayName, birthYear, password, locale, currentSalaryCents, targetRetirementAge } =
    result.data;

  const passwordHash = await hashPassword(password);

  let userId: string;
  try {
    const user = await prisma.user.create({
      data: {
        email,
        displayName,
        passwordHash,
        birthYear,
        locale,
        currentSalaryCents,
        targetRetirementAge,
        isAdmin: true,
      },
    });
    userId = user.id;
  } catch {
    return { error: "Failed to create account. Email may already be in use." };
  }

  const headersList = await headers();
  await createSession(userId, headersList.get("user-agent") ?? undefined);

  redirect("/dashboard");
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
export async function loginAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const headersList = await headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    "unknown";

  const { allowed, retryAfterMs } = checkRateLimit(ip);
  if (!allowed) {
    const minutes = Math.ceil(retryAfterMs / 60_000);
    return { error: `Too many attempts. Try again in ${minutes} minute(s).` };
  }

  const raw = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const result = loginSchema.safeParse(raw);
  if (!result.success) {
    const flat = result.error.flatten();
    return { fieldErrors: flat.fieldErrors as Record<string, string[]> };
  }

  const user = await prisma.user.findUnique({ where: { email: result.data.email } });
  if (!user) {
    return { error: "Invalid credentials." };
  }

  const valid = await verifyPassword(user.passwordHash, result.data.password);
  if (!valid) {
    return { error: "Invalid credentials." };
  }

  if (!user.isActive) {
    return { error: "Account is deactivated." };
  }

  resetRateLimit(ip);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await createSession(user.id, headersList.get("user-agent") ?? undefined, ip);

  if (user.mustChangePassword) {
    redirect("/change-password");
  }

  redirect("/dashboard");
}

// ---------------------------------------------------------------------------
// Change password
// ---------------------------------------------------------------------------
export async function changePasswordAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const session = await validateSession();
  if (!session) {
    redirect("/login");
  }

  const raw = {
    currentPassword: formData.get("currentPassword") as string,
    newPassword: formData.get("newPassword") as string,
    confirmNewPassword: formData.get("confirmNewPassword") as string,
  };

  const result = changePasswordSchema.safeParse(raw);
  if (!result.success) {
    const flat = result.error.flatten();
    return { fieldErrors: flat.fieldErrors as Record<string, string[]> };
  }

  const valid = await verifyPassword(session.user.passwordHash, result.data.currentPassword);
  if (!valid) {
    return { error: "Current password is incorrect." };
  }

  const passwordHash = await hashPassword(result.data.newPassword);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash, mustChangePassword: false },
  });

  await deleteAllUserSessions(session.user.id, session.id);

  redirect("/dashboard");
}
