"use client";

import { useActionState, useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  createTransactionAction,
  updateTransactionAction,
  type TransactionActionState,
  type SerializedTransaction,
} from "@/lib/actions/transactions";
import { SecurityCombobox } from "./SecurityCombobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TXN_TYPES, TXN_TYPES_WITH_SECURITY, TXN_TYPES_WITH_QTY } from "@/lib/constants/transactions";

interface Account {
  id: string;
  name: string;
  currency: string;
}

interface Props {
  accounts: Account[];
  transaction?: SerializedTransaction;
  onSuccess?: () => void;
  onCancel?: () => void;
  defaultAccountId?: string;
  defaultSecurityId?: string;
  defaultSecuritySymbol?: string;
  defaultSecurityName?: string;
}

function centsToDollarsStr(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function TransactionForm({ accounts, transaction, onSuccess, onCancel, defaultAccountId, defaultSecurityId, defaultSecuritySymbol, defaultSecurityName }: Props) {
  const t = useTranslations("holdings");
  const tc = useTranslations("common");
  const isEdit = !!transaction;

  const [state, formAction, pending] = useActionState<TransactionActionState, FormData>(
    isEdit ? updateTransactionAction : createTransactionAction,
    {},
  );

  const [txnType, setTxnType] = useState(transaction?.type ?? "BUY");
  const [accountId, setAccountId] = useState(() => {
    if (transaction) return transaction.accountId;
    if (defaultAccountId) return defaultAccountId;
    if (typeof window !== "undefined") {
      return localStorage.getItem("horizon_lastAccountId") ?? accounts[0]?.id ?? "";
    }
    return accounts[0]?.id ?? "";
  });
  const [securityId, setSecurityId] = useState<string | null>(transaction?.securityId ?? defaultSecurityId ?? null);
  const [currency, setCurrency] = useState(transaction?.currency ?? "CAD");
  const [quantity, setQuantity] = useState(
    transaction?.quantity != null ? String(transaction.quantity) : "",
  );
  const [priceDollars, setPriceDollars] = useState(
    transaction?.priceCents != null ? centsToDollarsStr(transaction.priceCents) : "",
  );
  const [amountDollars, setAmountDollars] = useState(
    transaction ? centsToDollarsStr(transaction.amountCents) : "",
  );

  // Auto-compute amount when quantity and price change (for BUY/SELL)
  useEffect(() => {
    if ((TXN_TYPES_WITH_QTY as readonly string[]).includes(txnType) && quantity && priceDollars) {
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

  const needsSecurity = (TXN_TYPES_WITH_SECURITY as readonly string[]).includes(txnType);
  const needsQty = (TXN_TYPES_WITH_QTY as readonly string[]).includes(txnType);
  const today = new Date().toISOString().split("T")[0];

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      {/* Hidden fields for server action */}
      {isEdit && <input type="hidden" name="id" value={transaction.id} />}
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="securityId" value={securityId ?? ""} />
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="amountDollars" value={amountDollars} />

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Transaction Type */}
        <div className="space-y-2">
          <Label>{t("type")}</Label>
          <Select value={txnType} onValueChange={setTxnType} name="type">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TXN_TYPES.map((type) => (
                <SelectItem key={type} value={type}>{t(`txnType${type}` as Parameters<typeof t>[0])}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Account */}
        <div className="space-y-2">
          <Label>{t("account")}</Label>
          <Select value={accountId} onValueChange={handleAccountChange}>
            <SelectTrigger>
              <SelectValue placeholder={t("selectAccount")} />
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
          <Label>{t("date")}</Label>
          <Input type="date" name="date" defaultValue={transaction?.date ?? today} required />
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
            initialSecurity={
              transaction?.securityId
                ? { id: transaction.securityId, symbol: transaction.securitySymbol!, name: transaction.securityName! }
                : defaultSecurityId && defaultSecuritySymbol && defaultSecurityName
                  ? { id: defaultSecurityId, symbol: defaultSecuritySymbol, name: defaultSecurityName }
                  : null
            }
          />
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
            <Label>{t("price")}</Label>
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
        <Label>{t("amountDollars")} {needsQty && <span className="text-xs text-muted-foreground">({t("autoComputed")})</span>}</Label>
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
          {t("amountHint")}
        </p>
      </div>

      {/* Fee */}
      <div className="space-y-2">
        <Label>{t("feeDollars")}</Label>
        <Input
          type="number"
          name="feeDollars"
          step="0.01"
          min="0"
          defaultValue={transaction ? centsToDollarsStr(transaction.feeCents) : "0"}
        />
      </div>

      {/* Note */}
      <div className="space-y-2">
        <Label>{t("note")}</Label>
        <Textarea name="note" rows={2} maxLength={500} defaultValue={transaction?.note ?? ""} />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? tc("loading") : isEdit ? tc("save") : t("addTransaction")}
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
