"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function BackfillProfilesButton() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleBackfill() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/backfill-yahoo-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(`${tc("error")}: ${data.error}`);
      } else {
        setResult(
          t("backfillProfileResult", {
            updated: data.updated,
            skipped: data.skipped,
            errors: data.errors,
          }),
        );
      }
    } catch {
      setResult(t("networkError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="sm" onClick={handleBackfill} disabled={loading}>
        {loading ? t("backfillProfileRunning") : t("backfillProfiles")}
      </Button>
      {result && <span className="text-xs text-muted-foreground">{result}</span>}
    </div>
  );
}
