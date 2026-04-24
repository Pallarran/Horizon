"use server";

import crypto from "crypto";
import { requireAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { parseDesjardinsXlsx, type ParsedRow, type ParseError } from "@/lib/import/parse-desjardins";
import { dollarsToCents } from "@/lib/money/arithmetic";
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
}

export interface ParseImportResult {
  rows: PreviewRow[];
  errors: ParseError[];
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

  // Look up existing securities
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

  // Check duplicates for each row
  const previewRows: PreviewRow[] = [];
  for (const row of parseResult.rows) {
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
    });
  }

  return {
    data: {
      rows: previewRows,
      errors: parseResult.errors,
      unknownSecurities,
      fileChecksum,
      existingBatchDate: existingBatch?.createdAt.toISOString() ?? null,
      totalRows: parseResult.rows.length + parseResult.errors.length,
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
