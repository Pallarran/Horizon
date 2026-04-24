"use client";

import { useState, useCallback } from "react";
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
import { Loader2, Search } from "lucide-react";
import {
  searchSecuritiesAction,
  searchYahooAction,
  findOrCreateSecurityAction,
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

  const handleSkip = () => {
    if (!security) return;
    onSkip(security.strippedSymbol);
    onOpenChange(false);
  };

  // Auto-search with stripped symbol when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && security) {
      setQuery(security.strippedSymbol);
      handleSearch(security.strippedSymbol);
    } else {
      setQuery("");
      setDbResults([]);
      setYahooResults([]);
    }
    onOpenChange(isOpen);
  };

  if (!security) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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

          {!searching && query.length >= 2 && dbResults.length === 0 && yahooResults.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {tH("noSecuritiesFound")}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleSkip}>
            {t("skipSymbol")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
