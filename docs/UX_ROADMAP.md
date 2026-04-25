# Horizon UX Overhaul — Improvement Roadmap

## Context

The app currently has 10 navigation links, fragmented retirement planning across 3 pages (Pension, Income, Projections), separate Holdings/Accounts/Watchlist pages, and limited dividend intelligence. The user's core workflow is:
- Monthly: check investments, extract dividends, make contributions
- Annually: set savings goal, review retirement plan
- Ongoing: track progress toward $100K net worth milestones and financial freedom

The app should be reorganized around **insights first, data entry second**, with a focus on the user's dividend-income retirement strategy.

---

## Phase 1: Navigation Restructure + Portfolio Merge

**Goal:** Reduce nav from 10 items to 6, consolidate related pages.

### New navigation structure
```
Dashboard | Portfolio | Contributions | Retirement | Transactions | Watchlist
                                                                     [Settings via user menu]
```

### 1A. Merge Holdings + Accounts into "Portfolio" page
- [x] Create `src/app/[locale]/portfolio/page.tsx`
- [x] Create `src/components/portfolio/PortfolioPageClient.tsx`
- [x] Tabbed layout: **Positions** | **Accounts**
- [x] Default tab: Positions. Persist selected tab in URL search params (`?tab=accounts`)

### 1B. Move Import into Transactions page
- [x] Add "Import" button in the Transactions page header
- [x] Clicking navigates to `/transactions/import` (existing route)
- [x] Remove Import from main nav

### 1C. Update Header navigation
- [x] Update `src/components/layout/Header.tsx` with 6-item NAV_LINKS

### 1D. Redirects for old routes
- [x] `/holdings` → redirect to `/portfolio`
- [x] `/accounts` → redirect to `/portfolio?tab=accounts`
- [x] `/income` → redirect to `/retirement`
- [x] `/projections` → redirect to `/retirement`

### 1E. i18n updates
- [x] Add `nav.portfolio` key: "Portfolio" / "Portefeuille"

---

## Phase 2: Unified Retirement Planning Hub

**Goal:** Merge Pension, Income Streams, and Projections into one page with an interactive retirement age slider.

### 2A. Retirement page with tabs
- [x] Rewrite `src/app/[locale]/retirement/page.tsx`
- [x] Create `src/components/retirement/RetirementPageClient.tsx`
- [x] Three tabs: **Overview** | **Income Sources** | **Projections**

#### Overview tab (the hero view)
- [x] **Retirement age slider** (range: 50–70, default: user's `targetRetirementAge`)
- [x] Real-time updates as slider moves:
  - Income breakdown card: Dividend income + Pension income + Other streams = Total income
  - Coverage gauge: Total income vs target (70% of salary), color-coded
  - Key stats: Portfolio value at that age, monthly income, years of contributions remaining
- [x] **Comparison table** below: 3-4 key ages side-by-side (e.g. 53, 55, 58, 60) with income breakdowns

#### Income Sources tab
- [x] Pension management (existing `PensionCalculator` component)
- [x] Income streams management (existing `IncomeStreamManager` component)
- [x] Stacked vertically with clear section headers

#### Projections tab
- [x] Current `ProjectionsPageClient` content (portfolio growth + dividend income charts)
- [x] Keep the 4 input controls (price growth, div growth, monthly contribution, years)
- [x] DRIP vs no-DRIP comparison (already exists)

### 2B. Retirement age slider computation
- [x] Computation inlined in `RetirementOverview.tsx` using `projectFire()` + `calculatePension()`
- [x] Compute income breakdown for any given retirement age
- [x] Uses existing `projectFire()` engine underneath

### 2C. Server-side data aggregation
- [x] Fetch all data in retirement page.tsx: pensions, income streams, portfolio value, dividends, user settings

### 2D. Redirects
- [x] `/income` → `/retirement?tab=income`
- [x] `/projections` → `/retirement?tab=projections`

---

## Phase 3: Net Worth Milestones

**Goal:** Make the journey toward financial goals tangible with $100K milestone tracking (no upper bound).

### 3A. Milestone progress bar on dashboard
- [x] Create `src/components/dashboard/MilestoneProgressCard.tsx`
- [x] Prominent card: **"$700K → $800K"** with progress bar (73%)
- [x] Estimated date to reach next milestone (trailing 12-month growth rate)
- [x] Replaces old `MilestonesCard` (5y/10y/15y forward projections)

### 3B. Milestone timeline (collapsible)
- [x] Expandable section showing milestones passed
- [x] Each milestone: amount + date first reached (from portfolio history)
- [x] Visual timeline (vertical line with dots, newest first)

### 3C. Milestone history computation
- [x] Create `src/lib/dashboard/net-worth-milestones.ts`
- [x] Walk portfolio history to find dates when net worth first crossed each $100K threshold
- [x] Trailing 12-month growth rate + estimated date to next milestone

### 3D. Dashboard integration
- [x] Update `src/app/[locale]/dashboard/page.tsx` to use new milestone card
- [x] Replace KPI Strip 4th slot ("Freedom") with compact "Next Milestone" indicator
- [x] i18n keys for milestone labels (EN + FR)
- [x] Cleaned up old code: deleted `milestones.ts`, `MilestoneTable.tsx`, removed `MilestonesCard` from `ProjectionTabs.tsx`

---

## Phase 4: Dividend Intelligence

**Goal:** Surface actionable dividend insights for a yield-focused strategy.

### 4A. Monthly dividend forecast
- [x] Create `src/lib/dashboard/dividend-forecast.ts`
- [x] Create `src/components/dashboard/DividendForecastCard.tsx`
- [x] Use actual DIVIDEND transaction history + `dividendFrequency` fallback to project payment months
- [x] Bar chart: 12 months, highlight current month with different color

### 4B. Top yielders ranking
- [x] Create `src/lib/dashboard/top-yielders.ts`
- [x] Create `src/components/dashboard/TopYieldersCard.tsx`
- [x] Dashboard widget: top 5 positions by yield on cost (YOC)
- [x] Each row: symbol, name, YOC%, annual income

### 4C. Dividend growth tracking
- [x] Portfolio-wide: YoY dividend income growth (already in DividendsSummaryCard)
- [x] Enhance `DividendsSummaryCard.tsx` with YTD pacing indicator (% of expected)

### 4D. Dashboard layout update
- [x] **Column 1** (Portfolio Portrait): Sparkline + Day Movers + Allocation (unchanged)
- [x] **Column 2** (Income & Contributions): Contribution Room + **Dividend Forecast** (new) + Dividends Summary (enhanced)
- [x] **Column 3** (Freedom & Growth): Retirement Card + **Milestone Progress** (Phase 3) + **Top Yielders** (new)
- [x] i18n keys for all new cards (EN + FR)

---

## Implementation Order & Dependencies

```
Phase 1 (Nav + Portfolio)     ← Foundation, do first
    ↓
Phase 2 (Retirement Hub)     ← Depends on nav restructure
    ↓
Phase 3 (Milestones)         ← Independent, can parallelize with Phase 2
    ↓
Phase 4 (Dividends)          ← Independent, can start anytime after Phase 1
```

Each phase is independently deployable. Phases 3 and 4 have no dependencies on each other.

---

## Verification (per phase)

- [ ] `npx tsc --noEmit` — no type errors
- [ ] All old routes redirect correctly (no 404s)
- [ ] Visual review on desktop (1600px) and mobile (375px)
- [ ] i18n: check both EN and FR locales
- [ ] No data regressions — same portfolio values, same calculations
