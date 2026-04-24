"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

const STALE_MS = 4 * 60 * 60 * 1000; // 4 hours
const SESSION_KEY = "horizon_price_fetch_triggered";

interface AutoPriceRefreshProps {
  lastPriceDate: string | null;
}

export function AutoPriceRefresh({ lastPriceDate }: AutoPriceRefreshProps) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const triggered = useRef(false);

  useEffect(() => {
    if (triggered.current) return;

    // Check if already triggered this session
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
    } catch {
      // sessionStorage unavailable (SSR, iframe, etc.)
    }

    // Check staleness
    if (lastPriceDate) {
      const age = Date.now() - new Date(lastPriceDate).getTime();
      if (age < STALE_MS) return;
    }

    triggered.current = true;

    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // ignore
    }

    const toastId = toast.loading(t("pricesRefreshing"));

    fetch("/api/prices/refresh", { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        if (data.skipped) {
          toast.dismiss(toastId);
          return;
        }
        if (data.error) {
          toast.error(data.error, { id: toastId });
          return;
        }
        toast.success(
          t("pricesRefreshed", {
            fetched: data.prices?.fetched ?? 0,
            fx: data.fx?.fetched ?? 0,
          }),
          { id: toastId },
        );
        router.refresh();
      })
      .catch(() => {
        toast.dismiss(toastId);
      });
  }, [lastPriceDate, t, router]);

  return null;
}
