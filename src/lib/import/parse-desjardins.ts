import * as XLSX from "xlsx";
import type { TransactionType } from "@/generated/prisma/client";

export interface ParsedRow {
  date: string; // YYYY-MM-DD
  type: TransactionType;
  rawSymbol: string | null; // original from file
  strippedSymbol: string | null; // suffix removed
  description: string;
  exchange: string | null; // TSX, NYSE, etc.
  quantity: number | null;
  price: number | null;
  amount: number; // signed dollars
  currency: "CAD" | "USD";
  fee: number; // dollars
  rowIndex: number; // 0-based data row index (for error reporting)
}

export interface ParseError {
  rowIndex: number;
  message: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: ParseError[];
}

// Column headers in French (Desjardins export)
const COL = {
  txnDate: "Date de transaction",
  settlementDate: "Date de règlement",
  type: "Type de transaction",
  assetClass: "Classe d'actif",
  symbol: "Symbole",
  description: "Description",
  market: "Marché",
  quantity: "Quantité",
  price: "Prix",
  priceCurrency: "Devise du prix",
  fee: "Commission payée",
  amount: "Montant de l'opération",
  accountCurrency: "Devise du compte",
} as const;

/** Map Desjardins French transaction types to our enum (null = skip silently) */
const TYPE_MAP: Record<string, TransactionType | null> = {
  "ACHAT": "BUY",
  "VENTE": "SELL",
  "DIVIDENDE": "DIVIDEND",
  "DIVIDENDE SOCIÉTÉ FIDUCIE": "DIVIDEND",
  "DÉPÔT REÇU D'UNE CAISSE": "DEPOSIT",
  "COTISATION": "DEPOSIT",
  "CONVERSION DE DEVISE": "ADJUSTMENT",
  "INTÉRÊTS": "INTEREST",
  "IMPÔT DE NON-RÉSIDENT": "TAX_WITHHELD",
  "FRAIS": "FEE",
  "ÉCHANGE": null, // ticker name change — skip silently
  "OFFRE": null, // tender offer / stock swap — no tickers in file, skip silently
  "DIVIDENDE LIBRE D'IMPÔTS": "DIVIDEND",
  "FRACTIONNEMENT D'ACTIONS": "SPLIT",
  "ANNULATION": "ADJUSTMENT", // reversal — user reviews and skips with the cancelled txn
};

/** Map Desjardins currency codes to ISO */
function mapCurrency(raw: string | undefined | null): "CAD" | "USD" {
  if (!raw) return "CAD";
  const upper = String(raw).trim().toUpperCase();
  if (upper === "US" || upper === "USD") return "USD";
  return "CAD";
}

/** Strip symbol suffixes and infer exchange */
function parseSymbol(
  rawSymbol: string | undefined | null,
  market: string | undefined | null,
): { strippedSymbol: string | null; exchange: string | null } {
  if (!rawSymbol || rawSymbol.trim() === "-" || rawSymbol.trim() === "") {
    return { strippedSymbol: null, exchange: null };
  }

  const sym = rawSymbol.trim();

  // Desjardins uses suffixes like -C (Canadian) and -U (US)
  if (sym.endsWith("-C")) {
    return { strippedSymbol: sym.slice(0, -2), exchange: "TSX" };
  }
  if (sym.endsWith("-U")) {
    return { strippedSymbol: sym.slice(0, -2), exchange: "NYSE" };
  }

  // Fall back to market column
  const mkt = String(market ?? "").trim().toUpperCase();
  if (mkt === "CAN" || mkt === "CA") {
    return { strippedSymbol: sym, exchange: "TSX" };
  }
  if (mkt === "USA" || mkt === "US") {
    return { strippedSymbol: sym, exchange: "NYSE" };
  }

  // No suffix, no market info — return as-is
  return { strippedSymbol: sym, exchange: null };
}

/** Parse an Excel serial date or string date to YYYY-MM-DD */
function parseDate(value: unknown): string | null {
  if (value == null || value === "" || value === "-") return null;

  // Excel serial date number
  if (typeof value === "number") {
    const d = XLSX.SSF.parse_date_code(value);
    if (d) {
      return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    }
  }

  // Date object
  if (value instanceof Date) {
    return value.toISOString().split("T")[0]!;
  }

  // String date — try common formats
  const str = String(value).trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // DD/MM/YYYY or MM/DD/YYYY — Desjardins uses YYYY-MM-DD typically
  const parts = str.split(/[/-]/);
  if (parts.length === 3) {
    const [a, b, c] = parts as [string, string, string];
    if (a.length === 4) return `${a}-${b.padStart(2, "0")}-${c.padStart(2, "0")}`;
  }

  return null;
}

/** Parse a numeric value, handling "-" and empty strings */
function parseNumber(value: unknown): number | null {
  if (value == null || value === "" || value === "-") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse a Desjardins XLSX export file into structured rows.
 */
export function parseDesjardinsXlsx(buffer: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], errors: [{ rowIndex: -1, message: "No sheets found in file" }] };
  }

  const sheet = workbook.Sheets[sheetName]!;
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
  });

  if (data.length === 0) {
    return { rows: [], errors: [{ rowIndex: -1, message: "No data rows found" }] };
  }

  // Validate that expected columns exist
  const firstRow = data[0]!;
  const missingCols = [COL.type, COL.amount].filter(
    (col) => !(col in firstRow),
  );
  if (missingCols.length > 0) {
    return {
      rows: [],
      errors: [
        {
          rowIndex: -1,
          message: `Missing required columns: ${missingCols.join(", ")}`,
        },
      ],
    };
  }

  const rows: ParsedRow[] = [];
  const errors: ParseError[] = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i]!;

    // Parse date (prefer transaction date, fall back to settlement)
    const txnDate = parseDate(row[COL.txnDate]);
    const settlDate = parseDate(row[COL.settlementDate]);
    const date = txnDate ?? settlDate;
    if (!date) {
      errors.push({ rowIndex: i, message: "No valid date found" });
      continue;
    }

    // Parse transaction type
    const rawType = String(row[COL.type] ?? "").trim().toUpperCase();
    if (!(rawType in TYPE_MAP)) {
      errors.push({
        rowIndex: i,
        message: `Unknown transaction type: "${row[COL.type]}"`,
      });
      continue;
    }
    const type = TYPE_MAP[rawType];
    if (type === null) {
      // Silently skip (e.g. ÉCHANGE = ticker name change)
      continue;
    }

    // Parse symbol
    const rawSymbol = row[COL.symbol] != null ? String(row[COL.symbol]).trim() : null;
    const displaySymbol = rawSymbol === "-" ? null : rawSymbol;
    const { strippedSymbol, exchange } = parseSymbol(rawSymbol, row[COL.market] as string);

    // Parse amount (required)
    const amount = parseNumber(row[COL.amount]);
    if (amount == null) {
      errors.push({ rowIndex: i, message: "Invalid or missing amount" });
      continue;
    }

    // Parse other fields
    const quantity = parseNumber(row[COL.quantity]);
    const price = parseNumber(row[COL.price]);
    const fee = parseNumber(row[COL.fee]) ?? 0;
    const currency = mapCurrency(row[COL.accountCurrency] as string);
    const description = String(row[COL.description] ?? "").trim();

    rows.push({
      date,
      type,
      rawSymbol: displaySymbol,
      strippedSymbol,
      description,
      exchange,
      quantity: quantity != null ? Math.abs(quantity) : null,
      price: price != null ? Math.abs(price) : null,
      amount,
      currency,
      fee: Math.abs(fee),
      rowIndex: i,
    });
  }

  return { rows, errors };
}
