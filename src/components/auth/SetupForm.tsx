"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { setupAction, type AuthActionState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function SetupForm() {
  const t = useTranslations("setup");
  const tAuth = useTranslations("auth");
  const [state, action, pending] = useActionState<AuthActionState, FormData>(
    setupAction,
    null,
  );

  return (
    <Card className="w-full max-w-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          {state?.error && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {state.error}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">{tAuth("email")}</Label>
            <Input id="email" name="email" type="email" required />
            <FieldError errors={state?.fieldErrors?.email} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">{t("displayName")}</Label>
            <Input id="displayName" name="displayName" required />
            <FieldError errors={state?.fieldErrors?.displayName} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="birthYear">{t("birthYear")}</Label>
              <Input
                id="birthYear"
                name="birthYear"
                type="number"
                min={1940}
                max={2010}
                required
              />
              <FieldError errors={state?.fieldErrors?.birthYear} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetRetirementAge">{t("retirementAge")}</Label>
              <Input
                id="targetRetirementAge"
                name="targetRetirementAge"
                type="number"
                min={40}
                max={80}
                defaultValue={55}
                required
              />
              <FieldError errors={state?.fieldErrors?.targetRetirementAge} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="currentSalary">{t("salary")}</Label>
            <Input
              id="currentSalary"
              name="currentSalary"
              type="number"
              step="0.01"
              min="0"
              placeholder="85000.00"
              required
            />
            <FieldError errors={state?.fieldErrors?.currentSalaryCents} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="locale">{t("locale")}</Label>
            <select
              id="locale"
              name="locale"
              defaultValue="fr-CA"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="fr-CA">Français (Canada)</option>
              <option value="en-CA">English (Canada)</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{tAuth("password")}</Label>
            <Input id="password" name="password" type="password" minLength={12} required />
            <FieldError errors={state?.fieldErrors?.password} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{tAuth("confirmPassword")}</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              minLength={12}
              required
            />
            <FieldError errors={state?.fieldErrors?.confirmPassword} />
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "..." : t("submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p className="text-sm text-destructive">{errors[0]}</p>
  );
}
