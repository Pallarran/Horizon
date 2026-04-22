"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export function Header({
  displayName,
  isAdmin,
}: {
  displayName: string;
  isAdmin: boolean;
}) {
  const t = useTranslations("nav");
  const tAuth = useTranslations("auth");
  const tCommon = useTranslations("common");
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-lg font-bold">
            {tCommon("appName")}
          </Link>
          <nav className="hidden items-center gap-4 text-sm md:flex">
            <Link
              href="/dashboard"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("dashboard")}
            </Link>
            <Link
              href="/holdings"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("holdings")}
            </Link>
            <Link
              href="/contributions"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("contributions")}
            </Link>
            <Link
              href="/retirement"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("retirement")}
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/settings"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {displayName}
          </Link>
          <button
            onClick={handleLogout}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {tAuth("logout")}
          </button>
        </div>
      </div>
    </header>
  );
}
