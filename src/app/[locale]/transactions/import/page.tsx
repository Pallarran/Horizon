import { requireAuth } from "@/lib/auth/middleware";
import { scopedPrisma } from "@/lib/db/scoped";
import { Header } from "@/components/layout/Header";
import { ImportWizard } from "@/components/import/ImportWizard";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const { user } = await requireAuth();
  const db = scopedPrisma(user.id);

  const accounts = await db.account.findMany({
    select: { id: true, name: true, currency: true },
    orderBy: { orderIndex: "asc" },
  });

  return (
    <>
      <Header displayName={user.displayName} isAdmin={user.isAdmin} />
      <main className="mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8">
        <ImportWizard
          accounts={accounts.map((a) => ({
            id: a.id,
            name: a.name,
            currency: a.currency,
          }))}
        />
      </main>
    </>
  );
}
