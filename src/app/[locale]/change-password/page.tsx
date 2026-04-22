import { redirect } from "next/navigation";
import { validateSession } from "@/lib/auth/session";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const session = await validateSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <ChangePasswordForm mustChange={session.user.mustChangePassword} />
    </main>
  );
}
