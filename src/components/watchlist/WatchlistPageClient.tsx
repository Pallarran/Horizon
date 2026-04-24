"use client";

import { useState, useCallback, useRef, useTransition, useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatMoney, formatPercent } from "@/lib/money/format";
import {
  addToWatchlistAction,
  removeFromWatchlistAction,
  updateWatchlistItemAction,
  type SerializedWatchlistItem,
  type WatchlistActionState,
} from "@/lib/actions/watchlist";
import type { SecurityProfileMap } from "@/lib/positions/security-profile";
import {
  SecurityCombobox,
} from "@/components/holdings/SecurityCombobox";
import { WatchlistDetailSheet } from "./WatchlistDetailSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const DELETE_UNDO_DURATION = 10_000;

interface PriceInfo {
  currentPriceCents: number;
  previousPriceCents: number | null;
}

interface Props {
  items: SerializedWatchlistItem[];
  priceMap: Record<string, PriceInfo>;
  securityProfiles: SecurityProfileMap;
  locale: string;
  usdCadRate: number;
}

export function WatchlistPageClient({
  items,
  priceMap,
  securityProfiles,
  locale,
  usdCadRate,
}: Props) {
  const t = useTranslations("watchlist");
  const tc = useTranslations("common");
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Optimistic deletes
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(() => new Set());
  const undoRef = useRef<Map<string, boolean>>(new Map());

  // Edit dialog
  const [editingItem, setEditingItem] = useState<SerializedWatchlistItem | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<SerializedWatchlistItem | null>(null);

  // Detail sheet
  const [selectedItem, setSelectedItem] = useState<SerializedWatchlistItem | null>(null);

  const handleDeleteWithUndo = useCallback((item: SerializedWatchlistItem) => {
    const id = item.id;
    // 1. Optimistically hide the row
    setPendingDeletes((prev) => new Set(prev).add(id));
    undoRef.current.set(id, false);

    const finalize = async () => {
      if (undoRef.current.get(id)) {
        // Undo was clicked — restore the row
        undoRef.current.delete(id);
        return;
      }
      undoRef.current.delete(id);
      // 2. Actually delete on server
      await removeFromWatchlistAction(id);
      startTransition(() => router.refresh());
    };

    // 3. Show toast with undo action
    toast(t("itemDeleted"), {
      duration: DELETE_UNDO_DURATION,
      action: {
        label: t("undo"),
        onClick: () => {
          undoRef.current.set(id, true);
          setPendingDeletes((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        },
      },
      onDismiss: finalize,
      onAutoClose: finalize,
    });
  }, [t, router, startTransition]);

  const handleEditSuccess = useCallback(() => {
    setEditingItem(null);
    toast.success(t("itemUpdated"));
    router.refresh();
  }, [t, router]);

  const visibleItems = items.filter((item) => !pendingDeletes.has(item.id));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <AddToWatchlistDialog
          onDone={() => router.refresh()}
          t={t}
        />
      </div>

      {visibleItems.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <p className="text-muted-foreground">{t("noItems")}</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("security")}</TableHead>
                <TableHead className="text-right">{t("currentPrice")}</TableHead>
                <TableHead className="text-right">{t("dayChange")}</TableHead>
                <TableHead className="text-right">{t("targetBuyPrice")}</TableHead>
                <TableHead className="text-right">{t("distanceToTarget")}</TableHead>
                <TableHead className="text-right">{t("yield")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("note")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleItems.map((item) => (
                <WatchlistRow
                  key={item.id}
                  item={item}
                  price={priceMap[item.securityId]}
                  locale={locale}
                  onClick={() => setSelectedItem(item)}
                  onEdit={() => setEditingItem(item)}
                  onDelete={() => setDeleteTarget(item)}
                  t={t}
                  tc={tc}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={t("confirmRemoveTitle")}
        description={
          deleteTarget
            ? t("confirmRemoveDesc", { symbol: deleteTarget.symbol })
            : ""
        }
        confirmLabel={tc("delete")}
        cancelLabel={tc("cancel")}
        onConfirm={() => {
          if (deleteTarget) handleDeleteWithUndo(deleteTarget);
          setDeleteTarget(null);
        }}
      />

      {/* Edit dialog */}
      <Dialog
        open={!!editingItem}
        onOpenChange={(open) => { if (!open) setEditingItem(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {tc("edit")} — {editingItem?.symbol}
            </DialogTitle>
          </DialogHeader>
          {editingItem && (
            <EditWatchlistForm
              item={editingItem}
              onSuccess={handleEditSuccess}
              onCancel={() => setEditingItem(null)}
              t={t}
              tc={tc}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Detail sheet */}
      <WatchlistDetailSheet
        item={selectedItem}
        profile={selectedItem ? securityProfiles[selectedItem.securityId] : undefined}
        price={selectedItem ? priceMap[selectedItem.securityId] : undefined}
        open={!!selectedItem}
        onOpenChange={(open) => { if (!open) setSelectedItem(null); }}
        locale={locale}
        onEdit={() => {
          if (selectedItem) setEditingItem(selectedItem);
        }}
        onDelete={() => {
          if (selectedItem) setDeleteTarget(selectedItem);
        }}
      />
    </div>
  );
}

/* ── Table Row ── */

function WatchlistRow({
  item,
  price,
  locale,
  onClick,
  onEdit,
  onDelete,
  t,
  tc,
}: {
  item: SerializedWatchlistItem;
  price?: PriceInfo;
  locale: string;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  t: ReturnType<typeof useTranslations>;
  tc: ReturnType<typeof useTranslations>;
}) {
  const currentCents = price?.currentPriceCents ?? 0;
  const previousCents = price?.previousPriceCents;
  const dayChangeCents = previousCents != null ? currentCents - previousCents : 0;
  const dayChangePct =
    previousCents != null && previousCents > 0
      ? dayChangeCents / previousCents
      : 0;
  const dayPositive = dayChangeCents >= 0;

  const currency = item.currency === "USD" ? "USD" : "CAD";

  // Distance to target
  let distancePct: number | null = null;
  let belowTarget = false;
  if (item.targetBuyPriceCents && currentCents > 0) {
    distancePct =
      (currentCents - item.targetBuyPriceCents) / item.targetBuyPriceCents;
    belowTarget = currentCents <= item.targetBuyPriceCents;
  }

  return (
    <TableRow className="cursor-pointer" onClick={onClick}>
      {/* Security */}
      <TableCell>
        <div>
          <span className="font-medium">{item.symbol}</span>
          <span className="ml-2 text-sm text-muted-foreground">{item.name}</span>
        </div>
        {item.sector && (
          <span className="text-xs text-muted-foreground">{item.sector}</span>
        )}
      </TableCell>

      {/* Current price */}
      <TableCell className="text-right font-medium">
        {currentCents > 0
          ? formatMoney(currentCents, locale, currency)
          : "—"}
      </TableCell>

      {/* Day change */}
      <TableCell className="text-right">
        {previousCents != null ? (
          <span className={dayPositive ? "text-gain" : "text-loss"}>
            {dayPositive ? "+" : ""}
            {formatPercent(dayChangePct, locale, 1)}
          </span>
        ) : (
          "—"
        )}
      </TableCell>

      {/* Target price */}
      <TableCell className="text-right">
        {item.targetBuyPriceCents
          ? formatMoney(item.targetBuyPriceCents, locale, currency)
          : <span className="text-muted-foreground">—</span>}
      </TableCell>

      {/* Distance to target */}
      <TableCell className="text-right">
        {distancePct !== null ? (
          <Badge variant={belowTarget ? "default" : "secondary"}>
            {belowTarget ? "↓ " : "↑ "}
            {formatPercent(Math.abs(distancePct), locale, 1)}
          </Badge>
        ) : (
          "—"
        )}
      </TableCell>

      {/* Yield */}
      <TableCell className="text-right">
        {item.annualDividendCents != null && item.annualDividendCents > 0 && currentCents > 0
          ? formatPercent(item.annualDividendCents / currentCents, locale, 1)
          : "—"}
      </TableCell>

      {/* Note */}
      <TableCell className="hidden max-w-[200px] truncate text-sm text-muted-foreground md:table-cell">
        {item.note || ""}
      </TableCell>

      {/* Actions dropdown */}
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              {tc("edit")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={onDelete}
            >
              {tc("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

/* ── Edit watchlist item form ── */

function EditWatchlistForm({
  item,
  onSuccess,
  onCancel,
  t,
  tc,
}: {
  item: SerializedWatchlistItem;
  onSuccess: () => void;
  onCancel: () => void;
  t: ReturnType<typeof useTranslations>;
  tc: ReturnType<typeof useTranslations>;
}) {
  const [state, formAction, isPending] = useActionState(
    updateWatchlistItemAction,
    {} as WatchlistActionState,
  );

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={item.id} />

      <div>
        <Label>{t("targetBuyPrice")}</Label>
        <Input
          name="targetBuyPriceDollars"
          type="number"
          step="0.01"
          defaultValue={
            item.targetBuyPriceCents
              ? (item.targetBuyPriceCents / 100).toFixed(2)
              : ""
          }
          placeholder="0.00"
        />
      </div>

      <div>
        <Label>{t("note")}</Label>
        <Input
          name="note"
          maxLength={500}
          defaultValue={item.note || ""}
        />
      </div>

      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? t("saving") : tc("save")}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {tc("cancel")}
        </Button>
      </div>
    </form>
  );
}

/* ── Add to watchlist dialog ── */

function AddToWatchlistDialog({
  onDone,
  t,
}: {
  onDone: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [open, setOpen] = useState(false);
  const [securityId, setSecurityId] = useState<string | null>(null);
  const [state, formAction, isPending] = useActionState(
    addToWatchlistAction,
    {} as WatchlistActionState,
  );

  useEffect(() => {
    if (state.success) {
      setOpen(false);
      setSecurityId(null);
      onDone();
    }
  }, [state.success, onDone]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{t("addToWatchlist")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("addToWatchlist")}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="securityId" value={securityId ?? ""} />

          <div>
            <Label>{t("security")}</Label>
            <SecurityCombobox
              value={securityId}
              onChange={(id) => setSecurityId(id)}
            />
          </div>

          <div>
            <Label>{t("targetBuyPrice")}</Label>
            <Input
              name="targetBuyPriceDollars"
              type="number"
              step="0.01"
              placeholder="0.00"
            />
          </div>

          <div>
            <Label>{t("note")}</Label>
            <Input name="note" maxLength={500} />
          </div>

          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={isPending || !securityId}>
              {isPending ? t("saving") : t("save")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
