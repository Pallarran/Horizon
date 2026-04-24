import Link from "next/link";
import { useTranslations } from "next-intl";
import { FileQuestion } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  const t = useTranslations("errors");

  return (
    <main className="flex min-h-[60dvh] items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8">
          <FileQuestion className="h-12 w-12 text-muted-foreground" />
          <h1 className="text-xl font-semibold">{t("notFoundTitle")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("notFoundDescription")}
          </p>
          <Button asChild className="mt-2">
            <Link href="/dashboard">{t("backToDashboard")}</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
