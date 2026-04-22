"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { validateSession } from "@/lib/auth/session";

export type SettingsActionState = {
  error?: string;
  success?: boolean;
} | null;

const LOCALE_COOKIE = "NEXT_LOCALE";
const THEME_COOKIE = "horizon_theme";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

export async function setLocaleCookie(locale: string) {
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "strict",
  });
}

export async function setThemeCookie(theme: string) {
  const cookieStore = await cookies();
  cookieStore.set(THEME_COOKIE, theme, {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "strict",
  });
}

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

  await setLocaleCookie(locale);
  await setThemeCookie(theme);

  redirect("/settings");
}
