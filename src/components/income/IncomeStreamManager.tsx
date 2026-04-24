"use client";

import { useState, useActionState, useEffect, useCallback, useRef, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";
import { formatMoney } from "@/lib/money/format";
import {
  createIncomeStreamAction,
  updateIncomeStreamAction,
  deleteIncomeStreamAction,
} from "@/lib/actions/income-streams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

const DELETE_UNDO_DURATION = 10_000;

interface SerializedIncomeStream {
  id: string;
  name: string;
  type: string;
  startAge: number;
  endAge: number | null;
  annualAmountCents: number | null;
  computedFromPensionId: string | null;
  inflationIndexed: boolean;
  notes: string | null;
}

interface IncomeStreamManagerProps {
  streams: SerializedIncomeStream[];
  locale: string;
}

const STREAM_TYPE_KEYS: Record<string, string> = {
  PENSION: "streamTypePension",
  GOVERNMENT_BENEFIT: "streamTypeGovernment",
  RENTAL: "streamTypeRental",
  OTHER: "streamTypeOther",
};

export function IncomeStreamManager({ streams, locale }: IncomeStreamManagerProps) {
  const t = useTranslations("income");
  const tc = useTranslations("common");
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingStream, setEditingStream] = useState<SerializedIncomeStream | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SerializedIncomeStream | null>(null);

  // Optimistic deletes
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(() => new Set());
  const undoRef = useRef<Map<string, boolean>>(new Map());

  const handleDeleteWithUndo = useCallback((stream: SerializedIncomeStream) => {
    const id = stream.id;
    setPendingDeletes((prev) => new Set(prev).add(id));
    undoRef.current.set(id, false);

    const finalize = async () => {
      if (undoRef.current.get(id)) {
        undoRef.current.delete(id);
        return;
      }
      undoRef.current.delete(id);
      await deleteIncomeStreamAction(id);
      startTransition(() => router.refresh());
    };

    toast(t("streamDeleted"), {
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
    setEditingStream(null);
    toast.success(t("streamUpdated"));
    router.refresh();
  }, [t, router]);

  const handleAddSuccess = useCallback(() => {
    setShowAddForm(false);
    toast.success(t("streamAdded"));
    router.refresh();
  }, [t, router]);

  const visibleStreams = streams.filter((s) => !pendingDeletes.has(s.id));

  return (
    <div className="space-y-4">
      {/* Add button at top */}
      <div className="flex justify-end">
        <Button
          onClick={() => setShowAddForm(true)}
          size="icon-sm"
          className="sm:hidden"
        >
          <PlusIcon className="size-4" />
        </Button>
        <Button
          onClick={() => setShowAddForm(true)}
          className="hidden sm:inline-flex"
        >
          {t("addStream")}
        </Button>
      </div>

      {visibleStreams.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <p className="text-muted-foreground">{t("noStreams")}</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("streamName")}</TableHead>
                <TableHead>{t("streamType")}</TableHead>
                <TableHead className="text-right">{t("startAge")}</TableHead>
                <TableHead className="text-right">{t("endAge")}</TableHead>
                <TableHead className="text-right">{t("annualAmount")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleStreams.map((stream) => (
                <TableRow key={stream.id}>
                  <TableCell className="font-medium">{stream.name}</TableCell>
                  <TableCell>{t(STREAM_TYPE_KEYS[stream.type] as Parameters<typeof t>[0])}</TableCell>
                  <TableCell className="text-right">{stream.startAge}</TableCell>
                  <TableCell className="text-right">
                    {stream.endAge ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {stream.annualAmountCents
                      ? formatMoney(stream.annualAmountCents, locale)
                      : t("computed")}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="5" r="2" />
                            <circle cx="12" cy="12" r="2" />
                            <circle cx="12" cy="19" r="2" />
                          </svg>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingStream(stream)}>
                          {tc("edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteTarget(stream)}
                        >
                          {tc("delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={t("deleteStreamTitle")}
        description={
          deleteTarget
            ? t("deleteStreamDesc", { name: deleteTarget.name })
            : ""
        }
        confirmLabel={tc("delete")}
        cancelLabel={tc("cancel")}
        onConfirm={() => {
          if (deleteTarget) handleDeleteWithUndo(deleteTarget);
          setDeleteTarget(null);
        }}
      />

      {/* Add stream dialog */}
      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("addStream")}</DialogTitle>
          </DialogHeader>
          <IncomeStreamForm
            action={createIncomeStreamAction}
            onDone={handleAddSuccess}
            t={t}
            tc={tc}
          />
        </DialogContent>
      </Dialog>

      {/* Edit stream dialog */}
      <Dialog
        open={!!editingStream}
        onOpenChange={(open) => { if (!open) setEditingStream(null); }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{tc("edit")} — {editingStream?.name}</DialogTitle>
          </DialogHeader>
          {editingStream && (
            <IncomeStreamForm
              stream={editingStream}
              action={updateIncomeStreamAction}
              onDone={handleEditSuccess}
              t={t}
              tc={tc}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IncomeStreamForm({
  stream,
  action,
  onDone,
  t,
  tc,
}: {
  stream?: SerializedIncomeStream;
  action: typeof createIncomeStreamAction | typeof updateIncomeStreamAction;
  onDone: () => void;
  t: ReturnType<typeof useTranslations>;
  tc: ReturnType<typeof useTranslations>;
}) {
  const [state, formAction, isPending] = useActionState(action, {});

  useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);

  return (
    <form action={formAction} className="space-y-4">
      {stream && <input type="hidden" name="id" value={stream.id} />}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>{t("streamName")}</Label>
          <Input name="name" defaultValue={stream?.name ?? ""} required />
        </div>
        <div>
          <Label>{t("streamType")}</Label>
          <Select name="type" defaultValue={stream?.type ?? "GOVERNMENT_BENEFIT"}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GOVERNMENT_BENEFIT">{t("streamTypeGovernment")}</SelectItem>
              <SelectItem value="RENTAL">{t("streamTypeRental")}</SelectItem>
              <SelectItem value="OTHER">{t("streamTypeOther")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t("startAge")}</Label>
          <Input
            name="startAge"
            type="number"
            defaultValue={stream?.startAge ?? 65}
            required
          />
        </div>
        <div>
          <Label>{t("endAge")}</Label>
          <Input
            name="endAge"
            type="number"
            defaultValue={stream?.endAge ?? ""}
            placeholder={t("lifetime")}
          />
        </div>
        <div>
          <Label>{t("annualAmount")}</Label>
          <Input
            name="annualAmountDollars"
            type="number"
            step="0.01"
            defaultValue={
              stream?.annualAmountCents
                ? (stream.annualAmountCents / 100).toFixed(2)
                : ""
            }
          />
        </div>
        <div className="flex items-end gap-2">
          <div className="flex items-center gap-2">
            <Switch
              name="inflationIndexed"
              defaultChecked={stream?.inflationIndexed ?? true}
              value="true"
            />
            <Label className="text-sm font-normal">{t("inflationIndexed")}</Label>
          </div>
        </div>
      </div>

      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? t("saving") : tc("save")}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          {tc("cancel")}
        </Button>
      </div>
    </form>
  );
}
