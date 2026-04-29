"use server";

import crypto from "crypto";
import { requireAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { parseDesjardinsXlsx, type ParsedRow, type ParseError } from "@/lib/import/parse-desjardins";
import { dollarsToCents } from "@/lib/money/arithmetic";
import { getFxRateForDate } from "@/lib/money/fx";
import { scopedPrisma } from "@/lib/db/scoped";
import type { TransactionType } from "@/generated/prisma/client";

// ─── Types ───

export interface ResolvedSecurity {
  id: string;
  symbol: string;
  exchange: string;
  name: string;
}

export interface UnknownSecurity {
  strippedSymbol: string;
  rawSymbol: string;
  description: string;
  exchange: string | null;
  rowCount: number;
}

export type RowStatus = "ready" | "needs_resolution" | "duplicate" | "skipped" | "error";

export interface PreviewRow extends ParsedRow {
  status: RowStatus;
  resolvedSecurityId: string | null;
  resolvedSecuritySymbol: string | null;
  duplicateOfId: string | null;
  errorMessage: string | null;
}

export interface ParseImportResult {
  rows: PreviewRow[];
  unknownSecurities: UnknownSecurity[];
  fileChecksum: string;
  existingBatchDate: string | null;
  totalRows: number;
}

export interface CommitImportInput {
  accountId: string;
  fileChecksum: string;
  sourceFilename: string;
  rows: {
    date: string;
    type: TransactionType;
    securityId: string | null;
    quantity: number | null;
    price: number | null;
    amount: number;
    currency: string;
    fee: number;
    taxWithheld: number;
    note: string | null;
  }[];
}

export interface CommitImportResult {
  batchId: string;
  created: number;
  skipped: number;
  errors: number;
}

// ─── Parse Action ───

export async function parseImportFileAction(
  formData: FormData,
): Promise<{ data?: ParseImportResult; error?: string }> {
  const { user } = await requireAuth();

  const file = formData.get("file") as File | null;
  const accountId = formData.get("accountId") as string | null;

  if (!file || !accountId) {
    return { error: "File and account are required" };
  }

  // Verify account ownership
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account || account.userId !== user.id) {
    return { error: "Account not found" };
  }

  // Read file
  const buffer = await file.arrayBuffer();

  // Compute SHA-256 checksum
  const hash = crypto.createHash("sha256");
  hash.update(Buffer.from(buffer));
  const fileChecksum = hash.digest("hex");

  // Check for existing import of same file
  const existingBatch = await prisma.importBatch.findFirst({
    where: { sourceChecksum: fileChecksum, userId: user.id, status: "COMMITTED" },
    orderBy: { createdAt: "desc" },
  });

  // Parse the file
  const parseResult = parseDesjardinsXlsx(buffer);

  if (parseResult.rows.length === 0 && parseResult.errors.length > 0) {
    return { error: parseResult.errors[0]?.message ?? "Failed to parse file" };
  }

  // Enrich symbolless rows by matching description against known securities
  // Checks both Security.name and Security.importNames (alternate names from prior imports)
  const symbollessDescs = new Set<string>();
  for (const row of parseResult.rows) {
    if (!row.strippedSymbol && row.description) {
      symbollessDescs.add(row.description);
    }
  }
  if (symbollessDescs.size > 0) {
    const descArray = [...symbollessDescs];
    const matches = await prisma.security.findMany({
      where: {
        OR: [
          { name: { in: descArray, mode: "insensitive" } },
          { importNames: { hasSome: descArray } },
        ],
      },
    });
    const descToSec = new Map<string, { symbol: string; exchange: string }>();
    for (const sec of matches) {
      // Index by canonical name
      descToSec.set(sec.name.toUpperCase(), { symbol: sec.symbol, exchange: sec.exchange });
      // Index by all import aliases
      for (const alias of sec.importNames) {
        descToSec.set(alias.toUpperCase(), { symbol: sec.symbol, exchange: sec.exchange });
      }
    }
    for (const row of parseResult.rows) {
      if (!row.strippedSymbol && row.description) {
        const match = descToSec.get(row.description.toUpperCase().trim());
        if (match) {
          row.strippedSymbol = match.symbol;
          row.exchange = match.exchange;
        }
      }
    }
  }

  // Collect unique symbols to look up
  const symbolsToLookup = new Map<string, { exchange: string | null; rawSymbol: string; description: string }>();
  for (const row of parseResult.rows) {
    if (row.strippedSymbol && !symbolsToLookup.has(row.strippedSymbol)) {
      symbolsToLookup.set(row.strippedSymbol, {
        exchange: row.exchange,
        rawSymbol: row.rawSymbol ?? row.strippedSymbol,
        description: row.description,
      });
    }
  }

  // Look up existing securities (strict: symbol + exchange)
  const securityMap = new Map<string, ResolvedSecurity>();
  if (symbolsToLookup.size > 0) {
    const symbols = [...symbolsToLookup.keys()];
    const securities = await prisma.security.findMany({
      where: {
        OR: symbols.map((s) => {
          const info = symbolsToLookup.get(s)!;
          return info.exchange
            ? { symbol: s, exchange: info.exchange }
            : { symbol: s };
        }),
      },
    });

    for (const sec of securities) {
      securityMap.set(sec.symbol, {
        id: sec.id,
        symbol: sec.symbol,
        exchange: sec.exchange,
        name: sec.name,
      });
    }

    // Fallback: symbol-only lookup for any still-missing symbols
    // Handles cases where parser infers "NYSE" but security was created as "NASDAQ"
    const missing = symbols.filter((s) => !securityMap.has(s));
    if (missing.length > 0) {
      const fallback = await prisma.security.findMany({
        where: { symbol: { in: missing } },
      });
      for (const sec of fallback) {
        if (!securityMap.has(sec.symbol)) {
          securityMap.set(sec.symbol, {
            id: sec.id,
            symbol: sec.symbol,
            exchange: sec.exchange,
            name: sec.name,
          });
        }
      }
    }

    // Second fallback: check importNames (aliases) for any still-missing symbols
    // Handles format mismatches like parser "BEP-UN" vs DB "BEP.UN"
    const stillMissing = symbols.filter((s) => !securityMap.has(s));
    if (stillMissing.length > 0) {
      const byAlias = await prisma.security.findMany({
        where: { importNames: { hasSome: stillMissing } },
      });
      for (const sec of byAlias) {
        for (const alias of sec.importNames) {
          if (stillMissing.includes(alias) && !securityMap.has(alias)) {
            securityMap.set(alias, {
              id: sec.id,
              symbol: sec.symbol,
              exchange: sec.exchange,
              name: sec.name,
            });
          }
        }
      }
    }
  }

  // Store import descriptions as aliases on resolved securities (for future matching)
  const aliasUpdates: { id: string; desc: string }[] = [];
  for (const [symbol, info] of symbolsToLookup) {
    const sec = securityMap.get(symbol);
    if (sec && info.description) {
      aliasUpdates.push({ id: sec.id, desc: info.description.trim() });
    }
  }
  if (aliasUpdates.length > 0) {
    const ids = [...new Set(aliasUpdates.map((u) => u.id))];
    const existing = await prisma.security.findMany({
      where: { id: { in: ids } },
      select: { id: true, importNames: true },
    });
    const existingMap = new Map(existing.map((s) => [s.id, new Set(s.importNames)]));
    for (const { id, desc } of aliasUpdates) {
      const names = existingMap.get(id);
      if (names && !names.has(desc)) {
        names.add(desc);
        // Fire-and-forget
        prisma.security.update({
          where: { id },
          data: { importNames: { push: desc } },
        }).catch(() => {});
      }
    }
  }

  // Build unknown securities list
  const unknownSecurities: UnknownSecurity[] = [];
  for (const [symbol, info] of symbolsToLookup) {
    if (!securityMap.has(symbol)) {
      const rowCount = parseResult.rows.filter((r) => r.strippedSymbol === symbol).length;
      unknownSecurities.push({
        strippedSymbol: symbol,
        rawSymbol: info.rawSymbol,
        description: info.description,
        exchange: info.exchange,
        rowCount,
      });
    }
  }

  // Promote symbolless rows that need a security (DIVIDEND, etc.)
  // to "needs resolution" by using their description as a temporary key.
  const SECURITY_TYPES = new Set(["BUY", "SELL", "DIVIDEND", "DRIP", "SPLIT", "MERGER", "RETURN_OF_CAPITAL", "FRACTION_CASH", "PHANTOM_DISTRIBUTION"]);
  const descGroupCounts = new Map<string, number>();
  for (const row of parseResult.rows) {
    if (!row.strippedSymbol && SECURITY_TYPES.has(row.type) && row.description) {
      descGroupCounts.set(row.description, (descGroupCounts.get(row.description) ?? 0) + 1);
    }
  }
  for (const [desc, count] of descGroupCounts) {
    unknownSecurities.push({
      strippedSymbol: desc,
      rawSymbol: "",
      description: desc,
      exchange: null,
      rowCount: count,
    });
  }
  for (const row of parseResult.rows) {
    if (!row.strippedSymbol && SECURITY_TYPES.has(row.type) && row.description) {
      row.strippedSymbol = row.description;
    }
  }

  // Build preview rows — merge parsed rows and error rows inline
  const previewRows: PreviewRow[] = [];

  // Create a set of error row indices for quick lookup
  const errorByIndex = new Map<number, string>();
  for (const err of parseResult.errors) {
    errorByIndex.set(err.rowIndex, err.message);
  }

  // Merge all rows (parsed + errors) sorted by original row index
  const allIndices = new Set([
    ...parseResult.rows.map((r) => r.rowIndex),
    ...parseResult.errors.map((e) => e.rowIndex),
  ]);
  const sortedIndices = [...allIndices].sort((a, b) => a - b);

  // Index parsed rows by rowIndex for quick lookup
  const parsedByIndex = new Map<number, ParsedRow>();
  for (const row of parseResult.rows) {
    parsedByIndex.set(row.rowIndex, row);
  }

  for (const idx of sortedIndices) {
    const errorMsg = errorByIndex.get(idx);

    if (errorMsg && !parsedByIndex.has(idx)) {
      // Error-only row — add as an error entry
      previewRows.push({
        date: "",
        type: "BUY", // placeholder, won't be imported
        rawSymbol: null,
        strippedSymbol: null,
        description: "",
        exchange: null,
        quantity: null,
        price: null,
        amount: 0,
        currency: "CAD",
        fee: 0,
        taxWithheld: 0,
        grossAmount: null,
        mergedRowIndices: null,
        rowIndex: idx,
        status: "error",
        resolvedSecurityId: null,
        resolvedSecuritySymbol: null,
        duplicateOfId: null,
        errorMessage: errorMsg,
      });
      continue;
    }

    const row = parsedByIndex.get(idx);
    if (!row) continue;

    const resolvedSec = row.strippedSymbol ? securityMap.get(row.strippedSymbol) : null;
    const needsSecurity = row.strippedSymbol && !resolvedSec;

    let status: RowStatus;
    let duplicateOfId: string | null = null;

    if (needsSecurity) {
      status = "needs_resolution";
    } else {
      // Check for duplicates
      const amountCents = dollarsToCents(row.amount);
      const existing = await prisma.transaction.findFirst({
        where: {
          accountId,
          securityId: resolvedSec?.id ?? null,
          type: row.type,
          date: new Date(row.date),
          amountCents,
        },
      });

      if (existing) {
        status = "duplicate";
        duplicateOfId = existing.id;
      } else {
        status = "ready";
      }
    }

    previewRows.push({
      ...row,
      status,
      resolvedSecurityId: resolvedSec?.id ?? null,
      resolvedSecuritySymbol: resolvedSec?.symbol ?? null,
      duplicateOfId,
      errorMessage: null,
    });
  }

  return {
    data: {
      rows: previewRows,
      unknownSecurities,
      fileChecksum,
      existingBatchDate: existingBatch?.createdAt.toISOString() ?? null,
      totalRows: sortedIndices.length,
    },
  };
}

