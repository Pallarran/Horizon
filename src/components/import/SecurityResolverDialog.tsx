"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, Plus } from "lucide-react";
import {
  searchSecuritiesAction,
  searchYahooAction,
  findOrCreateSecurityAction,
  createManualSecurityAction,
  type YahooSearchResult,
} from "@/lib/actions/securities";
import type { UnknownSecurity } from "@/lib/actions/import";

export interface SecurityResolution {
  securityId: string;
  symbol: string;
  exchange: string;
  name: string;
}

interface SecurityResolverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  security: UnknownSecurity | null;
  onResolved: (symbol: string, resolution: SecurityResolution) => void;
  onSkip: (symbol: string) => void;
}

interface DbResult {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
}

const EXCHANGES = ["TSX", "NYSE", "NASDAQ", "NEO", "CBOE", "OTHER"] as const;

export function SecurityResolverDialog({
  open,
  onOpenChange,
  security,
  onResolved,
  onSkip,
}: SecurityResolverDialogProps) {
  const t = useTranslations("import");
  const tH = useTranslations("holdings");

  const [query, setQuery] = useState("");
  const [dbResults, setDbResults] = useState<DbResult[]>([]);
  const [yahooResults, setYahooResults] = useState<YahooSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);

  // Manual creation form state
  const [manualName, setManualName] = useState("");
  const [manualExchange, setManualExchange] = useState("");
  const [manualCurrency, setManualCurrency] = useState("CAD");
  const [creating, setCreating] = useState(false);

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q);
    if (q.length < 1) {
      setDbResults([]);
      setYahooResults([]);
      return;
    }

    setSearching(true);
    try {
      const [db, yahoo] = await Promise.all([
        searchSecuritiesAction(q),
        q.length >= 2 ? searchYahooAction(q) : Promise.resolve([]),
      ]);
      setDbResults(db);
      setYahooResults(yahoo);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSelectDb = (result: DbResult) => {
    if (!security) return;
    onResolved(security.strippedSymbol, {
      securityId: result.id,
      symbol: result.symbol,
      exchange: result.exchange,
      name: result.name,
    });
    onOpenChange(false);
  };

  const handleSelectYahoo = async (result: YahooSearchResult) => {
    if (!security) return;
    setAdding(true);
    try {
      const { securityId, error } = await findOrCreateSecurityAction({
        symbol: result.symbol,
        exchange: result.exchange,
        name: result.name,
        quoteType: result.quoteType,
        currency: result.currency,
      });
      if (error) return;
      onResolved(security.strippedSymbol, {
        securityId,
        symbol: result.symbol,
        exchange: result.exchange,
        name: result.name,
      });
      onOpenChange(false);
    } finally {
      setAdding(false);
    }
  };

  const handleCreateManual = async () => {
    if (!security || !manualName.trim() || !manualExchange) return;
    setCreating(true);
    try {
      const { securityId, error } = await createManualSecurityAction({
        symbol: security.strippedSymbol,
        exchange: manualExchange,
        name: manualName.trim(),
        currency: manualCurrency,
      });
      if (error) return;
      onResolved(security.strippedSymbol, {
        securityId,
        symbol: security.strippedSymbol,
        exchange: manualExchange,
        name: manualName.trim(),
      });
      onOpenChange(false);
    } finally {
      setCreating(false);
    }
  };

  const handleSkip = () => {
    if (!security) return;
    onSkip(security.strippedSymbol);
    onOpenChange(false);
  };

  // Auto-search and pre-fill when dialog opens (or security changes)
  const prevSecurityRef = useRef<string | null>(null);
  useEffect(() => {
    if (open && security && security.strippedSymbol !== prevSecurityRef.current) {
      prevSecurityRef.current = security.strippedSymbol;
      setQuery(security.strippedSymbol);
      handleSearch(security.strippedSymbol);
      setManualName(security.description || "");
      setManualExchange(security.exchange || "TSX");
      setManualCurrency(
        security.exchange && ["NYSE", "NASDAQ", "CBOE"].includes(security.exchange)
          ? "USD"
          : "CAD",
      );
    }
    if (!open) {
      prevSecurityRef.current = null;
    }
  }, [open, security, handleSearch]);

  // Clean up state when dialog closes
  const handleDialogChange = (isOpen: boolean) => {
    if (!isOpen) {
      setQuery("");
      setDbResults([]);
      setYahooResults([]);
      setManualName("");
      setManualExchange("");
      setManualCurrency("CAD");
    }
    onOpenChange(isOpen);
  };

  if (!security) return null;

  const noResults = !searching && query.length >= 2 && dbResults.length === 0 && yahooResults.length === 0;

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("resolveTitle")}</DialogTitle>
          <DialogDescription>
            {t("resolveDescription", {
              symbol: security.rawSymbol,
              count: security.rowCount,
            })}
          </DialogDescription>
        </DialogHeader>

        {/* Original info */}
        <div className="rounded-md bg-muted/50 p-3 text-sm">
          <div className="flex gap-4">
            <div>
              <span className="text-muted-foreground">{t("originalSymbol")}:</span>{" "}
              <span className="font-mono font-medium">{security.rawSymbol}</span>
            </div>
            {security.exchange && (
              <div>
                <span className="text-muted-foreground">{t("market")}:</span>{" "}
                <span>{security.exchange}</span>
              </div>
            )}
          </div>
          {security.description && (
            <div className="mt-1 text-muted-foreground">{security.description}</div>
          )}
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={tH("searchSecurities")}
            className="pl-9"
          />
        </div>

        {/* Results */}
        <div className="max-h-[300px] space-y-3 overflow-y-auto">
          {searching && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!searching && dbResults.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                {tH("yourSecurities")}
              </p>
              {dbResults.map((r) => (
                <button
                  key={r.id}
                  onClick={() => handleSelectDb(r)}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                >
                  <span className="font-mono font-medium">{r.symbol}</span>
                  <span className="flex-1 truncate text-muted-foreground">
                    {r.name}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {r.exchange}
                  </Badge>
                </button>
              ))}
            </div>
          )}

          {!searching && yahooResults.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                {tH("yahooFinance")}
              </p>
              {yahooResults.map((r) => (
                <button
                  key={r.yahooSymbol}
                  onClick={() => handleSelectYahoo(r)}
                  disabled={adding}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent disabled:opacity-50"
                >
                  <span className="font-mono font-medium">{r.symbol}</span>
                  <span className="flex-1 truncate text-muted-foreground">
                    {r.name}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {r.exchange}
                  </Badge>
                </button>
              ))}
            </div>
          )}

          {noResults && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {tH("noSecuritiesFound")}
            </p>
          )}
        </div>

        {/* Manual creation form — shown when no Yahoo results found */}
        {noResults && (
          <div className="space-y-3 rounded-md border border-dashed p-3">
            <div>
              <p className="text-sm font-medium">{t("createManually")}</p>
              <p className="text-xs text-muted-foreground">{t("createManuallyHint")}</p>
            </div>
            <div className="flex gap-2">
              <div className="w-20 shrink-0">
                <Input
                  value={security.strippedSymbol}
                  disabled
                  className="font-mono text-sm"
                />
              </div>
              <Input
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder={t("manualName")}
                className="text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Select value={manualExchange} onValueChange={(v) => {
                setManualExchange(v);
                setManualCurrency(["NYSE", "NASDAQ", "CBOE"].includes(v) ? "USD" : "CAD");
              }}>
                <SelectTrigger className="w-32 text-sm">
                  <SelectValue placeholder={t("manualExchange")} />
                </SelectTrigger>
                <SelectContent>
                  {EXCHANGES.map((ex) => (
                    <SelectItem key={ex} value={ex}>{ex}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={manualCurrency} onValueChange={setManualCurrency}>
                <SelectTrigger className="w-24 text-sm">
                  <SelectValue placeholder={t("manualCurrency")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CAD">CAD</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={handleCreateManual}
                disabled={creating || !manualName.trim() || !manualExchange}
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-1 h-4 w-4" />
                )}
                {t("createBtn")}
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleSkip}>
            {t("skipSymbol")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
