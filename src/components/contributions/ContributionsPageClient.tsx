"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import type { ContributionYearRow } from "@/lib/contributions/compute";
import { ContributionsHero } from "./ContributionsHero";
import { RegisteredAccountRoomCards } from "./RegisteredAccountRoomCards";
import { InvestmentBreakdownChart } from "./InvestmentBreakdownChart";
import { ContributionHistoryTable } from "./ContributionHistoryTable";

interface ContributionsPageClientProps {
  initialRows: ContributionYearRow[];
  locale: string;
  hasCrcdHoldings?: boolean;
}

export function ContributionsPageClient({
  initialRows,
  locale,
  hasCrcdHoldings,
}: ContributionsPageClientProps) {
  const t = useTranslations("contributions");
  const [rows, setRows] = useState(initialRows);
  const [tableOpen, setTableOpen] = useState(false);

  const currentYear = new Date().getFullYear();
  const currentRow = rows.find((r) => r.year === currentYear);

  function handleUpdate(newRows: ContributionYearRow[]) {
    setRows(newRows);
  }

  return (
    <div className="space-y-4">
      {/* Hero: savings goal + registered room still open */}
      {currentRow && (
        <ContributionsHero
          currentRow={currentRow}
          locale={locale}
          onUpdate={handleUpdate}
        />
      )}

      {/* Room ring cards */}
      {currentRow && (
        <RegisteredAccountRoomCards
          currentRow={currentRow}
          locale={locale}
          onUpdate={handleUpdate}
          hasCrcdHoldings={hasCrcdHoldings}
        />
      )}

      {/* Contribution history chart, with the full-table toggle in its header */}
      <InvestmentBreakdownChart
        rows={rows}
        locale={locale}
        headerAction={
          <button
            type="button"
            onClick={() => setTableOpen((o) => !o)}
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            {t("viewFullTable")}
            <ChevronDown
              className={`h-4 w-4 transition-transform ${tableOpen ? "rotate-180" : ""}`}
            />
          </button>
        }
      />

      {/* Full editable history table behind the toggle */}
      {tableOpen && (
        <ContributionHistoryTable rows={rows} locale={locale} onUpdate={handleUpdate} />
      )}
    </div>
  );
}
