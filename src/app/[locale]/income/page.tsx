import { requireAuth } from "@/lib/auth/middleware";
import { scopedPrisma } from "@/lib/db/scoped";
import { Header } from "@/components/layout/Header";
import { IncomeStreamManager } from "@/components/income/IncomeStreamManager";

export const dynamic = "force-dynamic";

export default async function IncomePage() {
  const { user } = await requireAuth();
  const db = scopedPrisma(user.id);

  const streamsRaw = await db.incomeStream.findMany();

  const streams = streamsRaw.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    startAge: s.startAge,
    endAge: s.endAge,
    annualAmountCents: s.annualAmountCents ? Number(s.annualAmountCents) : null,
    computedFromPensionId: s.computedFromPensionId,
    inflationIndexed: s.inflationIndexed,
    notes: s.notes,
  }));

  return (
    <>
      <Header displayName={user.displayName} isAdmin={user.isAdmin} />
      <main className="mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8">
        <IncomeStreamManager streams={streams} locale={user.locale} />
      </main>
    </>
  );
}
