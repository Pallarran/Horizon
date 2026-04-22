"use server";

import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/middleware";
import { createSecuritySchema } from "@/lib/validators/account";
import { dollarsToCents } from "@/lib/money/arithmetic";

export interface SecurityActionState {
  error?: string;
  success?: boolean;
  securityId?: string;
}

export async function createSecurityAction(
  _prev: SecurityActionState,
  formData: FormData,
): Promise<SecurityActionState> {
  await requireAuth();

  const raw = {
    symbol: formData.get("symbol"),
    exchange: formData.get("exchange"),
    name: formData.get("name"),
    currency: formData.get("currency"),
    assetClass: formData.get("assetClass"),
    industry: formData.get("industry") || undefined,
    annualDividendDollars: formData.get("annualDividendDollars") || undefined,
    dividendFrequency: formData.get("dividendFrequency") || undefined,
    dividendGrowthYears: formData.get("dividendGrowthYears") || undefined,
  };

  const result = createSecuritySchema.safeParse(raw);
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid input" };
  }

  const { annualDividendDollars, ...rest } = result.data;

  // Check for duplicate
  const existing = await prisma.security.findUnique({
    where: { symbol_exchange: { symbol: rest.symbol, exchange: rest.exchange } },
  });
  if (existing) {
    return { error: `Security ${rest.symbol} on ${rest.exchange} already exists`, securityId: existing.id };
  }

  const security = await prisma.security.create({
    data: {
      ...rest,
      annualDividendCents: annualDividendDollars ? dollarsToCents(annualDividendDollars) : null,
    },
  });

  return { success: true, securityId: security.id };
}

export async function searchSecuritiesAction(query: string) {
  await requireAuth();

  if (!query || query.length < 1) return [];

  const results = await prisma.security.findMany({
    where: {
      OR: [
        { symbol: { contains: query.toUpperCase(), mode: "insensitive" } },
        { name: { contains: query, mode: "insensitive" } },
      ],
    },
    take: 10,
    orderBy: { symbol: "asc" },
  });

  return results.map((s) => ({
    id: s.id,
    symbol: s.symbol,
    name: s.name,
    exchange: s.exchange,
    currency: s.currency,
  }));
}

export async function getSecuritiesAction() {
  await requireAuth();
  return prisma.security.findMany({ orderBy: { symbol: "asc" } });
}
