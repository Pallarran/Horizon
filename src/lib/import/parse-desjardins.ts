import * as XLSX from "xlsx";
import type { TransactionType } from "@/generated/prisma/client";
import { TXN_TYPES_WITH_QTY } from "@/lib/constants/transactions";

export interface ParsedRow {
  date: string; // YYYY-MM-DD
  type: TransactionType;
  rawSymbol: string | null; // original from file
  strippedSymbol: string | null; // suffix removed
  description: string;
  exchange: string | null; // TSX, NYSE, etc.
  quantity: number | null;
  price: number | null;
  amount: number; // signed dollars (NET for merged dividends)
  currency: "CAD" | "USD";
  fee: number; // dollars (absolute)
  taxWithheld: number; // dollars (absolute, 0 if no tax)
  grossAmount: number | null; // dollars, gross before tax/fee (null if not merged)
  mergedRowIndices: number[] | null; // row indices consumed by merge (null if standalone)
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

/**
 * Map Desjardins French transaction types to our enum.
 * null = skip silently (complex types best entered manually).
 * Import focuses on: BUY, SELL, DIVIDEND, DEPOSIT, INTEREST, TAX_WITHHELD, FEE.
 */
const TYPE_MAP: Record<string, TransactionType | null> = {
  // Imported
  "ACHAT": "BUY",
  "VENTE": "SELL",
  "DIVIDENDE": "DIVIDEND",
  "DIVIDENDE SOCIÉTÉ FIDUCIE": "DIVIDEND",
  "DIVIDENDE LIBRE D'IMPÔTS": "DIVIDEND",
  "DÉPÔT REÇU D'UNE CAISSE": "DEPOSIT",
  "COTISATION": "DEPOSIT",
  "INTÉRÊTS": "INTEREST",
  "IMPÔT DE NON-RÉSIDENT": "TAX_WITHHELD",
  "IMPÔT ÉTRANGER PAYÉ": "TAX_WITHHELD",
  "RETENUE D'IMPÔT": "TAX_WITHHELD",
  "FRAIS": "FEE",
  "REMBOURSEMENT SUR CAPITAL": "RETURN_OF_CAPITAL",
  "FRACTION": "FRACTION_CASH",
  "ANNULATION": "ADJUSTMENT",
  // Skipped — complex types, enter manually
  "CONVERSION DE DEVISE": null,
  "ÉCHANGE": null,
  "OFFRE": null,
  "FRACTIONNEMENT D'ACTIONS": null,
  "DIVIDENDE EN ACTIONS": null,
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
  // Also uses dots for TSX class suffixes (PMZ.UN, RCI.B) where Yahoo uses dashes
  if (sym.endsWith("-C")) {
    return { strippedSymbol: sym.slice(0, -2).replace(/\./g, "-"), exchange: "TSX" };
  }
  if (sym.endsWith("-U")) {
    return { strippedSymbol: sym.slice(0, -2), exchange: "NYSE" };
  }

  // Fall back to market column
  const mkt = String(market ?? "").trim().toUpperCase();
  if (mkt === "CAN" || mkt === "CA") {
    return { strippedSymbol: sym.replace(/\./g, "-"), exchange: "TSX" };
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
    const hasQty = (TXN_TYPES_WITH_QTY as readonly string[]).includes(type);
    const rawQuantity = parseNumber(row[COL.quantity]);
    const rawPrice = parseNumber(row[COL.price]);
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
      quantity: hasQty && rawQuantity != null ? Math.abs(rawQuantity) : null,
      price: hasQty && rawPrice != null ? Math.abs(rawPrice) : null,
      amount,
      currency,
      fee: Math.abs(fee),
      taxWithheld: 0,
      grossAmount: null,
      mergedRowIndices: null,
      rowIndex: i,
    });
  }

  const merged = mergeDividendGroups(rows);
  enrichSymbolsFromDescription(merged);
  return { rows: merged, errors };
}

/**
 * Enrich symbolless rows (dividends, interest) with the ticker from other rows
 * in the same import that share the same description.
 */
