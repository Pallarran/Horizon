# Financial Calculation Audit Report

Full audit of Horizon's financial calculations against Canadian/Quebec accounting rules and mathematical correctness.

---

## Priority 1 — Bugs (incorrect numbers displayed to user)

### 1A. REER seed data: 7 of 18 CRA limits are wrong

**File:** `prisma/seed.ts` lines 32-51

Verified against [CRA official table](https://www.canada.ca/en/revenue-agency/services/tax/registered-plans-administrators/pspa/mp-rrsp-dpsp-tfsa-limits-ympe.html):

| Year | Current (cents) | Correct (cents) | Error |
|------|----------------|-----------------|-------|
| 2009 | 2,150,000 | 2,100,000 | +$500 |
| 2011 | 2,267,000 | 2,245,000 | +$220 |
| 2014 | 2,450,000 | 2,427,000 | +$230 |
| 2016 | 2,541,000 | 2,537,000 | +$40 |
| 2017 | 2,600,000 | 2,601,000 | -$10 |
| 2019 | 2,658,000 | 2,650,000 | +$80 |
| 2022 | 2,932,000 | 2,921,000 | +$110 |

### 1B. CRCD tax credit rate is wrong

**File:** `src/lib/contributions/compute.ts` lines 17-20

Current code uses 25% rate / $1,250 max. [Revenu Québec](https://www.revenuquebec.ca/fr/citoyens/credits-dimpot/credit-dimpot-pour-acquisition-dactions-de-capital-regional-et-cooperatif-desjardins/) confirms the rate was **30%** with a **$1,500** max credit from 2018 through Feb 2025. (A new 25% category was introduced March 2025, but applies only to Category C shares.)

### 1C. Day movers dollar amount not aggregated for multi-account holdings

**File:** `src/lib/dashboard/day-movers.ts` lines 38-48

When the same security is held in multiple accounts (e.g., 100 shares in CELI + 200 shares in REER), only the first account's dollar amount is kept. The comment says "it's per-share" but `dayChangeCents` in `compute.ts:196` is `quantity × priceChange` — already quantity-weighted.

### 1D. Price query `take` limit can starve securities of price data

**File:** `src/lib/positions/query.ts` lines 53-58

`take: secIds.size * 2` fetches N×2 rows globally ordered by date desc. If some securities have very recent prices, they consume most of the take budget, leaving other securities with 0 or 1 price rows (null `previousPriceCents`, broken day-change).

### 1E. Hero fallback uses portfolio growth (7%) instead of dividend growth (5%) for years-to-freedom

**File:** `src/lib/dashboard/hero.ts` line 143

```ts
yearsToFreedom = Math.log(ratio) / Math.log(1 + portfolioGrowth) // 7%
```

This estimates when **income** reaches the target, but income grows at `dividendGrowth` (5%), not `portfolioGrowth` (7%). Using 7% underestimates years-to-freedom.

### 1F. Dividend forecast over-counts payment months due to date drift

**File:** `src/lib/dashboard/dividend-forecast.ts` lines 82-88

An 18-month lookback window may capture a quarterly payer's December payment in year N and its January payment in year N+1 (date drift from the broker). This produces 5 distinct months instead of 4 — dividing annual income by 5, underestimating each payment by 20%.

### 1G. Trailing growth rate ignores contributions — inflates milestone estimated date

**File:** `src/lib/dashboard/net-worth-milestones.ts` lines 317-340

`computeTrailingGrowth` computes `(latest_value / earliest_value)^(12/months) - 1`. If the user added $50K in contributions during the period, those contributions inflate the "growth rate". This makes `computeEstimatedDate` overly optimistic.

---

## Priority 2 — Data quality / silent failures

### 2A. FX rate fallback to 1.0 with no indication

**Files:** `src/lib/dashboard/net-worth.ts:117`, `src/lib/dashboard/dividends-summary.ts:133`

When no FX rate exists, USD is treated as CAD (1:1), silently undervaluing all USD holdings by ~25-30%.

### 2B. SPLIT handling comments are contradictory

**File:** `src/lib/positions/compute.ts` lines 114-121

Comments say both "amountCents encodes the new total quantity" and "quantity = additional shares received". The code uses `state.quantity += qty` (delta convention). If any import source records the ratio or new total instead, positions will be wrong.

---

## Priority 3 — Known approximations

These are simplifications acceptable for a personal tracking tool but deviate from strict CRA tax rules. They should be documented so the user doesn't mistake the app's figures for tax-filing numbers.

### 3A. USD cost basis converted at spot FX instead of historical acquisition-date rate

**Files:** `src/lib/positions/compute.ts:91`, `src/lib/dashboard/net-worth.ts:54-56`

CRA requires ACB for foreign securities to be in CAD at the FX rate on each purchase date. The app tracks cost in transaction currency (USD) and converts at today's rate for display. Unrealized gain/loss for USD holdings is approximate.

### 3B. USD dividends converted at single spot rate for all periods

**Files:** `src/lib/dashboard/dividends-summary.ts:78-86`, `src/lib/dashboard/dividend-history.ts`

YTD and prior-year dividend totals use today's FX rate for all transactions.

### 3C. FIRE engine uses end-of-year contribution timing

**File:** `src/lib/projections/fire.ts` lines 124-132

Growth is applied first, then contributions are added. Over 30 years at 7% with $20K/year contributions, this underestimates the portfolio by ~$40-60K vs mid-year timing.

### 3D. CRCD value applied uniformly to all historical snapshots

**File:** `src/lib/dashboard/portfolio-history.ts` lines 155-163

Today's CRCD holdings value is added to every month in the sparkline, regardless of when shares were purchased.

### 3E. Hardcoded English month names in dividend forecast

**File:** `src/lib/dashboard/dividend-forecast.ts` lines 130-133

`SHORT_MONTH_NAMES` array is English-only. The app supports `fr-CA` and `en-CA`.
