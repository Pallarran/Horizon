import { z } from "zod/v4";

export const updateSecuritySchema = z.object({
  id: z.string().min(1),
  symbol: z.string().min(1).max(20).transform((s) => s.toUpperCase().trim()),
  exchange: z.string().min(1).max(20),
  name: z.string().min(1).max(200),
  currency: z.enum(["CAD", "USD"]),
  assetClass: z.enum([
    "CANADIAN_EQUITY", "US_EQUITY", "INTERNATIONAL_EQUITY",
    "REIT", "ETF", "BOND", "PREFERRED_SHARE", "CRCD_SHARE", "CASH", "OTHER",
  ]),
  dataSource: z.enum(["YAHOO", "MANUAL", "CRCD_FEED"]),
  delisted: z.boolean(),
  sector: z.string().max(100).nullable(),
  industry: z.string().max(100).nullable(),
  isDividendAristocrat: z.boolean(),
  isDividendKing: z.boolean(),
  isPaysMonthly: z.boolean(),
  manualDividendOverride: z.boolean(),
  annualDividendDollars: z.number().nonnegative().nullable(),
  dividendFrequency: z.enum(["monthly", "quarterly", "semi-annual", "annual"]).nullable(),
  dividendGrowthYears: z.number().int().nonnegative().nullable(),
  manualPrice: z.number().nonnegative().nullable(),
  importNames: z.array(z.string().min(1).max(200)),
  notes: z.string().max(2000).nullable(),
});

export type UpdateSecurityInput = z.infer<typeof updateSecuritySchema>;
