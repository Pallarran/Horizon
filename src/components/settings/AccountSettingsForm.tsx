"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateProfileAction, type SettingsActionState } from "@/lib/actions/settings";
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

export function AccountSettingsForm({
  displayName,
  locale,
  theme,
  currentSalaryCents,
  targetRetirementAge,
}: {
  displayName: string;
  locale: string;
  theme: string;
  currentSalaryCents: number;
  targetRetirementAge: number;
}) {
  const t = useTranslations("settings");
  const tSetup = useTranslations("setup");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState<SettingsActionState, FormData>(
    updateProfileAction,
    null,
  );

  return (
    <form action={action} className="max-w-md space-y-4">
      {state?.error && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="rounded-md bg-gain/10 p-3 text-sm text-gain">
          {tCommon("success")}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="displayName">{tSetup("displayName")}</Label>
        <Input
          id="displayName"
          name="displayName"
          defaultValue={displayName}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>{t("language")}</Label>
        <Select name="locale" defaultValue={locale}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fr-CA">Français (Canada)</SelectItem>
            <SelectItem value="en-CA">English (Canada)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>{t("theme")}</Label>
        <Select name="theme" defaultValue={theme}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="system">{t("themeSystem")}</SelectItem>
            <SelectItem value="light">{t("themeLight")}</SelectItem>
            <SelectItem value="dark">{t("themeDark")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="currentSalary">{tSetup("salary")}</Label>
        <div className="relative max-w-48">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
          <Input
            id="currentSalary"
            name="currentSalary"
            type="number"
            className="pl-7"
            defaultValue={Math.round(currentSalaryCents / 100)}
            min={0}
            step={1}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="targetRetirementAge">{tSetup("retirementAge")}</Label>
        <Input
          id="targetRetirementAge"
          name="targetRetirementAge"
          type="number"
          className="max-w-24"
          defaultValue={targetRetirementAge}
          min={40}
          max={80}
          step={1}
          required
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? tCommon("loading") : tCommon("save")}
      </Button>
    </form>
  );
}
