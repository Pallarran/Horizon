"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { createSecurityAction, type SecurityActionState } from "@/lib/actions/securities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  onSuccess?: (securityId: string) => void;
  onCancel?: () => void;
}

export function NewSecurityForm({ onSuccess, onCancel }: Props) {
  const tc = useTranslations("common");
  const [state, formAction, pending] = useActionState<SecurityActionState, FormData>(
    createSecurityAction,
    {},
  );

  useEffect(() => {
    if (state.success && state.securityId) onSuccess?.(state.securityId);
  }, [state.success, state.securityId, onSuccess]);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Symbol</Label>
          <Input name="symbol" placeholder="ENB" required />
        </div>
        <div className="space-y-2">
          <Label>Exchange</Label>
          <Select name="exchange" defaultValue="TSX">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TSX">TSX</SelectItem>
              <SelectItem value="NYSE">NYSE</SelectItem>
              <SelectItem value="NASDAQ">NASDAQ</SelectItem>
              <SelectItem value="CBOE">CBOE</SelectItem>
              <SelectItem value="NEO">NEO</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Name</Label>
        <Input name="name" placeholder="Enbridge Inc." required />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Currency</Label>
          <Select name="currency" defaultValue="CAD">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="CAD">CAD</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Asset class</Label>
          <Select name="assetClass" defaultValue="CANADIAN_EQUITY">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="CANADIAN_EQUITY">Canadian Equity</SelectItem>
              <SelectItem value="US_EQUITY">US Equity</SelectItem>
              <SelectItem value="INTERNATIONAL_EQUITY">International Equity</SelectItem>
              <SelectItem value="ETF">ETF</SelectItem>
              <SelectItem value="REIT">REIT</SelectItem>
              <SelectItem value="BOND">Bond</SelectItem>
              <SelectItem value="PREFERRED_SHARE">Preferred Share</SelectItem>
              <SelectItem value="CRCD_SHARE">CRCD Share</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Industry (optional)</Label>
        <Input name="industry" placeholder="Oil & Gas" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Annual dividend ($)</Label>
          <Input name="annualDividendDollars" type="number" step="0.01" min="0" />
        </div>
        <div className="space-y-2">
          <Label>Frequency</Label>
          <Select name="dividendFrequency">
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="semi-annual">Semi-annual</SelectItem>
              <SelectItem value="annual">Annual</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Growth (years)</Label>
          <Input name="dividendGrowthYears" type="number" min="0" />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? tc("loading") : tc("create")}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            {tc("cancel")}
          </Button>
        )}
      </div>
    </form>
  );
}
