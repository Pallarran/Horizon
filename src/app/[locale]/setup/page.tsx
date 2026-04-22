import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { SetupForm } from "@/components/auth/SetupForm";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <SetupForm />
    </main>
  );
}
