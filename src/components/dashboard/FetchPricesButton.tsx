"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function FetchPricesButton() {
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
        setResult(`Error: ${data.error}`);
      } else {
        setResult(
          `Prices: ${data.prices.fetched} fetched, ${data.prices.errors} errors · FX: ${data.fx.fetched} rates`,
        );
        router.refresh();
      }
    } catch {
      setResult("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="sm" onClick={handleFetch} disabled={loading}>
        {loading ? "Fetching..." : "Fetch prices now"}
      </Button>
      {result && <span className="text-xs text-muted-foreground">{result}</span>}
    </div>
  );
}
