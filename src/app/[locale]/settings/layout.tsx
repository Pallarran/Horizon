import { requireAuth } from "@/lib/auth/middleware";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Header } from "@/components/layout/Header";

export const dynamic = "force-dynamic";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireAuth();
  const t = await getTranslations("settings");

  return (
    <>
      <Header displayName={user.displayName} isAdmin={user.isAdmin} />
      <div className="mx-auto max-w-[1200px] p-6 lg:p-8">
        <h1 className="mb-6 text-2xl font-bold tracking-tight">{t("title")}</h1>

        <div className="flex gap-8">
          <nav className="w-48 shrink-0 space-y-1">
            <NavLink href="/settings/account">{t("account")}</NavLink>
            <NavLink href="/settings/securities">{t("securities")}</NavLink>
            {user.isAdmin && (
              <>
                <NavLink href="/settings/users">{t("users")}</NavLink>
                <NavLink href="/settings/admin">{t("admin")}</NavLink>
              </>
            )}
          </nav>

          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      {children}
    </Link>
  );
}
