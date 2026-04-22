"use client";

import { useState, useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
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
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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

export function IncomeStreamManager({ streams, locale }: IncomeStreamManagerProps) {
  const t = useTranslations("retirement");
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  async function handleDelete(id: string) {
    const result = await deleteIncomeStreamAction(id);
    if (result.success) router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t("incomeStreams")}</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
              {t("addStream")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {streams.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noStreams")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("streamName")}</TableHead>
                  <TableHead>{t("streamType")}</TableHead>
                  <TableHead className="text-right">{t("startAge")}</TableHead>
                  <TableHead className="text-right">{t("endAge")}</TableHead>
                  <TableHead className="text-right">{t("annualAmount")}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {streams.map((stream) => (
                  <TableRow key={stream.id}>
                    <TableCell className="font-medium">{stream.name}</TableCell>
                    <TableCell>{stream.type}</TableCell>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(stream.id)}
                      >
                        {t("edit")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => setDeleteTarget(stream.id)}
                      >
                        {t("delete")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={t("delete")}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget);
          setDeleteTarget(null);
        }}
      />

      {showForm && (
        <IncomeStreamForm
          action={createIncomeStreamAction}
          onDone={() => {
            setShowForm(false);
            router.refresh();
          }}
          t={t}
        />
      )}

      {editingId && (
        <IncomeStreamForm
          stream={streams.find((s) => s.id === editingId)}
          action={updateIncomeStreamAction}
          onDone={() => {
            setEditingId(null);
            router.refresh();
          }}
          t={t}
        />
      )}
    </div>
  );
}

function IncomeStreamForm({
  stream,
  action,
  onDone,
  t,
}: {
  stream?: SerializedIncomeStream;
  action: typeof createIncomeStreamAction | typeof updateIncomeStreamAction;
  onDone: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [state, formAction, isPending] = useActionState(action, {});

  useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);

  return (
    <Card>
      <CardContent className="pt-6">
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
                  <SelectItem value="PENSION">{t("streamTypePension")}</SelectItem>
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
              {isPending ? t("saving") : t("save")}
            </Button>
            <Button type="button" variant="ghost" onClick={onDone}>
              {t("cancel")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
