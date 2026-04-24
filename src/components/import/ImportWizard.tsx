"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, AlertTriangle, Upload } from "lucide-react";
import { FileDropZone } from "./FileDropZone";
import { ImportPreviewTable } from "./ImportPreviewTable";
import {
  SecurityResolverDialog,
  type SecurityResolution,
} from "./SecurityResolverDialog";
import { ImportSummary } from "./ImportSummary";
import {
  parseImportFileAction,
  commitImportAction,
  type PreviewRow,
  type UnknownSecurity,
  type CommitImportResult,
} from "@/lib/actions/import";

type Step = "upload" | "preview" | "summary";

interface Account {
  id: string;
  name: string;
  currency: string;
}

interface ImportWizardProps {
  accounts: Account[];
}

export function ImportWizard({ accounts }: ImportWizardProps) {
  const t = useTranslations("import");

  // Step state
  const [step, setStep] = useState<Step>("upload");

  // Step 1: Upload
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  // Step 2: Preview
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [unknownSecurities, setUnknownSecurities] = useState<UnknownSecurity[]>([]);
  const [fileChecksum, setFileChecksum] = useState("");
  const [existingBatchDate, setExistingBatchDate] = useState<string | null>(null);

  // Security resolver
  const [resolverOpen, setResolverOpen] = useState(false);
  const [resolverSymbol, setResolverSymbol] = useState<string | null>(null);
  const [resolutions, setResolutions] = useState<Map<string, SecurityResolution>>(new Map());

  // Step 3: Summary
  const [importResult, setImportResult] = useState<CommitImportResult | null>(null);

  // Error
  const [error, setError] = useState<string | null>(null);

  // ─── Step 1: Handle file upload ───

  const handleFile = useCallback(
    async (file: File) => {
      if (!accountId) return;
      setLoading(true);
      setError(null);
      setFileName(file.name);

      const formData = new FormData();
      formData.set("file", file);
      formData.set("accountId", accountId);

      try {
        const result = await parseImportFileAction(formData);
        if (result.error) {
          setError(result.error);
          setLoading(false);
          return;
        }
        if (!result.data) {
          setError("No data returned");
          setLoading(false);
          return;
        }

        setRows(result.data.rows);
        setUnknownSecurities(result.data.unknownSecurities);
        setFileChecksum(result.data.fileChecksum);
        setExistingBatchDate(result.data.existingBatchDate);
        setResolutions(new Map());
        setStep("preview");
      } catch {
        setError("Failed to parse file");
      } finally {
        setLoading(false);
      }
    },
    [accountId],
  );

  // ─── Step 2: Row management ───

  const handleToggleSkip = useCallback(
    (index: number) => {
      setRows((prev) =>
        prev.map((r, i) => {
          if (i !== index) return r;
          if (r.status === "skipped") {
            // Restore to previous status
            return { ...r, status: r.duplicateOfId ? "duplicate" : "ready" };
          }
          return { ...r, status: "skipped" };
        }),
      );
    },
    [],
  );

  const handleResolve = useCallback((symbol: string) => {
    setResolverSymbol(symbol);
    setResolverOpen(true);
  }, []);

  const handleResolved = useCallback(
    (symbol: string, resolution: SecurityResolution) => {
      setResolutions((prev) => new Map(prev).set(symbol, resolution));
      // Update rows that match this symbol
      setRows((prev) =>
        prev.map((r) => {
          if (r.strippedSymbol !== symbol) return r;
          return {
            ...r,
            status: "ready" as const,
            resolvedSecurityId: resolution.securityId,
            resolvedSecuritySymbol: resolution.symbol,
          };
        }),
      );
      // Remove from unknownSecurities
      setUnknownSecurities((prev) =>
        prev.filter((u) => u.strippedSymbol !== symbol),
      );
    },
    [],
  );

  const handleSkipSymbol = useCallback((symbol: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.strippedSymbol !== symbol) return r;
        return { ...r, status: "skipped" as const };
      }),
    );
    setUnknownSecurities((prev) =>
      prev.filter((u) => u.strippedSymbol !== symbol),
    );
  }, []);

  // ─── Step 3: Commit ───

  const readyRows = rows.filter((r) => r.status === "ready");
  const hasUnresolved = rows.some((r) => r.status === "needs_resolution");
  const skippedCount = rows.filter((r) => r.status === "skipped" || r.status === "duplicate").length;
  const errorCount = rows.filter((r) => r.status === "error").length;

  const handleCommit = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await commitImportAction({
        accountId,
        fileChecksum,
        sourceFilename: fileName ?? "import.xlsx",
        rows: readyRows.map((r) => ({
          date: r.date,
          type: r.type,
          securityId: r.resolvedSecurityId,
          quantity: r.quantity,
          price: r.price,
          amount: r.amount,
          currency: r.currency,
          fee: r.fee,
          note: null,
        })),
      });

      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.data) {
        setImportResult(result.data);
        setStep("summary");
      }
    } catch {
      setError("Import failed");
    } finally {
      setLoading(false);
    }
  }, [accountId, fileChecksum, fileName, readyRows]);

  // ─── Render ───

  const resolverSecurity = resolverSymbol
    ? unknownSecurities.find((u) => u.strippedSymbol === resolverSymbol) ??
      // If already resolved but user wants to re-resolve, build from row data
      (() => {
        const row = rows.find((r) => r.strippedSymbol === resolverSymbol);
        if (!row) return null;
        return {
          strippedSymbol: resolverSymbol,
          rawSymbol: row.rawSymbol ?? resolverSymbol,
          description: row.description,
          exchange: row.exchange,
          rowCount: rows.filter((r) => r.strippedSymbol === resolverSymbol).length,
        };
      })()
    : null;

  if (step === "summary" && importResult) {
    return (
      <ImportSummary
        created={importResult.created}
        skipped={skippedCount}
        errors={errorCount}
        batchId={importResult.batchId}
      />
    );
  }

  return (
    <>
      <SecurityResolverDialog
        open={resolverOpen}
        onOpenChange={setResolverOpen}
        security={resolverSecurity ?? null}
        onResolved={handleResolved}
        onSkip={handleSkipSymbol}
      />

      {step === "upload" && (
        <Card className="mx-auto max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              {t("uploadTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Account selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t("selectAccount")}
              </label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* File drop zone */}
            <FileDropZone onFile={handleFile} disabled={loading || !accountId} />

            {loading && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("parsing")}
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">{t("previewTitle")}</h2>
              {fileName && (
                <p className="text-sm text-muted-foreground">{fileName}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setStep("upload");
                  setRows([]);
                  setError(null);
                }}
              >
                {t("back")}
              </Button>
              <Button
                onClick={handleCommit}
                disabled={loading || readyRows.length === 0 || hasUnresolved}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {t("importButton", { count: readyRows.length })}
              </Button>
            </div>
          </div>

          {existingBatchDate && (
            <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {t("duplicateFileWarning", {
                date: new Date(existingBatchDate).toLocaleDateString(),
              })}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <ImportPreviewTable
            rows={rows}
            onToggleSkip={handleToggleSkip}
            onResolve={handleResolve}
          />
        </div>
      )}
    </>
  );
}
