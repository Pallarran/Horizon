"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { PreviewRow, RowStatus } from "@/lib/actions/import";

interface ImportPreviewTableProps {
  rows: PreviewRow[];
  onToggleSkip: (rowIndex: number) => void;
  onResolve: (symbol: string) => void;
}

function StatusBadge({ status }: { status: RowStatus }) {
  const t = useTranslations("import");

  switch (status) {
    case "ready":
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
          {t("statusReady")}
        </Badge>
      );
    case "needs_resolution":
      return (
        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400">
          {t("statusNeedsResolution")}
        </Badge>
      );
    case "duplicate":
      return (
        <Badge className="bg-orange-500/15 text-orange-700 dark:text-orange-400">
          {t("statusDuplicate")}
        </Badge>
      );
    case "skipped":
      return (
        <Badge variant="secondary">{t("statusSkipped")}</Badge>
      );
    case "error":
      return (
        <Badge variant="destructive">{t("statusError")}</Badge>
      );
  }
}

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    signDisplay: "always",
  }).format(amount);
}

export function ImportPreviewTable({
  rows,
  onToggleSkip,
  onResolve,
}: ImportPreviewTableProps) {
  const t = useTranslations("import");
  const tH = useTranslations("holdings");

  // Group unknown securities for resolve buttons
  const unknownSymbols = new Set(
    rows
      .filter((r) => r.status === "needs_resolution" && r.strippedSymbol)
      .map((r) => r.strippedSymbol!),
  );

  // Counts
  const ready = rows.filter((r) => r.status === "ready").length;
  const needsRes = rows.filter((r) => r.status === "needs_resolution").length;
  const dupes = rows.filter((r) => r.status === "duplicate").length;
  const skipped = rows.filter((r) => r.status === "skipped").length;

  return (
    <div className="space-y-4">
      {/* Counts strip */}
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="text-emerald-600 dark:text-emerald-400">
          {ready} {t("readyCount")}
        </span>
        {needsRes > 0 && (
          <span className="text-amber-600 dark:text-amber-400">
            {needsRes} {t("needsResolutionCount")}
          </span>
        )}
        {dupes > 0 && (
          <span className="text-orange-600 dark:text-orange-400">
            {dupes} {t("duplicateCount")}
          </span>
        )}
        {skipped > 0 && (
          <span className="text-muted-foreground">
            {skipped} {t("skippedCount")}
          </span>
        )}
      </div>

      {/* Unknown securities resolve buttons */}
      {unknownSymbols.size > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/50">
          <p className="mb-2 text-sm font-medium text-amber-800 dark:text-amber-300">
            {t("unknownSecuritiesTitle")}
          </p>
          <div className="flex flex-wrap gap-2">
            {[...unknownSymbols].map((sym) => (
              <Button
                key={sym}
                variant="outline"
                size="sm"
                onClick={() => onResolve(sym)}
                className="border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900"
              >
                {sym}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colStatus")}</TableHead>
              <TableHead>{t("colDate")}</TableHead>
              <TableHead>{t("colType")}</TableHead>
              <TableHead>{t("colSymbol")}</TableHead>
              <TableHead>{t("colDescription")}</TableHead>
              <TableHead className="text-right">{t("colAmount")}</TableHead>
              <TableHead className="text-right">{t("colQty")}</TableHead>
              <TableHead className="text-right">{t("colPrice")}</TableHead>
              <TableHead>{t("colAction")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow
                key={idx}
                className={
                  row.status === "skipped"
                    ? "opacity-40"
                    : row.status === "duplicate"
                      ? "opacity-60"
                      : ""
                }
              >
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell className="font-mono text-xs">{row.date}</TableCell>
                <TableCell>
                  <span className="text-xs">
                    {tH(`txnType${row.type}`)}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {row.resolvedSecuritySymbol ?? row.strippedSymbol ?? "—"}
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                  {row.description}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatAmount(row.amount, row.currency)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {row.quantity ?? "—"}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {row.price != null ? `$${row.price.toFixed(2)}` : "—"}
                </TableCell>
                <TableCell>
                  {(row.status === "duplicate" || row.status === "ready" || row.status === "skipped") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => onToggleSkip(idx)}
                    >
                      {row.status === "skipped" ? t("include") : t("skip")}
                    </Button>
                  )}
                  {row.status === "needs_resolution" && row.strippedSymbol && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => onResolve(row.strippedSymbol!)}
                    >
                      {t("resolve")}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
