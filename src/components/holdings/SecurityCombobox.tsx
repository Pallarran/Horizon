"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  searchSecuritiesAction,
  searchYahooAction,
  findOrCreateSecurityAction,
  createManualSecurityAction,
  type YahooSearchResult,
} from "@/lib/actions/securities";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus } from "lucide-react";

export interface SecurityOption {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
}

interface Props {
  value: string | null;
  onChange: (securityId: string | null, security: SecurityOption | null) => void;
  initialSecurity?: { id: string; symbol: string; name: string } | null;
}

const EXCHANGES = ["TSX", "NYSE", "NASDAQ", "NEO", "CBOE", "OTHER"] as const;

export function SecurityCombobox({ value, onChange, initialSecurity }: Props) {
  const t = useTranslations("holdings");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [localResults, setLocalResults] = useState<SecurityOption[]>([]);
  const [yahooResults, setYahooResults] = useState<YahooSearchResult[]>([]);
  const [selected, setSelected] = useState<SecurityOption | null>(
    initialSecurity ? { ...initialSecurity, exchange: "", currency: "" } : null,
  );
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // Manual creation state
  const [manualSymbol, setManualSymbol] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualExchange, setManualExchange] = useState("");
  const [manualCurrency, setManualCurrency] = useState("CAD");

  const search = useCallback(async (q: string) => {
    if (q.length < 1) {
      setLocalResults([]);
      setYahooResults([]);
      return;
    }

    setLoading(true);

    // Always search local DB
    const localPromise = searchSecuritiesAction(q);

    // Only search Yahoo if query is >= 2 chars
    const yahooPromise =
      q.length >= 2 ? searchYahooAction(q) : Promise.resolve([]);

    const [local, yahoo] = await Promise.all([localPromise, yahooPromise]);

    // Deduplicate: remove Yahoo results that already exist locally
    const localKeys = new Set(local.map((s) => `${s.symbol}:${s.exchange}`));
    const filteredYahoo = yahoo.filter(
      (y) => !localKeys.has(`${y.symbol}:${y.exchange}`),
    );

    setLocalResults(local);
    setYahooResults(filteredYahoo);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  function handleLocalSelect(sec: SecurityOption) {
    setSelected(sec);
    onChange(sec.id, sec);
    setOpen(false);
  }

  async function handleYahooSelect(result: YahooSearchResult) {
    setCreating(true);
    const { securityId, error } = await findOrCreateSecurityAction({
      symbol: result.symbol,
      exchange: result.exchange,
      name: result.name,
      quoteType: result.quoteType,
      currency: result.currency,
    });
    setCreating(false);

    if (error || !securityId) return;

    const sec: SecurityOption = {
      id: securityId,
      symbol: result.symbol,
      name: result.name,
      exchange: result.exchange,
      currency: result.currency,
    };
    setSelected(sec);
    onChange(securityId, sec);
    setOpen(false);
  }

  async function handleManualCreate() {
    if (!manualSymbol.trim() || !manualName.trim() || !manualExchange) return;
    setCreating(true);
    const { securityId, error } = await createManualSecurityAction({
      symbol: manualSymbol.trim().toUpperCase(),
      exchange: manualExchange,
      name: manualName.trim(),
      currency: manualCurrency,
    });
    setCreating(false);

    if (error || !securityId) return;

    const sec: SecurityOption = {
      id: securityId,
      symbol: manualSymbol.trim().toUpperCase(),
      name: manualName.trim(),
      exchange: manualExchange,
      currency: manualCurrency,
    };
    setSelected(sec);
    onChange(securityId, sec);
    setOpen(false);
  }

  const hasResults = localResults.length > 0 || yahooResults.length > 0;
  const noResults = !loading && !hasResults && query.length >= 2;

  // Pre-fill manual symbol from query when no results appear
  useEffect(() => {
    if (noResults) {
      setManualSymbol(query.toUpperCase());
    }
  }, [noResults, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={creating}
        >
          {creating
            ? t("addingSecurity")
            : selected
              ? `${selected.symbol} — ${selected.name}`
              : t("selectSecurity")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[460px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t("searchSecurities")}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {noResults && (
              <CommandEmpty>{t("noSecuritiesFound")}</CommandEmpty>
            )}

            {loading && query.length > 0 && !hasResults && (
              <div className="py-4 text-center text-sm text-muted-foreground">
                {t("searching")}
              </div>
            )}

            {localResults.length > 0 && (
              <CommandGroup heading={t("yourSecurities")}>
                {localResults.map((sec) => (
                  <CommandItem
                    key={sec.id}
                    value={`local-${sec.id}`}
                    onSelect={() => handleLocalSelect(sec)}
                  >
                    <span className="font-medium">{sec.symbol}</span>
                    <span className="ml-2 truncate text-muted-foreground">
                      {sec.name}
                    </span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {sec.exchange} · {sec.currency}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {yahooResults.length > 0 && (
              <CommandGroup
                heading={
                  loading ? t("yahooSearching") : t("yahooFinance")
                }
              >
                {yahooResults.map((result) => (
                  <CommandItem
                    key={`${result.symbol}-${result.exchange}`}
                    value={`yahoo-${result.yahooSymbol}`}
                    onSelect={() => handleYahooSelect(result)}
                  >
                    <span className="font-medium">{result.symbol}</span>
                    <span className="ml-2 truncate text-muted-foreground">
                      {result.name}
                    </span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {result.exchange} · {result.currency}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>

        {/* Manual creation form — shown when no results found */}
        {noResults && (
          <div className="space-y-2 border-t border-dashed p-3">
            <div>
              <p className="text-sm font-medium">{t("createManually")}</p>
              <p className="text-xs text-muted-foreground">{t("createManuallyHint")}</p>
            </div>
            <div className="flex gap-2">
              <Input
                value={manualSymbol}
                onChange={(e) => setManualSymbol(e.target.value.toUpperCase())}
                placeholder={t("manualSymbol")}
                className="w-24 shrink-0 font-mono text-sm"
              />
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
                onClick={handleManualCreate}
                disabled={creating || !manualSymbol.trim() || !manualName.trim() || !manualExchange}
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
      </PopoverContent>
    </Popover>
  );
}
