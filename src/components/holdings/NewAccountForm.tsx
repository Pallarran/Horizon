"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { createAccountAction, type AccountActionState } from "@/lib/actions/accounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function NewAccountForm({ onSuccess, onCancel }: Props) {
  const tc = useTranslations("common");
  const [state, formAction, pending] = useActionState<AccountActionState, FormData>(
    createAccountAction,
    {},
  );

  useEffect(() => {
    if (state.success) onSuccess?.();
  }, [state.success, onSuccess]);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="space-y-2">
        <Label>Account name</Label>
        <Input name="name" placeholder="CELI (CAD)" required />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select name="type" defaultValue="CELI">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="CELI">CELI (TFSA)</SelectItem>
              <SelectItem value="REER">REER (RRSP)</SelectItem>
              <SelectItem value="MARGE">Marge (Non-registered)</SelectItem>
              <SelectItem value="CRCD">CRCD</SelectItem>
              <SelectItem value="CASH">Cash</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
      </div>

      <div className="space-y-2">
        <Label>Broker account # (optional)</Label>
        <Input name="externalId" placeholder="20K6HZ6" />
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
