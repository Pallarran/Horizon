"use client";

import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/money/format";
import type { MilestoneRow } from "@/lib/dashboard/milestones";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface MilestoneTableProps {
  locale: string;
  milestones: MilestoneRow[];
}

export function MilestoneTable({ locale, milestones }: MilestoneTableProps) {
  const t = useTranslations("dashboard");
  const tr = useTranslations("retirement");

  if (milestones.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <p className="mb-4 text-sm font-medium">{t("milestones")}</p>
        <p className="text-sm text-muted-foreground">{t("noMilestoneData")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <p className="mb-4 text-sm font-medium">{t("milestones")}</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead></TableHead>
            <TableHead className="text-right">Age</TableHead>
            <TableHead className="text-right">{tr("projectedPortfolio")}</TableHead>
            <TableHead className="text-right">{tr("projectedIncome")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {milestones.map((m) => (
            <TableRow key={m.label}>
              <TableCell className="font-medium">{m.label}</TableCell>
              <TableCell className="text-right">{m.age}</TableCell>
              <TableCell className="text-right">
                {formatMoney(m.portfolioCents, locale)}
              </TableCell>
              <TableCell className="text-right">
                {formatMoney(m.incomeCents, locale)}
                <span className="text-xs text-muted-foreground">/yr</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
