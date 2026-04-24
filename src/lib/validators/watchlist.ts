import { z } from "zod/v4";

export const addToWatchlistSchema = z.object({
  securityId: z.string().min(1, "Security is required"),
  targetBuyPriceDollars: z.coerce.number().positive().optional(),
  note: z.string().max(500).optional(),
});

export const updateWatchlistItemSchema = z.object({
  id: z.string().min(1),
  targetBuyPriceDollars: z.coerce.number().positive().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});
