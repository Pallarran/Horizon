"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/dashboard", key: "dashboard" },
  { href: "/holdings", key: "holdings" },
  { href: "/accounts", key: "accounts" },
  { href: "/transactions", key: "transactions" },
  { href: "/contributions", key: "contributions" },
  { href: "/retirement", key: "pension" },
  { href: "/income", key: "income" },
  { href: "/projections", key: "projections" },
  { href: "/watchlist", key: "watchlist" },
] as const;

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
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          {/* Mobile hamburger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="mr-2 h-8 w-8 p-0 md:hidden"
                aria-label="Open menu"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="4" x2="20" y1="12" y2="12" />
                  <line x1="4" x2="20" y1="6" y2="6" />
                  <line x1="4" x2="20" y1="18" y2="18" />
                </svg>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64">
              <SheetHeader>
                <SheetTitle>{tCommon("appName")}</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-2">
                {NAV_LINKS.map(({ href, key }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={`rounded-md px-3 py-2 text-sm transition-colors ${
                      isActive(href)
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    {t(key)}
                  </Link>
                ))}
                <hr className="my-2" />
                <Link
                  href="/settings"
                  onClick={() => setMobileOpen(false)}
                  className={`rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive("/settings")
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  {t("settings")}
                </Link>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    handleLogout();
                  }}
                  className="rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  {tAuth("logout")}
                </button>
              </nav>
            </SheetContent>
          </Sheet>

          <Link href="/dashboard" className="text-lg font-bold">
            {tCommon("appName")}
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 text-sm md:flex">
            {NAV_LINKS.map(({ href, key }) => (
              <Link
                key={href}
                href={href}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  isActive(href)
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:text-primary"
                }`}
              >
                {t(key)}
              </Link>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-4 md:flex">
          <Link
            href="/settings"
            className={`text-sm transition-colors ${
              isActive("/settings")
                ? "font-medium text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
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
