"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function FetchPricesButton() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();

  async function handleFetch() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/fetch-prices", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setResult(`${tc("error")}: ${data.error}`);
      } else {
        setResult(
          t("fetchResult", {
            fetched: data.prices.fetched,
            errors: data.prices.errors,
            fx: data.fx.fetched,
          }),
        );
        router.refresh();
      }
    } catch {
      setResult(t("networkError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="sm" onClick={handleFetch} disabled={loading}>
        {loading ? t("fetching") : t("fetchPrices")}
      </Button>
      {result && <span className="text-xs text-muted-foreground">{result}</span>}
    </div>
  );
}
