"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { changePasswordAction, type AuthActionState } from "@/lib/actions/auth";
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

export function ChangePasswordForm({ mustChange }: { mustChange: boolean }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<AuthActionState, FormData>(
    changePasswordAction,
    null,
  );

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{t("changePassword")}</CardTitle>
        {mustChange && (
          <CardDescription>{t("mustChangePassword")}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          {state?.error && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {state.error}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="currentPassword">{t("currentPassword")}</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              required
              autoFocus
            />
            <FieldError errors={state?.fieldErrors?.currentPassword} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">{t("newPassword")}</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              minLength={12}
              required
            />
            <FieldError errors={state?.fieldErrors?.newPassword} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmNewPassword">{t("confirmPassword")}</Label>
            <Input
              id="confirmNewPassword"
              name="confirmNewPassword"
              type="password"
              minLength={12}
              required
            />
            <FieldError errors={state?.fieldErrors?.confirmNewPassword} />
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "..." : t("changePassword")}
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
