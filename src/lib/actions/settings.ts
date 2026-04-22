"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { validateSession } from "@/lib/auth/session";

export type SettingsActionState = {
  error?: string;
  success?: boolean;
} | null;

export async function updateProfileAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const session = await validateSession();
  if (!session) {
    return { error: "Unauthorized" };
  }

  const displayName = formData.get("displayName") as string;
  const locale = formData.get("locale") as string;
  const theme = formData.get("theme") as string;

  if (!displayName?.trim()) {
    return { error: "Display name is required." };
  }

  if (!["fr-CA", "en-CA"].includes(locale)) {
    return { error: "Invalid locale." };
  }

  if (!["light", "dark", "system"].includes(theme)) {
    return { error: "Invalid theme." };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      displayName: displayName.trim(),
      locale,
      theme,
    },
  });

  revalidatePath("/settings/account");

  return { success: true };
}
