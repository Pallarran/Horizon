import { requireAuth } from "@/lib/auth/middleware";
import { redirect } from "next/navigation";
import { FetchPricesButton } from "@/components/dashboard/FetchPricesButton";
import { BackfillProfilesButton } from "@/components/dashboard/BackfillProfilesButton";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { user } = await requireAuth();
  if (!user.isAdmin) redirect("/settings/account");

  const t = await getTranslations("settings");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t("admin")}</h2>
        <p className="text-sm text-muted-foreground">{t("adminDescription")}</p>
      </div>

      <div className="space-y-4">
        <FetchPricesButton />
        <BackfillProfilesButton />
      </div>
    </div>
  );
}
