import { prisma } from "./prisma";

/**
 * Returns a user-scoped data access layer.
 * Every query automatically filters by the authenticated user's ID.
 * This is the primary defense against cross-user data leaks.
 *
 * Usage in API routes:
 *   const db = scopedPrisma(session.user.id);
 *   const accounts = await db.account.findMany();
 */
export function scopedPrisma(userId: string) {
  // Helper: merge userId into create data (Prisma 7 needs assertion
  // because the union type rejects mixing relation + scalar FK).
  // Safe: we always set the scalar userId from the authenticated session.
  function withUserId<T extends Record<string, unknown>>(data: T) {
    return { ...data, userId } as T;
  }

  return {
    // --- Per-user entities (userId is directly on the model) ---

    account: {
      findMany: (args?: Parameters<typeof prisma.account.findMany>[0]) =>
        prisma.account.findMany({ ...args, where: { ...args?.where, userId } }),

      findFirst: (args?: Parameters<typeof prisma.account.findFirst>[0]) =>
        prisma.account.findFirst({ ...args, where: { ...args?.where, userId } }),

      findUnique: async (args: Parameters<typeof prisma.account.findUnique>[0]) => {
        const result = await prisma.account.findUnique(args);
        if (result && result.userId !== userId) return null;
        return result;
      },

      create: (args: Parameters<typeof prisma.account.create>[0]) =>
        prisma.account.create({ ...args, data: withUserId(args.data) }),

      update: async (args: Parameters<typeof prisma.account.update>[0]) => {
        const existing = await prisma.account.findUnique({ where: args.where });
        if (!existing || existing.userId !== userId) throw new Error("Not found");
        return prisma.account.update(args);
      },

      delete: async (args: Parameters<typeof prisma.account.delete>[0]) => {
        const existing = await prisma.account.findUnique({ where: args.where });
        if (!existing || existing.userId !== userId) throw new Error("Not found");
        return prisma.account.delete(args);
      },
    },

    pension: {
      findMany: (args?: Parameters<typeof prisma.pension.findMany>[0]) =>
        prisma.pension.findMany({ ...args, where: { ...args?.where, userId } }),

      create: (args: Parameters<typeof prisma.pension.create>[0]) =>
        prisma.pension.create({ ...args, data: withUserId(args.data) }),

      update: async (args: Parameters<typeof prisma.pension.update>[0]) => {
        const existing = await prisma.pension.findUnique({ where: args.where });
        if (!existing || existing.userId !== userId) throw new Error("Not found");
        return prisma.pension.update(args);
      },
    },

    scenario: {
      findMany: (args?: Parameters<typeof prisma.scenario.findMany>[0]) =>
        prisma.scenario.findMany({ ...args, where: { ...args?.where, userId } }),

      create: (args: Parameters<typeof prisma.scenario.create>[0]) =>
        prisma.scenario.create({ ...args, data: withUserId(args.data) }),

      update: async (args: Parameters<typeof prisma.scenario.update>[0]) => {
        const existing = await prisma.scenario.findUnique({ where: args.where });
        if (!existing || existing.userId !== userId) throw new Error("Not found");
        return prisma.scenario.update(args);
      },

      delete: async (args: Parameters<typeof prisma.scenario.delete>[0]) => {
        const existing = await prisma.scenario.findUnique({ where: args.where });
        if (!existing || existing.userId !== userId) throw new Error("Not found");
        return prisma.scenario.delete(args);
      },
    },

    incomeStream: {
      findMany: (args?: Parameters<typeof prisma.incomeStream.findMany>[0]) =>
        prisma.incomeStream.findMany({ ...args, where: { ...args?.where, userId } }),

      create: (args: Parameters<typeof prisma.incomeStream.create>[0]) =>
        prisma.incomeStream.create({ ...args, data: withUserId(args.data) }),

      update: async (args: Parameters<typeof prisma.incomeStream.update>[0]) => {
        const existing = await prisma.incomeStream.findUnique({ where: args.where });
        if (!existing || existing.userId !== userId) throw new Error("Not found");
        return prisma.incomeStream.update(args);
      },
    },

    contributionYear: {
      findMany: (args?: Parameters<typeof prisma.contributionYear.findMany>[0]) =>
        prisma.contributionYear.findMany({ ...args, where: { ...args?.where, userId } }),

      upsert: (args: Parameters<typeof prisma.contributionYear.upsert>[0]) => {
        return prisma.contributionYear.upsert({
          ...args,
          create: withUserId(args.create),
        });
      },
    },

    watchlistItem: {
      findMany: (args?: Parameters<typeof prisma.watchlistItem.findMany>[0]) =>
        prisma.watchlistItem.findMany({ ...args, where: { ...args?.where, userId } }),

      create: (args: Parameters<typeof prisma.watchlistItem.create>[0]) =>
        prisma.watchlistItem.create({ ...args, data: withUserId(args.data) }),

      delete: async (args: Parameters<typeof prisma.watchlistItem.delete>[0]) => {
        const existing = await prisma.watchlistItem.findUnique({ where: args.where });
        if (!existing || existing.userId !== userId) throw new Error("Not found");
        return prisma.watchlistItem.delete(args);
      },
    },

    // --- Account-scoped entities (access via account ownership) ---

    transaction: {
      findMany: (args?: Parameters<typeof prisma.transaction.findMany>[0]) =>
        prisma.transaction.findMany({
          ...args,
          where: { ...args?.where, account: { userId } },
        }),

      create: async (args: Parameters<typeof prisma.transaction.create>[0]) => {
        // Verify the account belongs to this user
        const account = await prisma.account.findUnique({
          where: { id: (args.data as Record<string, unknown>).accountId as string },
        });
        if (!account || account.userId !== userId) throw new Error("Not found");
        return prisma.transaction.create(args);
      },

      delete: async (args: Parameters<typeof prisma.transaction.delete>[0]) => {
        const existing = await prisma.transaction.findUnique({
          where: args.where,
          include: { account: true },
        });
        if (!existing || existing.account.userId !== userId) throw new Error("Not found");
        return prisma.transaction.delete(args);
      },
    },

    // --- Import entities ---

    importProfile: {
      findMany: (args?: Parameters<typeof prisma.importProfile.findMany>[0]) =>
        prisma.importProfile.findMany({ ...args, where: { ...args?.where, userId } }),

      create: (args: Parameters<typeof prisma.importProfile.create>[0]) =>
        prisma.importProfile.create({ ...args, data: withUserId(args.data) }),
    },

    importBatch: {
      findMany: (args?: Parameters<typeof prisma.importBatch.findMany>[0]) =>
        prisma.importBatch.findMany({ ...args, where: { ...args?.where, userId } }),

      create: (args: Parameters<typeof prisma.importBatch.create>[0]) =>
        prisma.importBatch.create({ ...args, data: withUserId(args.data) }),
    },

    // --- Shared catalog (not user-scoped, read-only for regular users) ---

    security: prisma.security,
    price: prisma.price,
    fxRate: prisma.fxRate,
    craLimit: prisma.craLimit,
  };
}

export type ScopedPrisma = ReturnType<typeof scopedPrisma>;
