"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/money/format";
import { saveContributionYearAction } from "@/lib/actions/contributions";
import type { ContributionYearRow } from "@/lib/contributions/compute";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ContributionTableProps {
  rows: ContributionYearRow[];
  locale: string;
}

export function ContributionTable({ rows: initialRows, locale }: ContributionTableProps) {
  const t = useTranslations("contributions");
  const [rows, setRows] = useState(initialRows);
  const [editingYear, setEditingYear] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Show most recent years first
  const displayRows = [...rows].reverse();

  function centsToDollars(cents: number): string {
    return (cents / 100).toFixed(2);
  }

  function handleEdit(year: number) {
    setEditingYear(year);
  }

  function handleCancel() {
    setEditingYear(null);
  }

  function handleSave(formData: FormData) {
    startTransition(async () => {
      const result = await saveContributionYearAction({}, formData);
      if (result.success && result.rows) {
        setRows(result.rows);
        setEditingYear(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-card">{t("year")}</TableHead>
            <TableHead className="text-right">{t("age")}</TableHead>
            <TableHead className="text-right">REER {t("newRoom")}</TableHead>
            <TableHead className="text-right">REER {t("contributed")}</TableHead>
            <TableHead className="text-right">REER {t("remaining")}</TableHead>
            <TableHead className="text-right">CELI {t("newRoom")}</TableHead>
            <TableHead className="text-right">CELI {t("contributed")}</TableHead>
            <TableHead className="text-right">CELI {t("remaining")}</TableHead>
            <TableHead className="text-right">Marge</TableHead>
            <TableHead className="text-right">CRCD</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayRows.map((row) => {
            const isEditing = editingYear === row.year;

            if (isEditing) {
              return (
                <EditableRow
                  key={row.year}
                  row={row}
                  locale={locale}
                  isPending={isPending}
                  onSave={handleSave}
                  onCancel={handleCancel}
                  centsToDollars={centsToDollars}
                />
              );
            }

            return (
              <TableRow key={row.year}>
                <TableCell className="sticky left-0 bg-card font-medium">
                  {row.year}
                </TableCell>
                <TableCell className="text-right">{row.age}</TableCell>
                <TableCell className="text-right">
                  {formatMoney(row.reerLimitCents, locale)}
                </TableCell>
                <TableCell className="text-right">
                  {formatMoney(row.reerContributionCents, locale)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatMoney(row.reerCumulativeRoomCents, locale)}
                </TableCell>
                <TableCell className="text-right">
                  {formatMoney(row.celiLimitCents, locale)}
                </TableCell>
                <TableCell className="text-right">
                  {formatMoney(row.celiContributionCents, locale)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatMoney(row.celiCumulativeRoomCents, locale)}
                </TableCell>
                <TableCell className="text-right">
                  {formatMoney(row.margeContributionCents, locale)}
                </TableCell>
                <TableCell className="text-right">
                  {formatMoney(row.crcdContributionCents, locale)}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(row.year)}
                  >
                    {t("edit")}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function EditableRow({
  row,
  locale,
  isPending,
  onSave,
  onCancel,
  centsToDollars,
}: {
  row: ContributionYearRow;
  locale: string;
  isPending: boolean;
  onSave: (formData: FormData) => void;
  onCancel: () => void;
  centsToDollars: (cents: number) => string;
}) {
  const t = useTranslations("contributions");

  return (
    <TableRow className="bg-muted/50">
      <TableCell className="sticky left-0 bg-muted/50 font-medium">
        {row.year}
      </TableCell>
      <TableCell className="text-right">{row.age}</TableCell>
      <TableCell className="text-right" colSpan={9}>
        <form
          action={onSave}
          className="flex flex-wrap items-center gap-3"
        >
          <input type="hidden" name="year" value={row.year} />

          <EditField
            label={`REER ${t("newRoom")}`}
            name="reerLimit"
            defaultValue={centsToDollars(row.reerLimitCents)}
            placeholder={centsToDollars(row.reerCraLimitCents)}
          />
          <EditField
            label={`REER ${t("contributed")}`}
            name="reerContribution"
            defaultValue={centsToDollars(row.reerContributionCents)}
          />
          <EditField
            label={`CELI ${t("newRoom")}`}
            name="celiLimit"
            defaultValue={centsToDollars(row.celiLimitCents)}
            placeholder={centsToDollars(row.celiCraLimitCents)}
          />
          <EditField
            label={`CELI ${t("contributed")}`}
            name="celiContribution"
            defaultValue={centsToDollars(row.celiContributionCents)}
          />
          <EditField
            label="Marge"
            name="margeContribution"
            defaultValue={centsToDollars(row.margeContributionCents)}
          />
          <EditField
            label="CRCD"
            name="crcdContribution"
            defaultValue={centsToDollars(row.crcdContributionCents)}
          />

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? t("saving") : t("save")}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              {t("cancel")}
            </Button>
          </div>
        </form>
      </TableCell>
    </TableRow>
  );
}

function EditField({
  label,
  name,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input
        name={name}
        type="number"
        step="0.01"
        min="0"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-8 w-28"
      />
    </div>
  );
}
