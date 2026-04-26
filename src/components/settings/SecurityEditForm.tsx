"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateSecurityAction, refreshYahooProfileAction } from "@/lib/actions/securities";
import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";
import type { SerializedSecurity } from "./SecurityManagement";

const EXCHANGES = ["TSX", "NYSE", "NASDAQ", "NEO", "CBOE", "OTHER"] as const;
const ASSET_CLASSES = [
  "CANADIAN_EQUITY", "US_EQUITY", "INTERNATIONAL_EQUITY",
  "REIT", "ETF", "BOND", "PREFERRED_SHARE", "CRCD_SHARE", "CASH", "OTHER",
] as const;
const DATA_SOURCES = ["YAHOO", "MANUAL", "CRCD_FEED"] as const;
const FREQUENCIES = ["monthly", "quarterly", "semi-annual", "annual"] as const;

interface Props {
  security: SerializedSecurity;
  onSuccess: () => void;
  onCancel: () => void;
}

export function SecurityEditForm({ security, onSuccess, onCancel }: Props) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [symbol, setSymbol] = useState(security.symbol);
  const [exchange, setExchange] = useState(security.exchange);
  const [name, setName] = useState(security.name);
  const [currency, setCurrency] = useState(security.currency);
  const [assetClass, setAssetClass] = useState(security.assetClass);
  const [dataSource, setDataSource] = useState(security.dataSource);
  const [delisted, setDelisted] = useState(security.delisted);
  const [sector, setSector] = useState(security.sector ?? "");
  const [industry, setIndustry] = useState(security.industry ?? "");
  const [manualDividendOverride, setManualDividendOverride] = useState(security.manualDividendOverride);
  const [annualDividend, setAnnualDividend] = useState(
    security.annualDividendCents != null ? (security.annualDividendCents / 100).toString() : "",
  );
  const [dividendFrequency, setDividendFrequency] = useState(security.dividendFrequency ?? "none");
  const [dividendGrowthYears, setDividendGrowthYears] = useState(
    security.dividendGrowthYears?.toString() ?? "",
  );
  const [isDividendAristocrat, setIsDividendAristocrat] = useState(security.isDividendAristocrat);
  const [isDividendKing, setIsDividendKing] = useState(security.isDividendKing);
  const [isPaysMonthly, setIsPaysMonthly] = useState(security.isPaysMonthly);
  const [manualPrice, setManualPrice] = useState(
    security.manualPrice != null ? security.manualPrice.toString() : "",
  );
  const [importNames, setImportNames] = useState<string[]>(security.importNames);
  const [newAlias, setNewAlias] = useState("");
  const [notes, setNotes] = useState(security.notes ?? "");

  function handleAddAlias() {
    const trimmed = newAlias.trim();
    if (trimmed && !importNames.includes(trimmed)) {
      setImportNames([...importNames, trimmed]);
      setNewAlias("");
    }
  }

  function handleRemoveAlias(alias: string) {
    setImportNames(importNames.filter((a) => a !== alias));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await updateSecurityAction({
        id: security.id,
        symbol,
        exchange,
        name,
        currency: currency as "CAD" | "USD",
        assetClass: assetClass as typeof ASSET_CLASSES[number],
        dataSource: dataSource as typeof DATA_SOURCES[number],
        delisted,
        sector: sector || null,
        industry: industry || null,
        manualDividendOverride,
        annualDividendDollars: annualDividend ? parseFloat(annualDividend) : null,
        dividendFrequency: (dividendFrequency !== "none" ? dividendFrequency : null) as "monthly" | "quarterly" | "semi-annual" | "annual" | null,
        dividendGrowthYears: dividendGrowthYears ? parseInt(dividendGrowthYears, 10) : null,
        isDividendAristocrat,
        isDividendKing,
        isPaysMonthly,
        manualPrice: manualPrice ? parseFloat(manualPrice) : null,
        importNames,
        notes: notes || null,
      });

      if (result.error) {
        setError(result.error);
      } else {
        toast.success(t("securityUpdated"));
        router.refresh();
        onSuccess();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
      {error && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      )}

      {/* Identity */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">{t("identity")}</legend>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="sec-symbol">{t("columnSymbol")}</Label>
            <Input id="sec-symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sec-exchange">Exchange</Label>
            <Select value={exchange} onValueChange={setExchange}>
              <SelectTrigger id="sec-exchange"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EXCHANGES.map((ex) => <SelectItem key={ex} value={ex}>{ex}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="sec-name">{t("columnName")}</Label>
          <Input id="sec-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label htmlFor="sec-currency">{t("columnCurrency")}</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger id="sec-currency"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CAD">CAD</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="sec-assetClass">{t("columnAssetClass")}</Label>
            <Select value={assetClass} onValueChange={setAssetClass}>
              <SelectTrigger id="sec-assetClass"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ASSET_CLASSES.map((ac) => <SelectItem key={ac} value={ac}>{ac.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="sec-dataSource">Source</Label>
            <Select value={dataSource} onValueChange={setDataSource}>
              <SelectTrigger id="sec-dataSource"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DATA_SOURCES.map((ds) => <SelectItem key={ds} value={ds}>{ds}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="sec-delisted" checked={delisted} onCheckedChange={setDelisted} />
          <Label htmlFor="sec-delisted">{t("flagDelisted")}</Label>
        </div>
      </fieldset>

      {/* Classification */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">{t("classification")}</legend>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="sec-sector">Sector</Label>
            <Input id="sec-sector" value={sector} onChange={(e) => setSector(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sec-industry">Industry</Label>
            <Input id="sec-industry" value={industry} onChange={(e) => setIndustry(e.target.value)} />
          </div>
        </div>
      </fieldset>

      {/* Dividends */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">{t("dividendInfo")}</legend>
        <div className="flex items-center gap-2">
          <Switch id="sec-divOverride" checked={manualDividendOverride} onCheckedChange={setManualDividendOverride} />
          <Label htmlFor="sec-divOverride">{t("manualDividendOverride")}</Label>
        </div>
        {manualDividendOverride && (
          <p className="text-xs text-muted-foreground">{t("manualDividendOverrideHint")}</p>
        )}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label htmlFor="sec-divAmt">Annual dividend ($)</Label>
            <Input id="sec-divAmt" type="number" step="0.01" min="0" value={annualDividend} onChange={(e) => setAnnualDividend(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sec-divFreq">Frequency</Label>
            <Select value={dividendFrequency} onValueChange={setDividendFrequency}>
              <SelectTrigger id="sec-divFreq"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {FREQUENCIES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="sec-divGrowth">Growth years</Label>
            <Input id="sec-divGrowth" type="number" min="0" value={dividendGrowthYears} onChange={(e) => setDividendGrowthYears(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Switch id="sec-aristocrat" checked={isDividendAristocrat} onCheckedChange={setIsDividendAristocrat} />
            <Label htmlFor="sec-aristocrat">Aristocrat</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="sec-king" checked={isDividendKing} onCheckedChange={setIsDividendKing} />
            <Label htmlFor="sec-king">King</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="sec-monthly" checked={isPaysMonthly} onCheckedChange={setIsPaysMonthly} />
            <Label htmlFor="sec-monthly">Monthly</Label>
          </div>
        </div>
      </fieldset>

      {/* Pricing */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">{t("pricing")}</legend>
        <div className="space-y-1">
          <Label htmlFor="sec-manualPrice">Manual price ($)</Label>
          <Input id="sec-manualPrice" type="number" step="0.01" min="0" value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} />
          <p className="text-xs text-muted-foreground">{t("manualPriceHint")}</p>
        </div>
      </fieldset>

      {/* Import Aliases */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">{t("importAliases")}</legend>
        <p className="text-xs text-muted-foreground">{t("importAliasesHint")}</p>
        {importNames.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {importNames.map((alias) => (
              <Badge key={alias} variant="secondary" className="gap-1 pr-1">
                {alias}
                <button type="button" onClick={() => handleRemoveAlias(alias)} className="rounded-full hover:bg-muted-foreground/20 p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">{t("noAliases")}</p>
        )}
        <div className="flex gap-2">
          <Input
            value={newAlias}
            onChange={(e) => setNewAlias(e.target.value)}
            placeholder={t("aliasPlaceholder")}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddAlias(); } }}
          />
          <Button type="button" variant="outline" size="sm" onClick={handleAddAlias} disabled={!newAlias.trim()}>
            {t("addAlias")}
          </Button>
        </div>
      </fieldset>

      {/* Notes */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Notes</legend>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </fieldset>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        {security.dataSource === "YAHOO" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await refreshYahooProfileAction(security.id);
                if (result.error) toast.error(result.error);
                else {
                  toast.success(t("yahooRefreshed"));
                  router.refresh();
                  onSuccess();
                }
              });
            }}
          >
            <RefreshCwIcon className="mr-1.5 h-3.5 w-3.5" />
            {t("refreshYahoo")}
          </Button>
        )}
        <div className="flex-1" />
        <Button type="button" variant="outline" onClick={onCancel}>{tc("cancel")}</Button>
        <Button type="submit" disabled={pending}>
          {pending ? "..." : tc("save")}
        </Button>
      </div>
    </form>
  );
}
