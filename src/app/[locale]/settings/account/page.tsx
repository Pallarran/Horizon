import { requireAuth } from "@/lib/auth/middleware";
import { getTranslations } from "next-intl/server";
import { AccountSettingsForm } from "@/components/settings/AccountSettingsForm";

export default async function AccountSettingsPage() {
  const { user } = await requireAuth();
  const t = await getTranslations("settings");

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">{t("account")}</h2>
      <AccountSettingsForm
        displayName={user.displayName}
        locale={user.locale}
        theme={user.theme}
      />
    </div>
  );
}