function enrichSymbolsFromDescription(rows: ParsedRow[]): void {
  const descToSymbol = new Map<
    string,
    { strippedSymbol: string; rawSymbol: string | null; exchange: string | null }
  >();

  for (const row of rows) {
    if (row.strippedSymbol && row.description) {
      const key = row.description.toUpperCase().trim();
      if (!descToSymbol.has(key)) {
        descToSymbol.set(key, {
          strippedSymbol: row.strippedSymbol,
          rawSymbol: row.rawSymbol,
          exchange: row.exchange,
        });
      }
    }
  }

  for (const row of rows) {
    if (!row.strippedSymbol && row.description) {
      const match = descToSymbol.get(row.description.toUpperCase().trim());
      if (match) {
        row.strippedSymbol = match.strippedSymbol;
        row.rawSymbol = match.rawSymbol;
        row.exchange = match.exchange;
      }
    }
  }
}

/**
 * Merge DIVIDEND/INTEREST rows with their associated TAX_WITHHELD and FEE rows.
 *
 * Desjardins exports split dividend events across multiple rows sharing the
 * same settlement date, description, and currency. This function groups those
 * rows and collapses them into a single DIVIDEND/INTEREST row with:
 *  - amount = NET (sum of all amounts in the group — anchor + tax + fee)
 *  - taxWithheld = absolute sum of TAX_WITHHELD amounts
 *  - fee = absolute sum of FEE amounts (merged into the anchor's fee)
 *  - grossAmount = original anchor amount (before tax/fee deductions)
 */
function mergeDividendGroups(rows: ParsedRow[]): ParsedRow[] {
  const ANCHOR_TYPES: TransactionType[] = ["DIVIDEND", "INTEREST"];
  const ABSORBED_TYPES: TransactionType[] = ["TAX_WITHHELD", "FEE"];

  // Only attempt merging on symbolless rows (dividend/tax/fee rows have no symbol)
  // Rows with symbols pass through untouched.
  const withSymbol: ParsedRow[] = [];
  const withoutSymbol: ParsedRow[] = [];

  for (const row of rows) {
    if (row.strippedSymbol) {
      withSymbol.push(row);
    } else {
      withoutSymbol.push(row);
    }
  }

  // Group symbolless rows by (date, description, currency)
  const groups = new Map<string, ParsedRow[]>();
  for (const row of withoutSymbol) {
    const key = `${row.date}|${row.description}|${row.currency}`;
    const group = groups.get(key);
    if (group) {
      group.push(row);
    } else {
      groups.set(key, [row]);
    }
  }

  const mergedRows: ParsedRow[] = [];

  for (const group of groups.values()) {
    const anchors = group.filter((r) => ANCHOR_TYPES.includes(r.type));
    const absorbed = group.filter((r) => ABSORBED_TYPES.includes(r.type));
    // Rows that are neither anchor nor absorbed (e.g. RETURN_OF_CAPITAL, FRACTION_CASH)
    // pass through individually — they must not be folded into the dividend net amount.
    const others = group.filter(
      (r) => !ANCHOR_TYPES.includes(r.type) && !ABSORBED_TYPES.includes(r.type),
    );
    mergedRows.push(...others);

    // Only merge if there's exactly 1 anchor and at least 1 absorbed row
    if (anchors.length !== 1 || absorbed.length === 0) {
      mergedRows.push(...anchors, ...absorbed);
      continue;
    }

    const anchor = anchors[0]!;

    // Sum TAX_WITHHELD amounts (these are negative in the file)
    const taxRows = absorbed.filter((r) => r.type === "TAX_WITHHELD");
    const totalTax = taxRows.reduce((sum, r) => sum + Math.abs(r.amount), 0);

    // Sum FEE amounts (these are negative in the file)
    const feeRows = absorbed.filter((r) => r.type === "FEE");
    const totalFee = feeRows.reduce((sum, r) => sum + Math.abs(r.amount), 0);

    // Net = sum of anchor + absorbed only (excludes others like ROC/FRACTION)
    const mergeGroup = [anchor, ...absorbed];
    const netAmount = mergeGroup.reduce((sum, r) => sum + r.amount, 0);

    // Collect row indices consumed by this merge (anchor + absorbed only)
    const allIndices = mergeGroup.map((r) => r.rowIndex).sort((a, b) => a - b);

    mergedRows.push({
      ...anchor,
      amount: netAmount,
      fee: anchor.fee + totalFee,
      taxWithheld: totalTax,
      grossAmount: anchor.amount,
      mergedRowIndices: allIndices,
    });
  }

  // Combine: rows with symbols + merged symbolless rows, sorted by original row index
  const result = [...withSymbol, ...mergedRows];
  result.sort((a, b) => a.rowIndex - b.rowIndex);

  return result;
}
