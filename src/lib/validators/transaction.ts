import { z } from "zod/v4";

export const transactionTypes = [
  "BUY", "SELL", "DIVIDEND", "DRIP", "INTEREST", "FEE",
  "DEPOSIT", "WITHDRAWAL", "TAX_WITHHELD", "SPLIT", "MERGER", "ADJUSTMENT",
  "RETURN_OF_CAPITAL", "FRACTION_CASH",
] as const;

export const createTransactionSchema = z.object({
  accountId: z.string().min(1, "Account is required"),
  securityId: z.string().min(1, "Security is required").nullable(),
  type: z.enum(transactionTypes),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  quantity: z.coerce.number().nonnegative().nullable(),
  priceDollars: z.coerce.number().nonnegative().nullable(),
  amountDollars: z.coerce.number(),
  currency: z.enum(["CAD", "USD"]),
  feeDollars: z.coerce.number().nonnegative().default(0),
  taxWithheldDollars: z.coerce.number().nonnegative().default(0),
  note: z.string().max(500).optional(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export const deleteTransactionSchema = z.object({
  id: z.string().min(1),
});
