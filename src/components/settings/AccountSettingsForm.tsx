"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateProfileAction, type SettingsActionState } from "@/lib/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AccountSettingsForm({
  displayName,
  locale,
  theme,
}: {
  displayName: string;
  locale: string;
  theme: string;
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
        <Label htmlFor="locale">{t("language")}</Label>
        <select
          id="locale"
          name="locale"
          defaultValue={locale}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="fr-CA">Français (Canada)</option>
          <option value="en-CA">English (Canada)</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="theme">{t("theme")}</Label>
        <select
          id="theme"
          name="theme"
          defaultValue={theme}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="system">{t("themeSystem")}</option>
          <option value="light">{t("themeLight")}</option>
          <option value="dark">{t("themeDark")}</option>
        </select>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "..." : tCommon("save")}
      </Button>
    </form>
  );
}
