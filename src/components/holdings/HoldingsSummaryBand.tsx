"use client";

import { useTranslations } from "next-intl";
import { formatMoney, formatPercent } from "@/lib/money/format";

interface CurrencyTotals {
  marketValueCents: number;
  totalCostCents: number;
  gainCents: number;
  gainPercent: number | null;
}

export interface HoldingsSummaryMetrics {
  count: number;
  totalCost: number;
  marketValue: number;
  gain: number;
  gainPercent: number | null;
  income: number;
  monthlyIncome: number;
  yieldPercent: number | null;
  byCurrency: Record<string, CurrencyTotals>;
  hasUsd: boolean;
}

export interface AccountAllocation {
  name: string;
  cents: number;
  percent: number;
  color: string;
}

interface Props {
  locale: string;
  usdCadRate: number;
  metrics: HoldingsSummaryMetrics;
  byAccount: AccountAllocation[];
}

/**
 * Summary band for the Holdings power-table — leads with market value + gain,
 * then income, a per-currency breakdown, and a live by-account allocation bar.
 * Replaces the six equal-weight metric cards with a clear hierarchy.
 */
export function HoldingsSummaryBand({ locale, usdCadRate, metrics, byAccount }: Props) {
  const t = useTranslations("holdings");

  const gainPositive = metrics.gain >= 0;
  const cad = metrics.byCurrency["CAD"];
  const usd = metrics.byCurrency["USD"];

  return (
    <div className="flex flex-col gap-5 rounded-xl border bg-card px-6 py-[18px] shadow-sm md:flex-row md:gap-0">
      {/* Market value hero */}
      <section className="md:flex-[1.5] md:pr-[22px]">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("marketValue")}{" "}
            <span className="font-medium normal-case tracking-normal text-muted-foreground/70">
              · {t("totalCad")}
            </span>
          </p>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-foreground/70">
            {t("positionCount", { count: metrics.count })}
          </span>
        </div>
        <p className="mt-1.5 text-[32px] font-extrabold leading-none tracking-tight tabular-nums">
          {formatMoney(metrics.marketValue, locale)}
        </p>
        <p className={`mt-1 text-[13px] font-semibold tabular-nums ${gainPositive ? "text-gain" : "text-loss"}`}>
          {gainPositive ? "+" : ""}
          {formatMoney(metrics.gain, locale)}{" "}
          <span className="font-medium">
            {t("unrealizedLower")}
            {metrics.gainPercent !== null && (
              <> ({gainPositive ? "+" : ""}{formatPercent(metrics.gainPercent, locale)})</>
            )}
          </span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground/80 tabular-nums">
          {t("costBasis", { amount: formatMoney(metrics.totalCost, locale) })}
        </p>
      </section>

      <Divider />

      {/* Income */}
      <section className="flex flex-col justify-center gap-2 md:flex-1 md:px-[22px]">
        <StatRow label={t("annualIncome")} value={formatMoney(metrics.income, locale)} />
        <StatRow
          label={t("yieldOnValue")}
          value={metrics.yieldPercent !== null ? formatPercent(metrics.yieldPercent, locale) : "—"}
          accent
        />
        <StatRow label={t("perMonthLabel")} value={formatMoney(metrics.monthlyIncome, locale)} />
      </section>

      <Divider />

      {/* By currency */}
      <section className="flex flex-col justify-center md:flex-[1.2] md:px-[22px]">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("byCurrency")}
        </p>
        {cad && (
          <CurrencyLine
            code={t("cad")}
            value={formatMoney(cad.marketValueCents, locale)}
            cost={t("costInline", { amount: formatMoney(cad.totalCostCents, locale) })}
          />
        )}
        {usd && (
          <CurrencyLine
            code={t("usd")}
            value={formatMoney(usd.marketValueCents, locale, "USD")}
            cost={t("costInline", { amount: formatMoney(usd.totalCostCents, locale, "USD") })}
          />
        )}
        {metrics.hasUsd && (
          <p className="mt-1 font-mono text-[10px] text-muted-foreground/80">
            {t("fxRate", { rate: usdCadRate.toFixed(4) })}
          </p>
        )}
      </section>

      <Divider />

      {/* By account allocation */}
      <section className="flex flex-col justify-center md:flex-[1.1] md:pl-[22px]">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("byAccount")}
        </p>
        {byAccount.length > 0 ? (
          <>
            <div className="mb-2 flex h-2.5 overflow-hidden rounded-full bg-muted">
              {byAccount.map((a) => (
                <div key={a.name} style={{ width: `${a.percent * 100}%`, backgroundColor: a.color }} title={a.name} />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[11px] text-foreground/70">
              {byAccount.map((a) => (
                <span key={a.name} className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ backgroundColor: a.color }} />
                  <span className="max-w-[90px] truncate">{a.name}</span>
                  <span className="tabular-nums">{formatPercent(a.percent, locale, 0)}</span>
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">—</p>
        )}
      </section>
    </div>
  );
}

function Divider() {
  return <div className="hidden w-px shrink-0 bg-border md:block" />;
}

function StatRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-[15px] font-bold tabular-nums ${accent ? "text-primary" : ""}`}>{value}</span>
    </div>
  );
}

function CurrencyLine({ code, value, cost }: { code: string; value: string; cost: string }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
      <span className="font-semibold text-foreground/80">{code}</span>
      <span className="font-mono text-foreground/90 tabular-nums">
        {value} <span className="text-muted-foreground">· {cost}</span>
      </span>
    </div>
  );
}
