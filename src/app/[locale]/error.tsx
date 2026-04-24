"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error("[Horizon]", error.message);
  }, [error]);

  return (
    <main className="flex min-h-[60dvh] items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <h1 className="text-xl font-semibold">{t("errorTitle")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("errorDescription")}
          </p>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={reset}>
              {t("tryAgain")}
            </Button>
            <Button asChild>
              <Link href="/dashboard">{t("backToDashboard")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
