"use client";

import { useActionState, useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { createTransactionAction, type TransactionActionState } from "@/lib/actions/transactions";
import { SecurityCombobox } from "./SecurityCombobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Account {
  id: string;
  name: string;
  currency: string;
}

interface Props {
  accounts: Account[];
  onSuccess?: () => void;
  onCancel?: () => void;
}

const TXN_TYPES_WITH_SECURITY = ["BUY", "SELL", "DIVIDEND", "DRIP", "SPLIT", "MERGER"];
const TXN_TYPES_WITH_QTY = ["BUY", "SELL", "DRIP", "SPLIT"];

export function TransactionForm({ accounts, onSuccess, onCancel }: Props) {
  const t = useTranslations("holdings");
  const tc = useTranslations("common");
  const [state, formAction, pending] = useActionState<TransactionActionState, FormData>(
    createTransactionAction,
    {},
  );

  const [txnType, setTxnType] = useState("BUY");
  const [accountId, setAccountId] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("horizon_lastAccountId") ?? accounts[0]?.id ?? "";
    }
    return accounts[0]?.id ?? "";
  });
  const [securityId, setSecurityId] = useState<string | null>(null);
  const [currency, setCurrency] = useState("CAD");
  const [quantity, setQuantity] = useState("");
  const [priceDollars, setPriceDollars] = useState("");
  const [amountDollars, setAmountDollars] = useState("");
  const [showNewSecurity, setShowNewSecurity] = useState(false);

  // Auto-compute amount when quantity and price change (for BUY/SELL)
  useEffect(() => {
    if (TXN_TYPES_WITH_QTY.includes(txnType) && quantity && priceDollars) {
      const qty = parseFloat(quantity);
      const price = parseFloat(priceDollars);
      if (!isNaN(qty) && !isNaN(price)) {
        const amount = txnType === "SELL" ? qty * price : -(qty * price);
        setAmountDollars(amount.toFixed(2));
      }
    }
  }, [quantity, priceDollars, txnType]);

  // Update currency when account changes
  const handleAccountChange = useCallback((id: string) => {
    setAccountId(id);
    const acct = accounts.find((a) => a.id === id);
    if (acct) setCurrency(acct.currency);
    if (typeof window !== "undefined") {
      localStorage.setItem("horizon_lastAccountId", id);
    }
  }, [accounts]);

  // On success, notify parent
  useEffect(() => {
    if (state.success) onSuccess?.();
  }, [state.success, onSuccess]);

  const needsSecurity = TXN_TYPES_WITH_SECURITY.includes(txnType);
  const needsQty = TXN_TYPES_WITH_QTY.includes(txnType);
  const today = new Date().toISOString().split("T")[0];

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      {/* Hidden fields for server action */}
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="securityId" value={securityId ?? ""} />
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="amountDollars" value={amountDollars} />

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Transaction Type */}
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={txnType} onValueChange={setTxnType} name="type">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["BUY", "SELL", "DIVIDEND", "DRIP", "DEPOSIT", "WITHDRAWAL",
                "INTEREST", "FEE", "TAX_WITHHELD", "SPLIT", "MERGER", "ADJUSTMENT",
              ].map((type) => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Account */}
        <div className="space-y-2">
          <Label>{t("account")}</Label>
          <Select value={accountId} onValueChange={handleAccountChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select account..." />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date */}
        <div className="space-y-2">
          <Label>Date</Label>
          <Input type="date" name="date" defaultValue={today} required />
        </div>

        {/* Currency */}
        <div className="space-y-2">
          <Label>{t("currency")}</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CAD">CAD</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Security picker */}
      {needsSecurity && (
        <div className="space-y-2">
          <Label>{t("symbol")}</Label>
          <SecurityCombobox
            value={securityId}
            onChange={(id) => setSecurityId(id)}
            onCreateNew={() => setShowNewSecurity(true)}
          />
          {showNewSecurity && (
            <p className="text-xs text-muted-foreground">
              Create the security from Settings first, then search for it here.
            </p>
          )}
        </div>
      )}

      {/* Quantity + Price (for BUY/SELL/DRIP/SPLIT) */}
      {needsQty && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("quantity")}</Label>
            <Input
              type="number"
              name="quantity"
              step="any"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Price ($)</Label>
            <Input
              type="number"
              name="priceDollars"
              step="0.01"
              min="0"
              value={priceDollars}
              onChange={(e) => setPriceDollars(e.target.value)}
              required
            />
          </div>
        </div>
      )}

      {/* Amount (auto-computed for BUY/SELL, manual for others) */}
      <div className="space-y-2">
        <Label>Amount ($) {needsQty && <span className="text-xs text-muted-foreground">(auto-computed)</span>}</Label>
        <Input
          type="number"
          step="0.01"
          value={amountDollars}
          onChange={(e) => setAmountDollars(e.target.value)}
          readOnly={needsQty}
          required
          className={needsQty ? "bg-muted" : ""}
        />
        <p className="text-xs text-muted-foreground">
          Negative = money out (BUY), Positive = money in (SELL, DIVIDEND)
        </p>
      </div>

      {/* Fee */}
      <div className="space-y-2">
        <Label>Fee ($)</Label>
        <Input type="number" name="feeDollars" step="0.01" min="0" defaultValue="0" />
      </div>

      {/* Note */}
      <div className="space-y-2">
        <Label>Note</Label>
        <Textarea name="note" rows={2} maxLength={500} />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? tc("loading") : t("addTransaction")}
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
