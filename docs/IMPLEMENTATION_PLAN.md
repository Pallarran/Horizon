# Horizon — Full Implementation Plan

## Context

Build the Horizon app from scratch — a self-hosted personal finance and retirement planning web app for a Quebec, Canada household. The repo currently contains only `Horizon_PRD.md` (v1.3) and `Suivi de mes finances.xlsx`. No scaffolding exists.

**User's priorities:** Dashboard with retirement projections (salary at milestones), position/holdings tracking, dividend tracking, RRMD pension model, transaction management, contribution room tracking, Quebec/Canada financial rules, and portfolio growth modeling.

**Key implementation decisions made:**
- Package manager: **pnpm**
- Directory layout: **src/ prefix** (src/app, src/lib, src/components)
- Prisma: **v6** (current stable, identical schema syntax to v5)
- Position model: computed from transactions, no Prisma table
- Sign convention: natural (BUY = negative, DIVIDEND = positive)
- DRIP: new TransactionType enum value
- Theme: user toggle (light/dark/system) persisted in DB
- Timezone: America/Toronto always
- Dashboard milestone table: 5y, 10y, 15y, 20y, 25y, 30y + at age 55

---

## Phase 0: Foundation

### 0.1 Scaffold Next.js project

Initialize with `pnpm create next-app` (TypeScript, Tailwind, ESLint, App Router, src/ directory, `@/*` import alias). Then configure:

**Files to create/modify:**
- `package.json` — add all dependencies (see 0.2)
- `tsconfig.json` — `"strict": true`, `"target": "ES2020"` (native BigInt)
- `next.config.ts` — `output: 'standalone'`, next-intl plugin, `serverExternalPackages: ['pino', 'argon2']`
- `src/app/globals.css` — Tailwind v4 CSS-first config with Horizon brand colors + semantic financial colors (gain/loss/warning)
- `.env.example` — DATABASE_URL, SESSION_SECRET, TZ=America/Toronto
- `.gitignore` — node_modules, .next, .env.local, backups/

### 0.2 Dependencies

**Production:** next, react, react-dom, @prisma/client, next-intl, @tanstack/react-query, react-hook-form, @hookform/resolvers, zod, recharts, date-fns, argon2, yahoo-finance2, node-cron, pino, exceljs, superjson, clsx, tailwind-merge, class-variance-authority, lucide-react, radix-ui primitives, cmdk

