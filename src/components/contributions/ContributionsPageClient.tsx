"use client";

import { useState } from "react";
import type { ContributionYearRow } from "@/lib/contributions/compute";
import { SavingsGoalHero } from "./SavingsGoalHero";
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
  const [rows, setRows] = useState(initialRows);

  const currentYear = new Date().getFullYear();
  const currentRow = rows.find((r) => r.year === currentYear);

  function handleUpdate(newRows: ContributionYearRow[]) {
    setRows(newRows);
  }

  return (
    <div className="space-y-6">
      {/* A. Savings Goal Hero */}
      {currentRow && (
        <SavingsGoalHero
          currentRow={currentRow}
          locale={locale}
          onUpdate={handleUpdate}
        />
      )}

      {/* B. Registered Account Room Cards */}
      {currentRow && (
        <RegisteredAccountRoomCards
          currentRow={currentRow}
          locale={locale}
          onUpdate={handleUpdate}
          hasCrcdHoldings={hasCrcdHoldings}
        />
      )}

      {/* C. Investment Breakdown Chart */}
      <InvestmentBreakdownChart rows={rows} locale={locale} />

      {/* D. Contribution History Table */}
      <ContributionHistoryTable rows={rows} locale={locale} onUpdate={handleUpdate} />
    </div>
  );
}
