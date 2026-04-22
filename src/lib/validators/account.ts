import { z } from "zod/v4";

export const accountTypes = [
  "CELI", "REER", "MARGE", "CRCD", "CASH", "OTHER",
] as const;

export const createAccountSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  type: z.enum(accountTypes),
  currency: z.enum(["CAD", "USD"]),
  externalId: z.string().max(50).optional(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const createSecuritySchema = z.object({
  symbol: z.string().min(1).max(20).transform((s) => s.toUpperCase().trim()),
  exchange: z.string().min(1).max(20),
  name: z.string().min(1).max(200),
  currency: z.enum(["CAD", "USD"]),
  assetClass: z.enum([
    "CANADIAN_EQUITY", "US_EQUITY", "INTERNATIONAL_EQUITY",
    "REIT", "ETF", "BOND", "PREFERRED_SHARE", "CRCD_SHARE", "CASH", "OTHER",
  ]),
  industry: z.string().max(100).optional(),
  annualDividendDollars: z.coerce.number().nonnegative().optional(),
  dividendFrequency: z.enum(["monthly", "quarterly", "semi-annual", "annual"]).optional(),
  dividendGrowthYears: z.coerce.number().int().nonnegative().optional(),
});

export type CreateSecurityInput = z.infer<typeof createSecuritySchema>;
