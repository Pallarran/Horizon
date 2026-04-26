"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

interface ImportSummaryProps {
  created: number;
  skipped: number;
  errors: number;
  batchId: string;
  onImportAnother: () => void;
}

export function ImportSummary({
  created,
  skipped,
  errors,
  onImportAnother,
}: ImportSummaryProps) {
  const t = useTranslations("import");

  return (
    <Card className="mx-auto max-w-md text-center">
      <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8">
        <CheckCircle2 className="h-12 w-12 text-emerald-500" />
        <h2 className="text-xl font-semibold">{t("importComplete")}</h2>

        <div className="flex gap-6 text-sm">
          <div>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {created}
            </p>
            <p className="text-muted-foreground">{t("imported")}</p>
          </div>
          {skipped > 0 && (
            <div>
              <p className="text-2xl font-bold text-muted-foreground">
                {skipped}
              </p>
              <p className="text-muted-foreground">{t("skippedLabel")}</p>
            </div>
          )}
          {errors > 0 && (
            <div>
              <p className="text-2xl font-bold text-destructive">{errors}</p>
              <p className="text-muted-foreground">{t("errorsLabel")}</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button asChild>
            <Link href="/transactions">{t("viewTransactions")}</Link>
          </Button>
          <Button variant="outline" onClick={onImportAnother}>
            {t("importAnother")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
