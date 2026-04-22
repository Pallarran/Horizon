import { redirect } from "next/navigation";
import { validateSession } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await validateSession();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <LoginForm />
    </main>
  );
}
