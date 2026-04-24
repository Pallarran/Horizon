"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/money/format";
import { saveReerLimitAction } from "@/lib/actions/contributions";
import type { ContributionYearRow } from "@/lib/contributions/compute";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ReerLimitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: ContributionYearRow;
  locale: string;
  onUpdate: (rows: ContributionYearRow[]) => void;
}

export function ReerLimitDialog({
  open,
  onOpenChange,
  row,
  locale,
  onUpdate,
}: ReerLimitDialogProps) {
  const t = useTranslations("contributions");
  const [limitInput, setLimitInput] = useState(
    (row.reerLimitCents / 100).toString(),
  );
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const formData = new FormData();
    formData.set("year", row.year.toString());
    formData.set("limitDollars", limitInput || "0");
    startTransition(async () => {
      const result = await saveReerLimitAction({}, formData);
      if (result.success && result.rows) {
        onUpdate(result.rows);
        onOpenChange(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("editReerLimit", { year: row.year })}</DialogTitle>
          <DialogDescription>
            {t("reerLimitDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">$</span>
            <Input
              type="number"
              min="0"
              step="100"
              value={limitInput}
              onChange={(e) => setLimitInput(e.target.value)}
              placeholder={(row.reerCraLimitCents / 100).toString()}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {t("craMaxReference", {
              amount: formatMoney(row.reerCraLimitCents, locale),
            })}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