**Dev:** typescript, prisma, @types/*, tailwindcss v4, @tailwindcss/postcss, vitest, @playwright/test, eslint, eslint-config-next, pino-pretty, tsx

### 0.3 shadcn/ui

Run `pnpm dlx shadcn@latest init` (New York style, neutral base, CSS variables). Install initial components: button, card, input, label, form, dialog, dropdown-menu, toast, separator, switch, select.

### 0.4 Docker Compose

**`docker-compose.yml`** — 3 services:
- `db`: postgres:16-alpine, TZ=America/Toronto, healthcheck, pgdata volume + ./backups mount
- `app`: Next.js standalone build, depends on db healthy, port 3000
- `jobs`: same image different entrypoint (`npx tsx jobs/index.ts`), depends on db healthy

**`Dockerfile`** — multi-stage (deps → builder → runner), pnpm, `output: standalone`, copy prisma client

### 0.5 Prisma schema

**`prisma/schema.prisma`** — all models from PRD §3 verbatim:

Models: User (with theme field), Session, Household (stub), Account, Security (with dividend metadata), Transaction, Price, FxRate, Pension, IncomeStream, Scenario, ContributionYear, Contribution, CRCDHolding, WatchlistItem, ImportProfile, ImportBatch, **CraLimit** (new — seed table for CRA annual caps)

Enums: AccountType, AssetClass, DataSource, TransactionType (with DRIP), IncomeType, ImportStatus

**Note:** Position model is NOT in the schema — computed only.

### 0.6 Seed script

**`prisma/seed.ts`** — seeds `CraLimit` table with:
- CELI limits: 2009-2026 ($5,000→$7,000 progression)
- REER caps: 2009-2026 ($21,500→$33,810 progression)
- CRCD caps: 2018-2026 ($5,000/year)

All values in cents. Uses `upsert` for idempotency.

### 0.7 i18n setup

**Approach:** next-intl with `localePrefix: 'never'` (clean URLs, locale from user preference/cookie).

Files:
- `src/lib/i18n/routing.ts` — locales: ['fr-CA', 'en-CA'], defaultLocale: 'fr-CA'
- `src/lib/i18n/request.ts` — request config loading messages
- `src/middleware.ts` — next-intl middleware
- `messages/fr-CA.json`, `messages/en-CA.json` — organized by module (common, auth, dashboard, holdings, contributions, retirement, settings)

Quebec terms (CELI, REER, CRCD, RRMD, Marge) appear as-is in both locales.

### 0.8 Authentication

**`src/lib/auth/password.ts`** — argon2id hash/verify (memoryCost: 19456, timeCost: 2, parallelism: 1)
**`src/lib/auth/session.ts`** — generate token (crypto.randomBytes(32).base64url), create/validate session, HTTP-only secure SameSite=Strict cookie, 30-day sliding expiry
**`src/lib/auth/rate-limit.ts`** — in-memory Map, 5 attempts per IP per 15 minutes
**`src/lib/auth/middleware.ts`** — `requireAuth()` and `requireAdmin()` helpers

API routes:
- `POST /api/auth/login` — validate credentials, create session, set cookie
- `POST /api/auth/logout` — delete session, clear cookie
- `POST /api/auth/change-password` — verify current, hash new, invalidate other sessions

### 0.9 User data isolation

**`src/lib/db/scoped.ts`** — typed wrapper `scopedPrisma(userId)` that injects `userId` into every query on user-owned entities (Account, Pension, Scenario, IncomeStream, ContributionYear, WatchlistItem) and account-scoped entities (Transaction, Contribution, CRCDHolding via account ownership).

Every API route handler calls `scopedPrisma(session.user.id)`. Raw `prisma.account.findMany()` without user scope must not appear in API routes.

### 0.10 Initial setup flow

**`src/app/[locale]/setup/page.tsx`** — checks `prisma.user.count()`. If > 0, redirect to /login. Otherwise: form collecting email, displayName, birthYear, password (×2), locale, currentSalaryCents, targetRetirementAge. On submit: validate with Zod, hash password, create user with `isAdmin: true`, run seed if needed, create session, redirect to /dashboard.

### 0.11 Utilities

- `src/lib/utils/logger.ts` — pino logger
- `src/lib/money/format.ts` — `Intl.NumberFormat` wrappers respecting user locale
- `src/lib/money/arithmetic.ts` — safe BigInt cent operations
- `src/lib/utils/date.ts` — date-fns wrappers with America/Toronto timezone
- `src/app/api/health/route.ts` — DB connectivity check

### 0.12 Verification
- `pnpm install` + `pnpm run db:migrate` + `pnpm run db:seed` succeeds
- `docker compose up` starts all 3 containers
- `/api/health` returns `{"status":"ok"}`
- First visit redirects to /setup; completing it creates admin, redirects to dashboard
- /setup inaccessible after first user exists
- Login/logout works; session cookie is HTTP-only, secure, SameSite=Strict
- User isolation test: two users created, scoped queries return only correct user's data
- i18n toggle switches all strings; dark/light mode toggle works

---

## Phase 0.5: User Management UI

**Files:** `src/app/[locale]/settings/users/page.tsx`, `src/app/api/admin/users/` routes, `src/components/auth/ChangePasswordForm.tsx`, `src/app/[locale]/settings/account/page.tsx`

- Admin-only page to list/create/deactivate users and reset passwords
- Create user: email, displayName, birthYear, temporary password → `mustChangePassword: true`
- Force-change-password interceptor in root layout: if `mustChangePassword`, redirect to change-password (no other page accessible)
- Password change requires current password, invalidates other sessions
- Admin cannot deactivate themselves

**Verification:** Admin creates second user → user logs in with temp password → forced to change → sees dashboard. Admin resets password, deactivates user.

---

## Phase 1: Read-Only Dashboard with Hardcoded Data

**Files:** `src/app/[locale]/dashboard/page.tsx`, `src/components/dashboard/` (HeroCard, NetWorthCard, IncomeCompositionChart, MilestoneTable, DividendsSummaryCard, DayMoversCard, ContributionRoomCard, LastUpdatedIndicator), `src/components/layout/` (Header, ThemeProvider), `src/app/[locale]/holdings/page.tsx`, `src/components/holdings/HoldingsTable.tsx`

- All numbers hardcoded — goal is to nail layout, responsiveness, dark mode
- Desktop: 2-column grid per PRD wireframe §12.1
- Mobile (375px): single column per PRD §12.2
- **Milestone table** (new vs PRD): below income composition chart, shows projected portfolio value and income at 5y/10y/15y/20y/25y/30y + age 55
- Install additional shadcn components: table, badge, progress, sheet
- Recharts for income composition stacked area chart and net worth sparkline

**Verification:** Dashboard renders < 1s, all 7 sections visible on desktop, mobile stacks correctly, dark/light mode works, locale toggle works, holdings table sorts client-side.

---

## Phase 2: Excel Import Script

**Files:** `scripts/import-excel.ts`, `scripts/lib/excel-parser.ts`, `scripts/lib/reconciliation.ts`

- Uses `exceljs` to parse `Suivi de mes finances.xlsx`
- `--user-email` required, `--file` optional (defaults to repo root)
- Parses: Ressources (accounts), Titre et dividendes (holdings + dividend grid), Cotisations (contribution history), CRCD (tranches)
- Creates synthetic BUY transactions dated 2019-01-01 for current holdings (marked with distinct importBatchId for later replacement)
- Dividend grid cells → DIVIDEND transactions dated 15th of each month
- Creates Security rows (shared catalog), Pension row, QPP/OAS IncomeStream placeholders
- Prints reconciliation report: market value per account, dividends per year, contributions per year

**Verification:** Script runs on actual Excel file, position count matches, dividend/contribution totals match within $1.

---

## Phase 3a: Transactions & Positions

**Files:** `src/lib/positions/compute.ts` (ACB engine), `src/lib/positions/types.ts` (ComputedPosition interface), `src/app/api/transactions/route.ts`, `src/app/api/securities/route.ts`, `src/components/holdings/TransactionForm.tsx`, `src/components/holdings/DividendQuickEntry.tsx`, `src/app/[locale]/holdings/[securityId]/page.tsx`

**Position computation — ACB method (PRD §4.7):**
- Process transactions in chronological order
- BUY/DRIP: new_total_cost = prev + (qty × price) + fees; new_acb = total_cost / quantity
- SELL: ACB per share unchanged; realized_gain = (sell_price × qty) - (acb × qty) - fees
- SPLIT: quantity changes, total cost unchanged, ACB recalculated
- Cross-currency: ACB in transaction currency, convert to CAD with current FX for display

**Transaction form:** Account dropdown (remembers last via localStorage), type-dependent fields, security autocomplete, auto-computed amount, Zod validation, 60-second delete window.

**Verification:** Position computation matches PRD Appendix 11.1 exactly (53 shares, $2,615 cost, $49.34/share ACB). Delete works within 60s, fails after.

---

## Phase 3b: CSV Import

**Files:** `src/app/[locale]/import/page.tsx`, `src/components/import/` (UploadStep, ProfileSelector, ColumnMapper, OptionsStep, PreviewTable, ImportReport), `src/app/api/import/` routes, `src/lib/import/` (csv-parser, duplicate-detector, normalizer)

- Client-side CSV parsing (PapaParse) for preview; re-parse on server at commit
- ImportProfile CRUD: save column mappings per broker for reuse
- Dry-run preview with status per row (will create / suspected duplicate / error)
- Duplicate detection: match on accountId + date + securityId + type + quantity + amountCents
- Commit creates ImportBatch, rollback deletes linked transactions (within 30 days)
- Unknown securities: flag in preview, quick-create inline

**Verification:** Import 100 rows < 2 min, re-upload same file = 0 new transactions, rollback restores prior state, saved profiles reused automatically.

---

## Phase 4: Price & FX Updates

**Files:** `jobs/index.ts`, `jobs/price-fetch.ts`, `jobs/fx-fetch.ts`, `jobs/backup.ts`, `jobs/backfill.ts`, `src/app/api/admin/backfill/route.ts`

- Nightly cron at 23:00 ET (Mon-Fri): fetch EOD prices via yahoo-finance2, FX rates at 23:05
- Backup cron at 02:00 ET daily: pg_dump with rotation (7 daily, 4 weekly, 12 monthly)
- 5-year historical backfill: one-time or on-demand from admin settings, 1 req/sec, idempotent
- Price validation: reject < 0 or > 10× previous close
- FX: fetch both USD/CAD and CAD/USD directions

**Verification:** Prices stored correctly in cents, FX rates with 8 decimals, backfill populates 5 years, backfill idempotent, backup files created and rotated.

---

## Phase 5: Dashboard Computations

**Files:** `src/lib/dashboard/` (net-worth.ts, dividends-summary.ts, day-movers.ts, hero.ts), `src/app/api/dashboard/route.ts`, update all dashboard components to use real data via TanStack Query

- Net worth: sum all positions (Phase 3a compute.ts) × latest prices, convert USD→CAD
- Dividends: annualized from positions × security.annualDividendCents, YTD/prior-year from DIVIDEND transactions
- Day movers: compare latest vs previous-day prices across all positions
- Hero "Years to freedom": simplified (pension + current dividend income vs target); full version in Phase 7
- Milestone table: populated with real projections
- TanStack Query `staleTime: 5 min` for dashboard data (prices update nightly)

**Verification:** Dashboard loads < 1s with full data, net worth matches spreadsheet within $1, dividend totals match.

---

## Phase 6: Contribution Room

**Files:** `src/app/[locale]/contributions/page.tsx`, `src/components/contributions/` (ContributionTable, CurrentYearSummary), `src/lib/contributions/compute.ts`, `src/app/api/contribution-years/route.ts`

- Year-by-year table with inline editing
- REER room: previous room + new limit - contributions (limit from CRA notice, cap from seed data)
- CELI room: previous room + new limit - contributions + prior year withdrawals (manual in v1)
- Editing historical years requires confirmation, changes propagate forward
- Dashboard ContributionRoomCard uses same computation engine

**Verification:** Room calculations carry forward correctly, editing 2023 propagates to 2024-2026, dashboard summary matches.

---

## Phase 7: Retirement Planning

**Files:** `src/app/[locale]/retirement/` pages, `src/components/retirement/` (PensionCalculator, ScenarioCard, ScenarioComparison, FireCalculator, IncomeStreamManager), `src/lib/pension/calculate.ts`, `src/lib/projections/` (fire.ts, income.ts), `src/app/api/` (pensions, scenarios, income-streams routes)

**Pension (PRD §4.5):** exact formula implementation, verify against Appendix 11.2 ($23,490/year)

**FIRE projection:** year-by-year loop current age → 90+, applying priceGrowth, dividendYield, contributions, reinvestment

**Scenarios:** up to 4 side-by-side, baseline shown on dashboard, contributionAllocation as `{accountId: percentage}`

**Income streams:** QPP/OAS seeded as placeholders, user fills in amounts/start ages

**Dashboard integration:**
- Hero uses full projection engine for coverage %
- Income composition chart: stacked area from current age through retirement + 30y
- Milestone table: projected values at 5y/10y/15y/20y/25y/30y + age 55

**Verification:** Pension = $23,490 per Appendix 11.2, FIRE approximately matches Appendix 11.3, scenario recomputation < 500ms.

---

## Phase 8: Polish & Launch

- Mobile responsive pass (375px) on all pages
- Accessibility: keyboard nav, screen reader labels, ARIA on charts, WCAG AA contrast
- Backup verification: run backup, test restore to fresh DB
- Full migration rehearsal: fresh docker compose → setup → Excel import → backfill → verify (target < 30 min)
- Export verification: all CSV/JSON formats produce valid round-trippable data
- Performance targets: dashboard < 1s, holdings table < 500ms, transaction form < 4 interactions, scenario recompute < 500ms

---

## Directory Structure

```
/
  docker-compose.yml, Dockerfile
  prisma/schema.prisma, migrations/, seed.ts
  messages/fr-CA.json, en-CA.json
  scripts/import-excel.ts, reset-admin-password.ts
  jobs/index.ts, price-fetch.ts, fx-fetch.ts, backup.ts, backfill.ts
  src/
    middleware.ts
    app/
      globals.css
      [locale]/
        layout.tsx, page.tsx (→ dashboard)
        setup/, login/, dashboard/, holdings/, contributions/
        retirement/, import/, settings/
      api/
        health/, auth/, admin/, accounts/, transactions/
        securities/, prices/, contribution-years/, pensions/
        scenarios/, income-streams/, import/, export/
    components/
      ui/ (shadcn), layout/, auth/, dashboard/, holdings/
      contributions/, retirement/, import/
    lib/
      db/ (prisma.ts, scoped.ts)
      auth/ (password.ts, session.ts, rate-limit.ts, middleware.ts)
      money/ (format.ts, convert.ts, arithmetic.ts)
      positions/ (compute.ts, types.ts)
      projections/ (fire.ts, income.ts)
      pension/ (calculate.ts)
      contributions/ (compute.ts)
      dashboard/ (net-worth.ts, dividends-summary.ts, day-movers.ts, hero.ts)
      i18n/ (routing.ts, request.ts)
      import/ (csv-parser.ts, duplicate-detector.ts, normalizer.ts)
      validators/ (auth.ts, transaction.ts, account.ts, scenario.ts)
      utils/ (date.ts, logger.ts)
    hooks/, types/
  tests/unit/, tests/e2e/
```

---

## Execution Strategy

We will implement **Phase 0 first** (foundation), which is the largest and most critical phase. Each subsequent phase builds on the previous. Within Phase 0, the order is: scaffold → dependencies → Docker → Prisma schema → seed → i18n → auth → data isolation → setup flow → utilities → tests.
