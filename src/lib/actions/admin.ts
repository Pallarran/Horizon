"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { validateSession, deleteAllUserSessions } from "@/lib/auth/session";
import { createUserSchema } from "@/lib/validators/auth";

export type AdminActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
} | null;

// ---------------------------------------------------------------------------
// Create user (admin only)
// ---------------------------------------------------------------------------
export async function createUserAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const session = await validateSession();
  if (!session || !session.user.isAdmin) {
    return { error: "Unauthorized" };
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
    temporaryPassword: formData.get("temporaryPassword") as string,
    currentSalaryCents: salaryCents,
  };

  const result = createUserSchema.safeParse(raw);
  if (!result.success) {
    const flat = result.error.flatten();
    return { fieldErrors: flat.fieldErrors as Record<string, string[]> };
  }

  const passwordHash = await hashPassword(result.data.temporaryPassword);

  try {
    await prisma.user.create({
      data: {
        email: result.data.email,
        displayName: result.data.displayName,
        birthYear: result.data.birthYear,
        passwordHash,
        currentSalaryCents: result.data.currentSalaryCents,
        mustChangePassword: true,
        isAdmin: false,
      },
    });
  } catch {
    return { error: "Failed to create user. Email may already be in use." };
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Deactivate user (admin only, cannot deactivate self)
// ---------------------------------------------------------------------------
export async function deactivateUserAction(userId: string): Promise<AdminActionState> {
  const session = await validateSession();
  if (!session || !session.user.isAdmin) {
    return { error: "Unauthorized" };
  }

  if (userId === session.user.id) {
    return { error: "Cannot deactivate your own account." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
  });

  // Kill all their sessions
  await deleteAllUserSessions(userId);

  return { success: true };
}

// ---------------------------------------------------------------------------
// Reactivate user (admin only)
// ---------------------------------------------------------------------------
export async function reactivateUserAction(userId: string): Promise<AdminActionState> {
  const session = await validateSession();
  if (!session || !session.user.isAdmin) {
    return { error: "Unauthorized" };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: true },
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// Reset password (admin only)
// ---------------------------------------------------------------------------
export async function resetPasswordAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const session = await validateSession();
  if (!session || !session.user.isAdmin) {
    return { error: "Unauthorized" };
  }

  const userId = formData.get("userId") as string;
  const newPassword = formData.get("newPassword") as string;

  if (!newPassword || newPassword.length < 12) {
    return { error: "Password must be at least 12 characters." };
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: true },
  });

  // Kill all their sessions so they must re-login
  await deleteAllUserSessions(userId);

  return { success: true };
}
