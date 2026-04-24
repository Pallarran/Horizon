import { z } from "zod/v4";

/* ── Helper: percentage input (user enters 1.5, stored as 0.015) ── */

const pct = (min: number, max: number) =>
  z.coerce.number().min(min).max(max).transform((v) => v / 100);

/* ── Bridge & indexation fields shared across DB types ── */

const bridgeFields = {
  bridgeBenefitDollars: z.coerce.number().nonnegative().optional().default(0),
  bridgeEndAge: z.coerce.number().int().min(55).max(75).optional().default(65),
  indexationRate: pct(0, 10).optional().default(0),
};

/* ── DB Formula schema ── */

const dbFormulaSchema = z.object({
  planType: z.literal("DB_FORMULA"),
  name: z.string().min(1, "Name is required").max(100),
  startYear: z.coerce.number().int().min(1950).max(2100),
  baseAccrualRate: pct(0.1, 10),
  salaryBasisDollars: z.coerce.number().positive("Salary is required"),
  normalRetirementAge: z.coerce.number().int().min(50).max(75).default(65),
  earlyRetirementReduction: pct(0, 100).default(4),
  ...bridgeFields,
});

/* ── DB Statement schema ── */

const dbStatementSchema = z.object({
  planType: z.literal("DB_STATEMENT"),
  name: z.string().min(1, "Name is required").max(100),
  statementAnnualDollars: z.coerce.number().positive("Statement amount is required"),
  statementRetirementAge: z.coerce.number().int().min(50).max(75),
  earlyRetirementReduction: pct(0, 100).optional().default(0),
  ...bridgeFields,
});

/* ── DC schema ── */

const dcSchema = z.object({
  planType: z.literal("DC"),
  name: z.string().min(1, "Name is required").max(100),
  currentBalanceDollars: z.coerce.number().nonnegative(),
  employeeContribRate: pct(0, 100),
  employerContribRate: pct(0, 100),
  dcSalaryDollars: z.coerce.number().positive("Salary is required"),
  assumedGrowthRate: pct(-5, 15).default(5),
});

/* ── Discriminated union ── */

export const createPensionSchema = z.discriminatedUnion("planType", [
  dbFormulaSchema,
  dbStatementSchema,
  dcSchema,
]);

export type CreatePensionInput = z.infer<typeof createPensionSchema>;

/* ── Existing schemas (unchanged) ── */

export const createScenarioSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  retirementAge: z.coerce.number().int().min(30).max(80),
  targetIncomeReplacement: z.coerce.number().min(0).max(2).default(0.7),
  assumedPriceGrowth: z.coerce.number().min(-0.1).max(0.3).default(0.02),
  assumedDividendGrowth: z.coerce.number().min(-0.1).max(0.3).default(0.01),
  assumedInflation: z.coerce.number().min(0).max(0.2).default(0.025),
  monthlyContributionDollars: z.coerce.number().nonnegative().default(0),
  reinvestDividends: z.coerce.boolean().default(true),
  isBaseline: z.coerce.boolean().default(false),
});

export const createIncomeStreamSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  type: z.enum(["PENSION", "GOVERNMENT_BENEFIT", "RENTAL", "OTHER"]),
  startAge: z.coerce.number().int().min(18).max(100),
  endAge: z.coerce.number().int().min(18).max(120).nullable().default(null),
  annualAmountDollars: z.coerce.number().nonnegative().nullable().default(null),
  computedFromPensionId: z.string().nullable().default(null),
  inflationIndexed: z.coerce.boolean().default(true),
  notes: z.string().max(500).optional(),
});
