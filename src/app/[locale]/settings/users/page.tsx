import { requireAdmin } from "@/lib/auth/middleware";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db/prisma";
import { UserManagement } from "@/components/settings/UserManagement";

export default async function UsersSettingsPage() {
  const { user: currentUser } = await requireAdmin();
  const t = await getTranslations("settings");

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      displayName: true,
      birthYear: true,
      isAdmin: true,
      isActive: true,
      mustChangePassword: true,
      lastLoginAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">{t("users")}</h2>
      <UserManagement users={users} currentUserId={currentUser.id} />
    </div>
  );
}
