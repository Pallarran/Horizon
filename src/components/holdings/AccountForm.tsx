"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  createAccountAction,
  updateAccountAction,
  type AccountActionState,
} from "@/lib/actions/accounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Account {
  id: string;
  name: string;
  type: string;
  currency: string;
  externalId: string | null;
}

interface Props {
  account?: Account;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function AccountForm({ account, onSuccess, onCancel }: Props) {
  const tc = useTranslations("common");
  const t = useTranslations("holdings");
  const isEdit = !!account;

  const [state, formAction, pending] = useActionState<
    AccountActionState,
    FormData
  >(isEdit ? updateAccountAction : createAccountAction, {});

  useEffect(() => {
    if (state.success) onSuccess?.();
  }, [state.success, onSuccess]);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      {isEdit && <input type="hidden" name="id" value={account.id} />}

      <div className="space-y-2">
        <Label>{t("accountName")}</Label>
        <Input
          name="name"
          placeholder="CELI (CAD)"
          defaultValue={account?.name ?? ""}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t("type")}</Label>
          <Select name="type" defaultValue={account?.type ?? "CELI"}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CELI">{t("accountTypeCELI")}</SelectItem>
              <SelectItem value="REER">{t("accountTypeREER")}</SelectItem>
              <SelectItem value="MARGE">{t("accountTypeMARGE")}</SelectItem>
              <SelectItem value="CRCD">{t("accountTypeCRCD")}</SelectItem>
              <SelectItem value="CASH">{t("accountTypeCASH")}</SelectItem>
              <SelectItem value="OTHER">{t("accountTypeOTHER")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("currency")}</Label>
          <Select name="currency" defaultValue={account?.currency ?? "CAD"}>
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

      <div className="space-y-2">
        <Label>{t("broker")}</Label>
        <Input
          name="externalId"
          placeholder="20K6HZ6"
          defaultValue={account?.externalId ?? ""}
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? tc("loading") : isEdit ? tc("save") : tc("create")}
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