// ─── Commit Action ───

export async function commitImportAction(
  input: CommitImportInput,
): Promise<{ data?: CommitImportResult; error?: string }> {
  const { user } = await requireAuth();

  // Verify account ownership
  const account = await prisma.account.findUnique({ where: { id: input.accountId } });
  if (!account || account.userId !== user.id) {
    return { error: "Account not found" };
  }

  const validRows = input.rows;
  if (validRows.length === 0) {
    return { error: "No transactions to import" };
  }

  try {
    // Pre-fetch FX rates for USD transactions
    const db = scopedPrisma(user.id);
    const fxRateCache = new Map<string, number | null>();
    for (const row of validRows) {
      if (row.currency === "USD") {
        const dateKey = row.date.slice(0, 10);
        if (!fxRateCache.has(dateKey)) {
          const rate = await getFxRateForDate(db, "USD", "CAD", new Date(row.date));
          fxRateCache.set(dateKey, rate);
        }
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create import batch
      const batch = await tx.importBatch.create({
        data: {
          userId: user.id,
          sourceFilename: input.sourceFilename,
          sourceChecksum: input.fileChecksum,
          rowCount: validRows.length,
          createdCount: validRows.length,
          skippedCount: 0,
          errorCount: 0,
          status: "COMMITTED",
          log: {},
        },
      });

      // Create all transactions
      for (const row of validRows) {
        const fxRate = row.currency === "USD"
          ? fxRateCache.get(row.date.slice(0, 10)) ?? null
          : null;

        await tx.transaction.create({
          data: {
            accountId: input.accountId,
            securityId: row.securityId,
            type: row.type,
            date: new Date(row.date),
            quantity: row.quantity,
            priceCents: row.price != null ? dollarsToCents(row.price) : null,
            amountCents: dollarsToCents(row.amount),
            currency: row.currency,
            feeCents: dollarsToCents(row.fee),
            taxWithheldCents: dollarsToCents(row.taxWithheld),
            fxRateAtDate: fxRate,
            note: row.note,
            importBatchId: batch.id,
          },
        });
      }

      return { batchId: batch.id, created: validRows.length, skipped: 0, errors: 0 };
    });

    return { data: result };
  } catch (err) {
    return { error: `Import failed: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
}

// ─── Rollback Action ───

export async function rollbackImportAction(
  batchId: string,
): Promise<{ success?: boolean; error?: string; deletedCount?: number }> {
  const { user } = await requireAuth();

  const batch = await prisma.importBatch.findUnique({ where: { id: batchId } });
  if (!batch || batch.userId !== user.id) {
    return { error: "Import batch not found" };
  }
  if (batch.status !== "COMMITTED") {
    return { error: "Only committed batches can be rolled back" };
  }

  const deleted = await prisma.transaction.deleteMany({
    where: { importBatchId: batchId },
  });

  await prisma.importBatch.update({
    where: { id: batchId },
    data: { status: "ROLLED_BACK" },
  });

  return { success: true, deletedCount: deleted.count };
}
