import { z } from "zod/v4";

export const createPensionSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  startYear: z.coerce.number().int().min(1950).max(2100),
  baseAccrualRate: z.coerce.number().min(0).max(1),
  initialBaseYears: z.coerce.number().int().min(0).max(50).default(2),
  earlyRetirementReduction: z.coerce.number().min(0).max(1).default(0.04),
  normalRetirementAge: z.coerce.number().int().min(50).max(75).default(65),
  salaryBasisDollars: z.coerce.number().positive("Salary is required"),
});

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
