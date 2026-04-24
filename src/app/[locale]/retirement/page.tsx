import { requireAuth } from "@/lib/auth/middleware";
import { scopedPrisma } from "@/lib/db/scoped";
import { Header } from "@/components/layout/Header";
import { PensionCalculator } from "@/components/retirement/PensionCalculator";

export const dynamic = "force-dynamic";

export default async function RetirementPage() {
  const { user } = await requireAuth();
  const locale = user.locale;
  const db = scopedPrisma(user.id);

  const pensionsRaw = await db.pension.findMany({
    where: { isActive: true },
  });

  const pensions = pensionsRaw.map((p) => ({
    id: p.id,
    name: p.name,
    planType: p.planType as "DB_FORMULA" | "DB_STATEMENT" | "DC",
    isActive: p.isActive,
    // DB_FORMULA
    startYear: p.startYear,
    baseAccrualRate: p.baseAccrualRate !== null ? Number(p.baseAccrualRate) : null,
    earlyRetirementReduction: p.earlyRetirementReduction !== null ? Number(p.earlyRetirementReduction) : null,
    normalRetirementAge: p.normalRetirementAge,
    salaryBasisCents: p.salaryBasisCents !== null ? Number(p.salaryBasisCents) : null,
    // DB_STATEMENT
    statementAnnualCents: p.statementAnnualCents !== null ? Number(p.statementAnnualCents) : null,
    statementRetirementAge: p.statementRetirementAge,
    // Shared DB
    bridgeBenefitCents: p.bridgeBenefitCents !== null ? Number(p.bridgeBenefitCents) : null,
    bridgeEndAge: p.bridgeEndAge,
    indexationRate: p.indexationRate !== null ? Number(p.indexationRate) : null,
    // DC
    currentBalanceCents: p.currentBalanceCents !== null ? Number(p.currentBalanceCents) : null,
    employeeContribRate: p.employeeContribRate !== null ? Number(p.employeeContribRate) : null,
    employerContribRate: p.employerContribRate !== null ? Number(p.employerContribRate) : null,
    dcSalaryCents: p.dcSalaryCents !== null ? Number(p.dcSalaryCents) : null,
    assumedGrowthRate: p.assumedGrowthRate !== null ? Number(p.assumedGrowthRate) : null,
  }));

  return (
    <>
      <Header displayName={user.displayName} isAdmin={user.isAdmin} />
      <main className="mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8">
        <PensionCalculator
          pensions={pensions}
          locale={locale}
          retirementAge={user.targetRetirementAge}
          birthYear={user.birthYear}
        />
      </main>
    </>
  );
}
