"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { loginAction, type AuthActionState } from "@/lib/actions/auth";
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

export function LoginForm() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState<AuthActionState, FormData>(
    loginAction,
    null,
  );

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{tCommon("appName")}</CardTitle>
        <CardDescription>{t("login")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          {state?.error && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {state.error}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input id="email" name="email" type="email" required autoFocus />
            <FieldError errors={state?.fieldErrors?.email} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t("password")}</Label>
            <Input id="password" name="password" type="password" required />
            <FieldError errors={state?.fieldErrors?.password} />
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "..." : t("login")}
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
