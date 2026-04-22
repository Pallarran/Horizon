# Horizon — Personal Finance & Financial Freedom Tracker

> **Retirement on the horizon** / **La retraite à l'horizon**

**Document version:** 1.3
**Intended audience:** Claude Code (primary), human developer (secondary)
**App name:** `Horizon` (same in both languages)

---

## How to read this document

This PRD is written to be consumed by an AI coding assistant (Claude Code) with a human in the loop. It favors precision over brevity. When there is a tension between "what a human reader would find obvious" and "what an AI coding assistant needs spelled out," this document errs toward spelling it out.

Conventions used throughout:

- **[MUST]** — required for v1 release
- **[SHOULD]** — strongly preferred for v1, but can slip to v1.1
- **[LATER]** — explicitly out of scope for v1, documented to prevent scope creep
- **[DECIDE]** — open question flagged for human decision before implementation
- Code snippets in TypeScript / Prisma use the syntax the final implementation will use
- All monetary values are stored as integers (cents) internally; formatting happens in presentation
- All dates are stored as `DATE` (no time component) unless a time is semantically meaningful

---

## 1. Product overview

### 1.1 Mission

Replace a highly-evolved personal finance spreadsheet (≈28,000 formulas, 11 sheets, 7+ years of data) with a self-hosted web application that does what the spreadsheet does **plus** what the spreadsheet cannot do: render well on mobile browsers, update prices automatically, stay fast as data grows, and make financial-freedom planning the primary view rather than a buried tab.

The spreadsheet's true purpose — confirmed through user interviews — is **not** investment tracking. It is **projecting when the user can achieve financial freedom** and what their income composition will look like at that point. Investment tracking is the machinery that feeds the projection. The app's design must reflect this hierarchy.

### 1.2 Goals (in priority order)

1. **Show me where I stand** toward financial freedom, today, at a glance (dashboard is the home page)
2. **Track every position, transaction, and dividend** across multiple currencies and account types
3. **Manage contribution room** across registered Canadian accounts year by year
4. **Project retirement income** from multiple sources (pension, dividends, withdrawals) under different scenarios
5. **Preserve 7 years of historical dividend data** during migration from Excel

### 1.3 Non-goals for v1

Listed explicitly to prevent scope creep:

- **Budgeting or cash flow tracking.** This is not Mint or YNAB. Do not build spending categorization, expense envelopes, or account reconciliation.
- **Broker API integration.** No OFX, no scraping, no broker APIs in v1. CSV import is supported (see §5.6), but we never log into a broker on the user's behalf.
- **Tax preparation.** The app surfaces tax-relevant information (account type, withholding) but does not produce tax forms or slips.
- **Joint account ownership.** Each account has exactly one owner in v1. CELI and REER are legally individual anyway, and joint Marge modeling adds complexity with no immediate payoff.
- **Household aggregate views.** Combined net worth, joint retirement projection, and cross-user comparisons are deferred to v1.1+. The data model supports computing these; the UI does not expose them in v1. This decision is revisited once both spouses are actively using the app for 1+ month.
- **Self-registration.** No public signup page. The first user is created via initial setup; additional users (up to a small number — designed for a household, not a SaaS) are created by the admin user from a settings page.
- **Native mobile apps.** Responsive web UI only.
- **Real-time streaming prices.** End-of-day prices are sufficient; intraday is not a goal.
- **Trade execution.** The app is read-only with respect to brokers. It never places trades.
- **Financial advice.** The app computes and displays, it does not recommend.

### 1.4 Users

- **Primary user (v1):** A technically-comfortable retail investor in Quebec, Canada, with ~$700K across multiple registered and non-registered accounts, multi-currency holdings, a defined-benefit employer pension, and a target retirement age of 55. This user is the **admin** — first to install, runs migration from Excel, creates additional user accounts.
- **Second user (v1):** The primary user's spouse. Has her own separate portfolio (her own CELI, REER, etc.), her own login, her own dashboard, her own retirement planning. She is expected to start using the app within 1–6 months of go-live. She may or may not migrate from her own spreadsheet.
- **Data isolation:** Each user sees only their own data. There is **no UI** in v1 for viewing another user's portfolio, even as read-only. The primary user does not see his wife's holdings; she does not see his. Combined views are deferred (see §1.3).
- **Implied audience:** Someone who currently uses Excel for this purpose, has 10+ years of data history, and values data portability.

### 1.5 Success criteria

v1 is successful if, after three months of use, the user:

1. No longer opens the original Excel file for daily checks
2. Has entered every new transaction and dividend directly into the app, not Excel
3. Can answer "when can I retire?" in under five seconds by opening the dashboard
4. Has run at least three retirement scenarios in the app (e.g., retire at 55 vs 58, 60% vs 70% replacement)

---

## 2. Glossary

Quebec-specific and domain-specific terms that Claude Code cannot be expected to know. **All terms below are used throughout this document and must be treated as proper nouns in the UI (not translated literally).**

| Term | Meaning | Notes |
|---|---|---|
| **CELI** | Compte d'Épargne Libre d'Impôt | Canadian Tax-Free Savings Account (TFSA in English). All gains/dividends/withdrawals are tax-free. Annual contribution room set by federal government. |
| **REER** | Régime Enregistré d'Épargne-Retraite | Canadian Registered Retirement Savings Plan (RRSP in English). Contributions are tax-deductible; gains grow tax-deferred; withdrawals are fully taxable. Contribution room = 18% of previous year's earned income up to annual cap, with unused room carried forward. |
| **Marge** | Non-registered margin account | Taxable, can borrow against holdings. No contribution limit. |
| **CRCD** | Capital régional et coopératif Desjardins | Quebec-only investment vehicle. Provides 30% Quebec tax credit on purchases (max $5,000/year contribution, $1,500 credit). Shares must be held for a minimum period before redemption (typically 7 years). Priced monthly by Desjardins, not market-traded. |
| **RRMD** | *User's employer defined-benefit pension plan* (acronym per user spreadsheet) | Uses a formula combining Régime B (first 2 years of service × 1.5% × salary) and Régime C (remaining years × 1.5% × salary), reduced by 4% for each year retirement occurs before age 65. Service starts 2010. **Treat as a configurable pension model — actual parameters stored per-user, not hardcoded.** |
| **FIRE** | Financial Independence, Retire Early | The broader movement the user's target aligns with. Used as a label for the "years to freedom" view. |
| **Dividend aristocrat / king** | Stocks with long histories of increasing dividends | Metadata on holdings and watchlist items. |
| **Yield on cost** | Annual dividend ÷ original cost basis | A key metric on the holdings view, distinct from current yield. |
| **Pépites** | "Gems" — user's term for a specific margin-based trading strategy | Tracks margin borrowing capacity and targeted profit per dollar borrowed. |

---

## 3. Domain model

This section is the single source of truth for the data model. Schema changes must be reflected here before implementation.

### 3.1 Core entities

```prisma
// User — one row per human using the app (primary user + spouse)
model User {
  id              String    @id @default(cuid())
  email           String    @unique
  passwordHash    String                          // argon2id hash; NEVER plaintext
  displayName     String
  birthYear       Int                             // drives age-based calculations
  locale          String    @default("fr-CA")     // "fr-CA" | "en-CA"; per-user preference
  baseCurrency    String    @default("CAD")       // always CAD for v1
  theme           String    @default("system")    // "light" | "dark" | "system"
  targetRetirementAge Int   @default(55)
  targetIncomeReplacement Decimal @default(0.70)  // 70% of current salary
  currentSalaryCents BigInt                       // in baseCurrency

  // Role & lifecycle
  isAdmin         Boolean   @default(false)       // only first user is admin
  isActive        Boolean   @default(true)        // admin can deactivate without deleting
  mustChangePassword Boolean @default(false)      // true for admin-created users until first change
  lastLoginAt     DateTime?

  // Future household grouping — nullable until implemented
  householdId     String?
  household       Household? @relation(fields: [householdId], references: [id])

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  accounts        Account[]
  pensions        Pension[]
  scenarios       Scenario[]
  incomeStreams   IncomeStream[]
  contributionYears ContributionYear[]
  watchlistItems  WatchlistItem[]
  sessions        Session[]

  @@index([householdId])
}

// Session — auth session tokens (opaque random strings)
model Session {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token      String   @unique                    // opaque, cryptographically random
  expiresAt  DateTime
  userAgent  String?
  ipAddress  String?
  createdAt  DateTime @default(now())

  @@index([userId])
  @@index([token])
}

// Household — v1 stub. No UI exposure in v1. Exists so that when household
// aggregate views are built in v1.1+, users can be linked without a migration.
// A household has 1..N users. In v1, every user has householdId = null OR
// an auto-created household containing only that user (TBD at implementation).
model Household {
  id          String   @id @default(cuid())
  name        String                               // "Smith household", optional
  createdAt   DateTime @default(now())

  users       User[]
}

// Account — a financial account holding positions
model Account {
  id           String        @id @default(cuid())
  userId       String
  user         User          @relation(fields: [userId], references: [id])
  name         String                          // "CELI (CAD)", "Marge (USD)", etc.
  type         AccountType                     // enum below
  currency     String                          // "CAD" | "USD"
  externalId   String?                         // broker account number, if known
  isActive     Boolean       @default(true)
  orderIndex   Int           @default(0)       // display order on dashboard
  openedDate   DateTime?
  closedDate   DateTime?
  createdAt    DateTime      @default(now())

  transactions Transaction[]
  contributions Contribution[]

  @@index([userId])
}

enum AccountType {
  CELI           // TFSA
  REER           // RRSP
  MARGE          // Non-registered margin
  CRCD           // Quebec co-op investment
  CASH           // Simple cash account, no securities
  OTHER
}

// Security — the underlying asset (stock, ETF, etc.)
model Security {
  id               String    @id @default(cuid())
  symbol           String                          // "ENB.TO", "MSFT", "VCE.TO"
  exchange         String                          // "TSX", "NYSE", "NASDAQ", "NEO"
  name             String
  currency         String                          // currency it trades in
  assetClass       AssetClass
  sector           String?
  industry         String?
  isDividendAristocrat Boolean @default(false)
  isDividendKing   Boolean   @default(false)
  isPaysMonthly    Boolean   @default(false)       // most pay quarterly; flag monthlies
  dataSource       DataSource @default(YAHOO)       // where prices come from
  manualPrice      Decimal?                         // for non-traded like CRCD
  notes            String?

  // Dividend metadata — populated by nightly Yahoo fetch unless manualDividendOverride = true
  annualDividendCents BigInt?                      // annual dividend per share in cents
  dividendFrequency   String?                      // "monthly" | "quarterly" | "semi-annual" | "annual"
  dividendGrowthYears Int?                         // consecutive years of dividend increases
  manualDividendOverride Boolean @default(false)   // if true, Yahoo fetch does not overwrite dividend fields

  createdAt        DateTime  @default(now())

  transactions     Transaction[]
  prices           Price[]
  watchlistItems   WatchlistItem[]

  @@unique([symbol, exchange])
}

enum AssetClass {
  CANADIAN_EQUITY
  US_EQUITY
  INTERNATIONAL_EQUITY
  REIT
  ETF
  BOND
  PREFERRED_SHARE
  CRCD_SHARE
  CASH
  OTHER
}

enum DataSource {
  YAHOO
  MANUAL
  CRCD_FEED   // future: scrape Desjardins CRCD price page
}

// Position — computed at query time from transactions (see /lib/positions/).
// NOT a persisted Prisma model in v1. Defined as a TypeScript interface
// (ComputedPosition) in code. Computed fields include:
//   - quantity (sum of BUY/DRIP - SELL, adjusted for SPLIT/MERGER)
//   - averageCost (ACB method, see §4.7)
//   - totalCost, marketValue, unrealizedGain
// A materialized PortfolioSnapshot table will be added only if dashboard
// render exceeds 500ms with full data (see §3.3).

// Transaction — the source of truth for all holdings changes
//
// SIGN CONVENTION for amountCents (natural / cash-flow perspective):
//   Negative (money leaves):  BUY, DRIP, WITHDRAWAL, FEE, TAX_WITHHELD
//   Positive (money arrives):  SELL, DIVIDEND, INTEREST, DEPOSIT
//   Zero (no cash movement):   SPLIT, MERGER
//   Signed as appropriate:     ADJUSTMENT
// CSV import normalizes broker-specific conventions to this internal standard.
model Transaction {
  id            String          @id @default(cuid())
  accountId     String
  account       Account         @relation(fields: [accountId], references: [id])
  securityId    String?                              // null for pure cash movements
  security      Security?       @relation(fields: [securityId], references: [id])
  type          TransactionType
  date          DateTime        @db.Date
  quantity      Decimal?                             // for BUY/SELL, number of shares
  priceCents    BigInt?                              // per-share price in transaction currency
  amountCents   BigInt                               // total signed amount in transaction currency
  currency      String                               // transaction currency, not base
  feeCents      BigInt          @default(0)
  note          String?
  importBatchId String?                              // null for manually-entered; set for CSV-imported
  importBatch   ImportBatch?    @relation(fields: [importBatchId], references: [id])
  createdAt     DateTime        @default(now())

  @@index([accountId, date])
  @@index([securityId, date])
  @@index([importBatchId])
}

enum TransactionType {
  BUY
  SELL
  DIVIDEND
  INTEREST
  FEE
  DEPOSIT      // cash into account
  WITHDRAWAL   // cash out of account
  TAX_WITHHELD // foreign dividend withholding
  SPLIT        // stock split (quantity change, no cash)
  DRIP         // dividend reinvestment — treated as BUY for ACB, distinguishable in reports
  MERGER       // ticker change / merger (new Security created; two MERGER txns: one closing old, one opening new)
  ADJUSTMENT   // manual correction
}

// Price — daily close prices for a security
model Price {
  id         String   @id @default(cuid())
  securityId String
  security   Security @relation(fields: [securityId], references: [id])
  date       DateTime @db.Date
  priceCents BigInt                           // in the security's native currency
  source     String   @default("yahoo")

  @@unique([securityId, date])
  @@index([date])
}

// FX rate — daily exchange rates
model FxRate {
  id              String   @id @default(cuid())
  fromCurrency    String
  toCurrency      String
  date            DateTime @db.Date
  rate            Decimal  @db.Decimal(18, 8)    // e.g., 1.35812500
  source          String   @default("yahoo")

  @@unique([fromCurrency, toCurrency, date])
  @@index([date])
}
```

### 3.2 Planning entities

```prisma
// Pension — user's defined-benefit pension(s)
// Configurable to support different pension formulas
model Pension {
  id                    String  @id @default(cuid())
  userId                String
  user                  User    @relation(fields: [userId], references: [id])
  name                  String                         // "RRMD"
  startYear             Int                            // service start year
  baseAccrualRate       Decimal                        // e.g., 0.015 (1.5%)
  initialBaseYears      Int     @default(2)            // "Régime B" years
  earlyRetirementReduction Decimal @default(0.04)      // 4% per year before normalAge
  normalRetirementAge   Int     @default(65)
  salaryBasisCents      BigInt                         // salary used for pension calc
  isActive              Boolean @default(true)
}

// IncomeStream — non-investment income sources for retirement projection
// Examples: pension, CPP/QPP, OAS, rental income
model IncomeStream {
  id                String    @id @default(cuid())
  userId            String
  user              User      @relation(fields: [userId], references: [id])
  name              String                             // "QPP", "OAS", "RRMD pension"
  type              IncomeType
  startAge          Int                                // age at which this income begins
  endAge            Int?                               // null = lifetime
  annualAmountCents BigInt?                            // fixed amount, or null if computed
  computedFromPensionId String?                        // references Pension if computed
  inflationIndexed  Boolean   @default(true)
  notes             String?
}

enum IncomeType {
  PENSION
  GOVERNMENT_BENEFIT   // CPP, QPP, OAS
  RENTAL
  OTHER
}

// Scenario — a named retirement scenario for comparison
model Scenario {
  id                  String   @id @default(cuid())
  userId              String
  user                User     @relation(fields: [userId], references: [id])
  name                String                          // "Base case", "Retire at 58", "No DRIP"
  retirementAge       Int
  targetIncomeReplacement Decimal                     // e.g., 0.70
  assumedPriceGrowth  Decimal                         // annual, e.g., 0.02
  assumedDividendGrowth Decimal                       // annual, e.g., 0.01
  assumedInflation    Decimal  @default(0.025)
  monthlyContributionCents BigInt                     // going forward
  contributionAllocation Json                         // { [accountId: string]: number } — percentages summing to 1.0
  reinvestDividends   Boolean  @default(true)
  isBaseline          Boolean  @default(false)        // shown as default
  createdAt           DateTime @default(now())
}

// ContributionYear — REER/CELI/CRCD contribution tracking
model ContributionYear {
  id                 String   @id @default(cuid())
  userId             String
  user               User     @relation(fields: [userId], references: [id])
  year               Int
  age                Int                               // computed from birthYear

  // REER
  reerLimitCents     BigInt   @default(0)             // new limit granted this year
  reerContributionCents BigInt @default(0)
  // reerRoomRemaining is computed: prevYearRoom + limit - contribution

  // CELI
  celiLimitCents     BigInt   @default(0)
  celiContributionCents BigInt @default(0)

  // Marge (non-registered) — no limits, just tracked for total-contribution view
  margeContributionCents BigInt @default(0)

  // CRCD
  crcdContributionCents BigInt @default(0)
  // 2025 cap: $5,000 per year

  notes String?

  @@unique([userId, year])
}

// Contribution — individual contribution events (sums up into ContributionYear)
// Optional detail layer; v1 may aggregate only
model Contribution {
  id         String   @id @default(cuid())
  accountId  String
  account    Account  @relation(fields: [accountId], references: [id])
  date       DateTime @db.Date
  amountCents BigInt
  note       String?
}

// CRCDHolding — tracks individual CRCD tranches (each purchase year is distinct)
model CRCDHolding {
  id                    String   @id @default(cuid())
  accountId             String
  purchaseYear          Int                             // e.g., 2022, 2024, 2025
  quantity              Decimal
  averagePriceCents     BigInt
  redemptionEligibleDate DateTime @db.Date             // typically purchase + 7 years
  taxCreditClaimedCents BigInt   @default(0)           // 30% Quebec credit
  notes                 String?
}

// Watchlist — stocks of interest not (yet) held
model WatchlistItem {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  securityId   String
  security     Security @relation(fields: [securityId], references: [id])
  source       String?                              // "Dividend King", "Aristocrat", "Own research"
  targetBuyPriceCents BigInt?
  note         String?
  addedAt      DateTime @default(now())

  @@unique([userId, securityId])
}

// ImportProfile — saved column mappings for CSV imports (per user per broker)
// The user defines "Desjardins buys" once, and subsequent imports reuse this mapping.
model ImportProfile {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name         String                               // "Desjardins — Buy history", "Questrade trades"
  description  String?
  // Column mapping stored as JSON: { "Trade Date": "date", "Symbol": "symbol", ... }
  columnMapping Json
  // Value normalization: negative amounts mean buy vs sell, currency assumptions, date format, etc.
  options      Json                                 // { dateFormat: "YYYY-MM-DD", buySign: "positive", ... }
  defaultAccountId String?                          // pre-select this account when using this profile
  defaultAccount   Account? @relation(fields: [defaultAccountId], references: [id])
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  lastUsedAt   DateTime?

  batches      ImportBatch[]

  @@index([userId])
}

// ImportBatch — audit record of a CSV import, enables rollback
model ImportBatch {
  id             String   @id @default(cuid())
  userId         String
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  profileId      String?
  profile        ImportProfile? @relation(fields: [profileId], references: [id])
  sourceFilename String                               // "desjardins-2025-Q1.csv"
  sourceChecksum String                               // SHA-256 of file, for duplicate detection
  rowCount       Int                                  // rows in the CSV
  createdCount   Int                                  // transactions actually inserted
  skippedCount   Int                                  // rows skipped as duplicates
  errorCount     Int                                  // rows that failed
  status         ImportStatus
  log            Json                                 // detailed per-row results
  createdAt      DateTime @default(now())

  transactions   Transaction[]                        // via Transaction.importBatchId

  @@index([userId])
  @@index([sourceChecksum])
}

enum ImportStatus {
  PREVIEW        // dry-run, not yet committed
  COMMITTED      // rows inserted
  ROLLED_BACK    // user rolled back this batch; linked transactions deleted
  FAILED         // fatal error during import
}
```

**Schema note on transaction imports:** Add an optional `importBatchId String?` column to the `Transaction` model, referencing `ImportBatch`. This lets a full batch be rolled back (delete all transactions with that `importBatchId`) and makes it obvious in the transaction log which entries came from which import.

### 3.3 Computed-on-read vs materialized

In v1, the following are computed at query time from transactions:

- Current positions (quantity, cost basis)
- Historical monthly dividend totals
- Account-level market value
- Net worth timeline

**[SHOULD]** Introduce a nightly `portfolio_snapshots` materialized table in v1 if dashboard render time exceeds 500ms with full data. Measure first.

### 3.4 Money handling rules

**These rules are binding across the entire codebase and the most common source of bugs in finance apps.**

1. **All money is stored as `BigInt` cents** in the database. Never `Float`, never `Number`.
2. **All user-facing money is formatted with `Intl.NumberFormat`** respecting user locale.
3. **Arithmetic on money is done in cents** and only converted to dollars for display.
4. **Cross-currency operations** always go through an explicit FX rate lookup for the transaction date. Never use today's rate for historical operations.
5. **Rounding** follows banker's rounding (round half to even) for display. Internal aggregation uses integer arithmetic — no rounding until display.
6. **Percentages** are stored as `Decimal` (not cents). Use `Decimal(10, 6)` — enough precision for 0.000001 (one-millionth).
7. **FX rates** are stored as `Decimal(18, 8)`.
8. **Sign convention for `amountCents`:** BUY, DRIP, WITHDRAWAL, FEE, TAX_WITHHELD are **negative** (money leaves). SELL, DIVIDEND, INTEREST, DEPOSIT are **positive** (money arrives). SPLIT and MERGER are **zero** (no cash movement). ADJUSTMENT is signed as appropriate. CSV import normalizes broker-specific conventions to this standard.

### 3.5 Data isolation rules (multi-user)

**Binding across the codebase. Every data-access query on user-owned data MUST be scoped by the authenticated user's `id`.** Failure to do so is a privacy bug, not a convenience issue.

**Per-user entities** (every query includes `userId = session.userId`):
- `Account`, `Pension`, `Scenario`, `IncomeStream`, `ContributionYear`, `WatchlistItem`

**Account-scoped entities** (access via the owning `Account`, whose `userId` must match `session.userId`):
- `Transaction`, `Contribution`, `CRCDHolding`

**Shared catalog entities** (not user-scoped; readable by all authenticated users):
- `Security`, `Price`, `FxRate`, `cra_limits` (seed data)

**Implementation rules:**
1. Use Prisma middleware or a typed wrapper (`prisma.scoped(userId)`) that automatically injects `userId` into every query. Raw `prisma.account.findMany()` without a user scope must fail in code review.
2. Integration tests must include a "user isolation" suite: given two users with data, verify that every API endpoint, when called as user A, never returns any data belonging to user B.
3. Admin-only endpoints (user management) explicitly skip user-scoping but require `isAdmin = true` on the session user. Mark these with a decorator or comment so they're easy to audit.
4. **No endpoint in v1 returns aggregate data across users.** Not even for the admin. Household aggregation is deferred.

---

## 4. Quebec and Canadian-specific rules

This is knowledge Claude Code cannot be assumed to have. These rules **must** be implemented exactly as described. When in doubt, re-read this section before writing code that touches money.

### 4.1 REER (RRSP) contribution rules

- Annual limit: `min(18% of previous year's earned income, federal cap)`. Federal cap is set yearly by the CRA. **Store federal caps in a seed table `cra_limits` keyed by year** so they're trivial to update.
- Unused contribution room carries forward indefinitely.
- Room calculation: `room_year_N = room_year_(N-1) + new_limit_year_N - contributions_year_N`
- Contributions in the first 60 days of year N+1 may be applied to year N.
- **Decision (v1.3):** The 60-day rule is **not modeled** in v1. Contributions are tracked by calendar year only. Jan-Feb contributions always count toward the current calendar year. This limitation is noted in user-facing help text. If needed, manual adjustment of `ContributionYear` records is the workaround.

### 4.2 CELI (TFSA) contribution rules

- Annual limit: set yearly by federal government. Historical amounts (keep in seed):
  - 2009: $5,000, 2010–2012: $5,000, 2013–2014: $5,500, 2015: $10,000
  - 2016–2018: $5,500, 2019–2022: $6,000, 2023: $6,500, 2024–2025: $7,000
  - 2026 onward: **[DECIDE]** verify at implementation time from `canada.ca`
- Room accrues starting at age 18.
- Withdrawals restore contribution room the following calendar year (this is different from REER).
- **[SHOULD]** The app warns if planned contribution exceeds available room.

### 4.3 CRCD rules

- Maximum purchase per year: $5,000 (as of the user's most recent tranche). Verify current cap at implementation time.
- 30% Quebec tax credit on purchase, claimed in the year of purchase.
- Shares must be held for a minimum period (typically 7 years) before redemption without penalty.
- Price is set monthly by Desjardins, not market-traded.
- Each annual tranche is tracked separately (different purchase price, different redemption eligibility date).
- CRCD does **not** count against REER or CELI room — it is its own bucket.

### 4.4 Withholding tax on foreign dividends

- US dividends in an RRSP: **no** withholding (under Canada-US tax treaty).
- US dividends in a TFSA: 15% withholding, not recoverable.
- US dividends in non-registered: 15% withholding, recoverable as foreign tax credit.
- International (non-US) dividends: varies, typically 15%.

**[SHOULD]** The app displays gross vs net dividend per transaction when withholding applies. This matters for the dividend log and for projecting retirement income.

### 4.5 Defined-benefit pension formula (user's "RRMD")

Based on the user's current spreadsheet formulas:

```
annual_pension_at_retirement =
  (initial_base_years × base_accrual_rate × salary_basis) +
  (max(0, years_of_service - initial_base_years) × base_accrual_rate × salary_basis)

early_retirement_reduction = max(0, (normal_retirement_age - actual_retirement_age) × reduction_rate)

final_annual_pension = annual_pension_at_retirement × (1 - early_retirement_reduction)

years_of_service = retirement_year - service_start_year
```

With the user's current parameters (stored in `Pension` row):
- `initial_base_years = 2`
- `base_accrual_rate = 0.015`
- `normal_retirement_age = 65`
- `reduction_rate = 0.04`
- `service_start_year = 2010`
- `salary_basis = current salary`

### 4.6 QPP and OAS (for eventual retirement projection)

v1 does **not** compute QPP or OAS automatically. These are modeled as `IncomeStream` rows the user creates with expected amounts and ages. Claude Code should seed placeholder rows during initial setup so the user knows to fill them in.

### 4.7 Cost basis method — Adjusted Cost Base (ACB)

**v1 uses the Average Cost / Adjusted Cost Base (ACB) method for all positions.** This is not a convenience choice — for Canadian non-registered accounts, the CRA requires ACB for computing capital gains. Using any other method (FIFO, LIFO, specific lot) would produce incorrect tax figures.

**ACB calculation:**

```
on each BUY:
  new_total_cost = prev_total_cost + (buy_quantity × buy_price) + fees
  new_quantity   = prev_quantity + buy_quantity
  new_acb_per_share = new_total_cost / new_quantity

on each SELL:
  // ACB per share does NOT change on a sell
  realized_gain = (sell_price × sell_quantity) - (acb_per_share × sell_quantity) - fees
  new_total_cost = acb_per_share × (prev_quantity - sell_quantity)
  new_quantity   = prev_quantity - sell_quantity

on each SPLIT (e.g., 2-for-1):
  new_quantity = prev_quantity × split_ratio
  total_cost unchanged
  new_acb_per_share = total_cost / new_quantity

on DIVIDEND (cash):
  no change to quantity, total_cost, or ACB per share
  (cash is recorded separately)

on DRIP (dividend reinvestment — TransactionType.DRIP, treated as BUY for ACB):
  apply BUY formula above
  // DRIP is a distinct TransactionType so reports can distinguish reinvested vs manual purchases
```

**Key consequences for the implementation:**

1. The `Position` derivation logic must process transactions **in chronological order** (not insertion order). A BUY inserted after a SELL on an earlier date still needs to be applied in date order.
2. Cross-currency positions: ACB is computed in the **transaction currency**, not the base currency. A USD position has USD ACB. Conversion to CAD for display uses the current FX rate for market value, but the rate at time-of-transaction for realized gains.
3. For tax purposes (non-registered accounts only), realized gains must be reported in CAD using the **FX rate at transaction date**. Store this on the SELL transaction as `realizedGainCadCents` — a denormalized field that Claude Code computes once and never recomputes (historical FX rates don't change, but using today's rate retroactively would corrupt tax reporting).
4. Registered accounts (CELI, REER) don't generate taxable events, but ACB is still tracked for reporting consistency. The app does not surface realized gains for registered accounts in any "tax" view.

**What ACB does not support:**

- Tax-loss harvesting via specific lot selection. If the user wants to sell only their most-expensive-cost lots to realize a larger loss, ACB can't do that — you'd sell shares at the averaged cost. This is a known limitation, acceptable because (a) it matches CRA rules for non-registered anyway, and (b) v1 doesn't target aggressive tax optimization.

**When to revisit:** If the user starts doing active tax-loss harvesting in Marge accounts and feels limited, specific-lot tracking becomes a v2 feature. The transaction log contains enough data to reconstruct lots retroactively — no data loss.

---

## 5. Features — organized by priority

### 5.1 [MUST] Module A: Dashboard (Priority 1)

**The dashboard is the home page. It is the first thing the user sees every time.** Speed and clarity matter more than comprehensiveness. If you can't fit it above the fold on desktop or in the first scroll on mobile, it probably belongs on a detail page.

#### 5.1.1 Hero: "Years to freedom"

The single most important number on the dashboard. Large type, prominent placement.

- Computed value: `targetRetirementAge - currentAge` OR a date if within 2 years
- Sub-label: progress toward target (coverage %)
- Coverage % = `(projected_retirement_income / target_retirement_income)` where:
  - `target_retirement_income = current_salary × target_income_replacement`
  - `projected_retirement_income = pension_at_retirement + projected_dividend_income_at_retirement + projected_withdrawal_income`
- Color: green when ≥ 100%, yellow 80–100%, red < 80%

#### 5.1.2 Net worth

- Current total in base currency (CAD)
- Day change ($ and %)
- Sparkline: last 365 days
- Breakdown by account type (bar or donut): CELI, REER, Marge, CRCD, Cash

#### 5.1.3 Income composition (at target retirement age)

**This is the section that makes this app different from Ghostfolio.** A stacked area chart showing projected annual income year-over-year from ages `currentAge` through `targetRetirementAge + 30`, with components:

- Pension (from RRMD)
- Dividend income (from current portfolio)
- CRCD distributions (if applicable)
- Government benefits (QPP, OAS) when user has filled these in
- Portfolio withdrawals (computed from scenario)

A horizontal line overlays at `target_retirement_income` so the user immediately sees coverage over time.

#### 5.1.4 Day movers

- Biggest winner today (security + $ and %)
- Biggest loser today (security + $ and %)
- Total portfolio change today ($ and %)

#### 5.1.5 Dividends summary

- Annualized expected income (sum of `quantity × annual_dividend_per_share` for all positions)
- Average monthly dividend (`annualized / 12`)
- Dividends received YTD
- Dividends received prior year (for comparison)

#### 5.1.6 Quick links / actions

- Add transaction
- Add dividend received
- Go to scenarios
- Go to holdings

#### 5.1.7 Last updated indicator

Small text showing when prices were last fetched. If > 24 hours ago, show a warning.

#### 5.1.8 Acceptance criteria for dashboard

- Initial render completes in < 1 second with full seed data loaded
- All numbers match the equivalent computation in the original spreadsheet, within rounding
- Mobile view (375px wide) fits hero, net worth, and income composition without horizontal scroll
- All text is translated into both English and French

### 5.2 [MUST] Module B: Holdings (Priority 2)

The full portfolio view. Dense, sortable, filterable.

#### 5.2.1 Holdings table

One row per `Position`. Columns (all sortable, some toggleable):

- Account
- Symbol
- Name
- Asset class
- Currency
- Quantity
- Average cost (per share)
- Total cost (base currency)
- Current price
- Market value (native currency)
- Market value (base currency, CAD)
- Day change $ / %
- Unrealized gain $ / %
- Annual dividend per share
- Expected annual income
- Yield
- Yield on cost
- Dividend growth streak (years)

Filters:
- By account
- By asset class
- By currency
- By "paying dividends / not"

Row actions:
- View detail page
- Add transaction
- Add dividend
- Mark inactive (soft-delete position when quantity = 0)

#### 5.2.2 Security detail page

Per-security deep dive showing:

- All transactions for that security across all accounts
- Monthly dividend history (the grid from the original spreadsheet, but queryable)
- Price chart (1M, 3M, 6M, 1Y, 5Y, max)
- Computed metrics: total return, dividend yield, yield on cost, total dividends received

#### 5.2.3 Transaction entry form

Must be fast. A user adding a dividend should be able to do it in under 15 seconds.

Fields:
- Account (dropdown, remembers last used)
- Type (BUY, SELL, DIVIDEND, etc.)
- Date (defaults to today)
- Security (autocomplete; if not found, prompt to add)
- Quantity (conditional on type)
- Price per share (conditional on type)
- Total amount (auto-computed but editable for rounding)
- Currency (inherits from account, overridable)
- Fee (optional)
- Note (optional)

#### 5.2.4 Acceptance criteria for holdings

- User can add a BUY transaction in ≤ 4 form interactions
- Holdings table renders 100+ positions in < 500ms
- Sorting changes are instant (client-side)
- Filtering is saved across sessions (localStorage)

### 5.3 [MUST] Module C: Contribution room (Priority 3)

#### 5.3.1 Contribution room overview

A year-by-year table (vertical orientation, like the original spreadsheet's `Cotisations` sheet) showing:

- Year
- Age that year
- REER: new room granted / contributed / remaining
- CELI: new room granted / contributed / remaining
- CRCD: contributed (no room concept)
- Marge: contributed (no room concept)
- Total contributed that year
- Annual target (user-configurable)
- % of target achieved

#### 5.3.2 Current year summary card

On the dashboard and as its own page:

- Current REER room remaining (with progress bar vs target)
- Current CELI room remaining (with progress bar vs target)
- CRCD: amount contributed this year / annual cap

#### 5.3.3 Edit flow

- User edits a single cell in the year-by-year table inline
- Changes propagate: if user edits contribution, remaining recalculates for that year AND carries forward
- Changes to historical years require confirmation (prevent accidental edits)

#### 5.3.4 Seed data

CRA annual limits must be seeded. See section 4.1 and 4.2.

### 5.4 [MUST] Module D: Retirement planning (Priority 4)

#### 5.4.1 Scenario comparison

A page where the user can:

- View the baseline scenario
- Duplicate and modify to create variants
- Compare up to 4 scenarios side by side

Each scenario surfaces, as computed values:
- Projected portfolio value at retirement age
- Projected annual dividend income at retirement age (with and without reinvestment)
- Total retirement income at retirement age (dividends + pension + other income streams)
- Coverage % vs target
- Year-by-year portfolio value through age 90
- Year-by-year income composition

The baseline is the "current plan." Named scenarios are saved and can be toggled on the dashboard chart.

#### 5.4.2 RRMD pension calculator

A configurable form that computes annual pension under the formula in section 4.5. Stored as a `Pension` row.

User adjusts:
- Retirement age (slider, 50–70)
- Salary basis (defaults to current)
- Accrual rate (rarely changed)

Output:
- Annual pension at retirement age
- Monthly pension
- Reduction applied
- Years of service at retirement

#### 5.4.3 FIRE calculator

Given current portfolio, contribution rate, and growth assumptions, compute:

- Years until portfolio income covers target retirement income
- Years until portfolio + pension covers target retirement income
- Equivalent "FI number" (target portfolio value)

#### 5.4.4 Income stream management

A page to add/edit `IncomeStream` rows. On first run, Claude Code should seed:

- QPP (placeholder, starts at age 65, amount null — user fills in estimate from Service Canada)
- OAS (placeholder, starts at age 65, amount null)

#### 5.4.5 Acceptance criteria for retirement planning

- Default scenario is always computed and shown on first load, no user setup required
- A scenario change recomputes and redraws all charts in < 500ms
- The dashboard income composition chart reflects the selected scenario

### 5.5 [LATER] Module E: Watchlist & research (Priority 5)

v1.1 or later. Listed here so its data model is not overlooked, but implementation is **deferred until after v1 ships**.

When built, includes:

- Watchlist (the current spreadsheet's `Watchlist` sheet)
- Pépites margin strategy tracker (the current spreadsheet's `Pépites` sheet)
- Free-form research notes per security
- Morningstar rating field (manual)

Data model is defined in section 3 so that transaction and holdings data does not need to be migrated again when this is built.

### 5.6 [MUST] Module F: Import / Export (Priority 2.5 — supports core tracking)

CSV import is promoted to v1 scope because realistic transaction volume (hundreds of historical buys, ongoing monthly entries) makes manual-only entry unsustainable. The import system is deliberately **broker-agnostic**: a generic CSV importer with user-defined column mappings, rather than Desjardins-specific parsing that would break on any format change.

#### 5.6.1 Import flow

1. **Upload.** User navigates to Import → Upload CSV. Drag-and-drop or file picker. File is parsed client-side for preview (no upload until confirmed).
2. **Profile selection.** User chooses an existing `ImportProfile` (e.g., "Desjardins buys") or creates a new one.
3. **Column mapping.** If new profile: user sees CSV columns on the left, Horizon fields on the right, maps each column. Required mappings: `date`, `symbol`, `type`, `quantity`, `amount`. Optional: `price`, `currency`, `fee`, `note`. Defaults inferable from column headers (e.g., "Trade Date" auto-maps to `date`).
4. **Options.** User sets: target account (defaults from profile), date format (ISO / US / Euro), how to interpret transaction type (column value mapping: "Buy" → `BUY`, "ACH" → `DIVIDEND`, etc.), buy-sign convention (is a buy a positive or negative amount in this broker's export?).
5. **Dry-run preview.** Horizon shows a table of parsed rows with a status column:
   - ✅ **Will create** (new, clean row)
   - ⚠️ **Suspected duplicate** (matches existing transaction on date + account + symbol + quantity + amount — highlighted yellow, user can override)
   - ❌ **Error** (unparseable, missing security, etc.) — shown with error detail
6. **Commit.** User confirms. Horizon creates all "Will create" rows in a single `ImportBatch`. Duplicates skipped, errors listed in the final report.
7. **Report.** User sees: X created, Y skipped as duplicates, Z errors. Errors downloadable as CSV for fixing.

#### 5.6.2 Duplicate detection

Deterministic: a transaction is a duplicate if an existing transaction in the same `userId` scope matches on:
- `accountId`
- `date`
- `securityId` (or `null` for both)
- `type`
- `quantity` (within rounding)
- `amountCents` (exact)

Users can override ("this really is a different transaction, commit anyway") per row.

#### 5.6.3 Idempotency

- The file's SHA-256 is stored on `ImportBatch.sourceChecksum`
- If the user uploads a file with a checksum already committed, Horizon warns prominently before letting them proceed
- Dry-run imports (`status = PREVIEW`) that are never committed are cleaned up after 7 days

#### 5.6.4 Rollback

- From the Imports page, user sees a list of past `ImportBatch` rows
- Clicking one shows its detail and a "Rollback" button
- Rollback deletes all transactions with `importBatchId = batch.id` and sets `batch.status = ROLLED_BACK`
- Rollback is only available within 30 days of import (beyond that, transactions are considered canonical and a manual ADJUSTMENT is the correct correction tool)

#### 5.6.5 Unknown securities

When a CSV contains a symbol not in the `Security` catalog:
- Preview flags the row with a "New security" label
- User clicks to open a quick-create form (symbol, exchange, name, currency, asset class)
- On commit, the security is created and all rows referencing it are processed

#### 5.6.6 Export

Every dataset the user owns must be exportable as CSV. From the Data page:
- Transactions (all, or filtered by date range / account)
- Dividend history
- Positions snapshot
- Contribution history
- Entire portfolio as JSON (covers the "no lock-in" guarantee from §6.3)

#### 5.6.7 Acceptance criteria

- A user can import 100 transactions from a well-formed CSV in under 2 minutes end-to-end (from upload to final commit)
- Re-uploading the exact same file produces zero new transactions (idempotent)
- Rolling back a batch restores the account to its prior state exactly (verified via test)
- Column mappings saved as a profile are automatically reused on the next import — no re-mapping required
- Errors never block the entire import; valid rows commit, invalid rows are reported

#### 5.6.8 Non-goals for CSV import in v1

- **No OFX or QFX.** CSV only. Adding OFX is a v1.1 candidate if needed.
- **No broker-specific parsers.** The column-mapping UI is the interface; we don't ship with "click here for Desjardins" buttons. Profiles are user-created.
- **No automatic fetching** from brokers (no scraping, no API keys). User downloads CSV, user uploads CSV.

---

## 6. Cross-cutting features

### 6.1 [MUST] Internationalization (i18n)

- Two locales from day one: `fr-CA` and `en-CA`
- User toggle in profile menu; persists in `user.locale`
- All user-facing strings go through an i18n framework (`next-intl` recommended for Next.js App Router)
- Quebec-specific terms (CELI, REER, CRCD, RRMD, Marge) are **not** translated — they stay in French in both locales
- Numbers and dates respect locale: `1,234.56` in en-CA, `1 234,56` in fr-CA; `2025-04-15` and `15 avril 2025`
- Currency symbol placement respects locale

### 6.2 [MUST] Price updates

- Nightly cron job at 23:00 America/Toronto
- Fetches:
  - End-of-day price for every `Security` with `dataSource = YAHOO`
  - Previous-day close also fetched (so day-change calculations are accurate on first-load at 23:00)
  - USD/CAD and CAD/USD FX rate for the day
- Manual prices (CRCD) are entered by the user when Desjardins publishes the monthly price
- Rate-limit compliance: Yahoo Finance has undocumented limits; throttle to 1 request / second
- Errors do not block the job; log and continue
- **[SHOULD]** Email or log notification if more than 5 symbols fail in a single run

#### 6.2.1 Historical price backfill

On initial setup (or on-demand from admin settings), Horizon performs a **one-time backfill** of 5 years of daily close prices for all securities via `yahoo-finance2`. This enables portfolio value charts and historical net worth from day one, rather than starting from go-live.

- Throttled at 1 request / second (same as nightly job)
- Progress indicator shown in the admin UI during backfill
- Backfill is idempotent: re-running skips dates that already have a `Price` row
- FX rates (USD/CAD) are also backfilled for the same 5-year window

### 6.3 [MUST] Backup and data export

- Nightly `pg_dump` to a host-mounted volume
- Rotation: keep 7 daily, 4 weekly, 12 monthly
- Manual export: user can download their entire data as JSON from a "Data" settings page
- **Everything the user has entered must be exportable.** This is non-negotiable — no lock-in.

### 6.4 [MUST] Authentication and user management

Designed for a household of 2–5 users on a self-hosted instance. Not a SaaS auth system; avoids over-engineering (no OAuth, no email verification flow, no password reset via email).

#### 6.4.1 Password storage

- Argon2id with sensible defaults (`memoryCost: 19456, timeCost: 2, parallelism: 1` — OWASP-recommended as of 2024)
- Passwords are never logged, never returned in any API response
- Minimum password length: 12 characters. No complexity requirements (length > complexity per current NIST guidance)

#### 6.4.2 Sessions

- Opaque random session tokens, 256 bits from `crypto.randomBytes(32)`, base64url-encoded
- Stored in the `Session` table (see §3.1), associated with `userId`
- Transmitted via HTTP-only, secure, SameSite=Strict cookies
- Default expiry: 30 days, sliding (refreshed on activity)
- Explicit logout deletes the session row; "log out of all devices" deletes all of that user's sessions

#### 6.4.3 Initial setup flow

On a fresh install, the first access to any protected route redirects to `/setup`:

1. Admin enters email, display name, birth year, password (twice), locale preference
2. That user is created with `isAdmin = true`
3. Admin runs the Excel import (optional) or skips to a blank state
4. Admin lands on their dashboard
5. `/setup` becomes inaccessible after any user exists

#### 6.4.4 Creating additional users (admin only)

From Settings → Users (admin-only menu):

1. Admin fills in: email, display name, birth year, **temporary password**
2. New user is created with `isAdmin = false`, `mustChangePassword = true`
3. Admin tells the new user their credentials out-of-band (text, in person — this is a household, not a corporate deployment)
4. On first login, user is forced to change their password before seeing anything else

#### 6.4.5 Login

- Endpoint: `POST /api/auth/login` with `{ email, password }`
- Throttling: max 5 failed attempts per IP per 15 minutes, tracked in-memory (reset on restart — acceptable for household scale)
- Response reveals nothing about whether the email exists ("Invalid credentials" for both wrong email and wrong password)
- On success, creates a `Session`, sets cookie, returns redirect target

#### 6.4.6 Password change

- User can change their own password from Settings → Account
- Requires current password
- Invalidates all other sessions for that user (but keeps current session)

#### 6.4.7 No password reset flow in v1

If a user forgets their password, the admin can:
1. Reset it for them from Settings → Users → Reset Password (sets `mustChangePassword = true`)
2. Communicate the new temporary password out-of-band

If the admin forgets their own password, they can reset it with a CLI script (`npm run reset-admin-password`) that runs against the database directly. This is documented in the operator guide.

#### 6.4.8 User deactivation

- Admin can set a user to `isActive = false`
- Deactivated users can't log in, but their data is preserved (they still show up in historical reports)
- Deletion is not exposed in the UI. If a user needs to be truly deleted (e.g., on request), it's a manual DB operation — documented in the operator guide.

### 6.5 [MUST] Dark/light mode

- Three modes: `"light"`, `"dark"`, `"system"` (follows OS/browser preference)
- Stored in `User.theme` (default: `"system"`)
- Toggle in the profile menu, same location as locale toggle
- Implementation uses Tailwind CSS `dark:` variant with a `class` strategy (not `media`) so the user toggle overrides system preference when set to `"light"` or `"dark"`

### 6.6 [MUST] Audit trail

- Transactions are never deleted. A SELL is a transaction, not a mutation. An accidental entry is corrected via an ADJUSTMENT transaction, not deletion.
- **Exception:** Within 60 seconds of creation, a transaction can be deleted outright (typo correction). After 60 seconds it's immutable and an ADJUSTMENT must be used.
- All transactions have `createdAt` and immutable `id`

---

## 7. Technical architecture

### 7.1 Stack

- **Framework:** Next.js 15, App Router, TypeScript strict mode
- **Runtime:** Node.js 20 LTS
- **Database:** PostgreSQL 16
- **ORM:** Prisma 5
- **Styling:** Tailwind CSS v4
- **Components:** shadcn/ui (copy-paste; not a dependency)
- **Charts:** Recharts
- **Data fetching (client):** TanStack Query v5
- **Forms:** react-hook-form + Zod schema validation
- **i18n:** next-intl
- **Date handling:** date-fns with `fr-CA` and `en-CA` locales
- **Money formatting:** `Intl.NumberFormat` (native)
- **Market data:** `yahoo-finance2` npm package
- **Jobs / cron:** separate small Node service using `node-cron`, same codebase, different entrypoint
- **Testing:** Vitest for unit, Playwright for E2E (basic smoke only in v1)

### 7.2 Repo structure

```
/app                  # Next.js app directory (routes, pages, components)
/lib                  # Shared business logic (no React, no framework)
  /money              # money utilities, FX conversion
  /positions          # position derivation from transactions
  /projections        # retirement projection engine
  /pension            # pension calculation
  /i18n               # locale config
/prisma
  /schema.prisma
  /migrations
  /seed.ts            # seeds CRA limits, user, account types, etc.
/jobs                 # cron jobs (price fetch, fx fetch, backup)
/scripts              # one-off scripts (Excel importer lives here)
/public               # static assets
/tests
  /unit
  /e2e
```

### 7.3 Deployment

- **Target:** Unraid server, 3 Docker containers:
  1. `app` — the Next.js app (Node runtime), port 3000
  2. `jobs` — cron container, same image as `app` with different entrypoint
  3. `db` — PostgreSQL 16 with persistent volume
- `docker-compose.yml` at repo root describes all three
- Reverse proxy (user's existing, presumably SWAG or NPM) terminates TLS, forwards to `app:3000`
- Unraid-specific: all containers on a user-defined bridge network for inter-container DNS
- **Timezone:** All containers set `TZ=America/Toronto` in their environment. All "today" calculations use this timezone. Dates in the DB are `@db.Date` (no time component).

### 7.4 Observability (minimal for v1)

- Application logs via `pino`, JSON output to stdout, captured by Docker
- Health check endpoint at `/api/health` returning DB connectivity status
- No external observability stack in v1 (no Grafana, no Sentry). Add in v1.1 if desired.

### 7.5 Security

- No secrets in the repo; `.env.local` for local dev, Docker secrets or env vars in production
- CSRF protection on all mutating routes (double-submit cookie or origin check; next-auth provides this if used)
- SQL injection: Prisma parameterizes everything; never use `$queryRawUnsafe`
- XSS: React escapes by default; never use `dangerouslySetInnerHTML` without sanitization
- Rate limiting on auth endpoints (see §6.4.5)
- Price and FX data: validate ranges — reject absurd values (e.g., price < 0 or > 10× previous close without manual override)

**Multi-user authorization (critical):**
- Every request that touches user-owned data reads `userId` from the session, not from URL params, query params, or request body. A user cannot "pretend" to be another user by sending a different `userId`.
- Data isolation is enforced at the query layer (see §3.5), not just in UI — an attacker bypassing the UI cannot access another user's data.
- Admin-only endpoints (`/api/admin/*`) explicitly check `session.user.isAdmin` before doing anything; non-admins get `403 Forbidden`.
- User isolation tests are part of the CI suite and block merges if they fail.

---

## 8. Data migration plan

### 8.1 Source

The user's existing Excel file: `Suivi_de_mes_finances.xlsx`, 11 sheets, structure documented in the initial conversation. Key source sheets:

- `Titre et dividendes` — 73 holdings with monthly dividend history from January 2019
- `CRCD` — 3 annual tranches
- `Cotisations` — annual contribution history from 2001
- `Ressources` — account mapping, FX, salary

### 8.2 Migration strategy

A one-shot script, not a feature. Lives in `/scripts/import-excel.ts`. Run by the admin user once, ideally into a staging database first, then copied to production.

**The script accepts `--user-email` as a required argument** and imports all Excel data scoped to that user. This means:
- The primary user runs it to import his own 7 years of history
- If the spouse later wants to migrate her own spreadsheet, the same script runs a second time with her email

Steps:

1. **Parse Excel** using `exceljs` or `xlsx`
2. **Resolve target user** from `--user-email` argument; fail if user doesn't exist
3. **Create accounts** (from `Ressources` sheet) with `userId = target.id`
4. **Create or find Security rows** (shared catalog — not per-user) from unique tickers in the holdings sheet
5. **Reconstruct transactions from current state:**
   - For each holding with current quantity > 0, create a single synthetic BUY transaction dated 2019-01-01 (the start of dividend data) at the cost basis shown. This is a compromise — actual buy history is not in the spreadsheet — but it preserves cost basis and allows position reconstruction.
   - **Decision (v1.3):** Synthetic BUYs are the default. The user will later replace them with real broker history by: (1) rolling back or deleting the synthetic BUYs, (2) importing actual transaction history via the CSV import UI (§5.6). The importer marks synthetic transactions with a distinct `importBatchId` so they can be identified and removed as a group.
6. **Import dividend history:** each non-empty cell in the monthly dividend grid becomes a DIVIDEND transaction dated the 15th of that month (approximation).
7. **Import contribution history** from `Cotisations` into `ContributionYear` rows for the target user.
8. **Import CRCD tranches** as `CRCDHolding` rows on the target user's CRCD account.
9. **Seed pension** from the RRMD sheet's parameters, owned by the target user.
10. **Seed QPP and OAS** as empty `IncomeStream` placeholders for the target user.

### 8.3 Verification

After import, the script prints a reconciliation report:

- Total market value per account (should match spreadsheet within $1)
- Total dividends received per year (should match spreadsheet within $1)
- Contribution totals per year per account (should match)

User reviews, corrects manually, and signs off before relying on the data.

### 8.4 Known compromises

- **Historical buy transactions are synthesized,** not real. If the user wants actual purchase history with real dates and prices, the preferred path is:
  1. Run the Excel importer to seed dividends, contributions, pension, and CRCD
  2. **Delete the synthesized BUY transactions** (or mark them as replaced)
  3. Use §5.6 CSV import against the user's bank portal export to load real buy history
  
  This two-step approach gets the best of both: 7 years of hand-curated dividend data from Excel, plus real transaction history from the broker.
- **Dividend dates are approximate** (15th of the month). If exact payment dates are needed, manual correction or re-import from a broker CSV is required.
- **Price history before go-live** is only fetched going forward. Historical portfolio value charts will start at go-live date.

### 8.5 Relationship between Excel import and CSV import

| Source | Tool | When used | Rollback? |
|---|---|---|---|
| Original Excel file | `/scripts/import-excel.ts` | Once, at initial setup | No (wipe DB and re-run) |
| Ongoing bank CSVs | Import UI (§5.6) | Continuously, as new data available | Yes (within 30 days) |

The Excel importer is a **seed mechanism**, not an ongoing feature. The CSV import UI is the long-term data entry path for anything beyond one-off manual entries.

---

## 9. Phasing

### Phase 0: Foundation (week 1)

- Repo scaffold, Next.js + Prisma + Docker Compose
- Schema migration 1: all tables from section 3 including `User`, `Session`, `Household`
- Seed script with CRA limits, asset class taxonomy, CRCD helper data (no users yet)
- **Full auth implementation** (see §6.4): argon2id passwords, session table, login/logout, cookie handling, rate limiting
- **Initial setup flow** (`/setup`) that creates the first admin user
- **User isolation middleware** — the `scoped` Prisma wrapper, with tests proving cross-user queries fail
- i18n wiring (fr-CA, en-CA), locale stored per-user
- Health check endpoint
- CI passes, including a user-isolation test suite with ≥ 3 representative queries

### Phase 0.5: User management UI (mid-week 1)

- Settings → Users page (admin only)
- Create user form
- Reset password for user
- Deactivate user
- Force-change-password flow on first login
- **This is built in Phase 0.5 even though the second user won't use the app for months,** because doing it now is cheap and retrofitting is painful.

### Phase 1: Read-only dashboard with seed data (week 2)

- Dashboard layout with hardcoded numbers
- Holdings table with hardcoded positions
- Dark/light mode, locale toggle
- **Goal: the UI shell works end to end before real data flows through it.**

### Phase 2: Excel import (week 3)

- `/scripts/import-excel.ts` written and tested with actual user file
- Reconciliation report output
- Data seeded from real Excel

### Phase 3a: Transactions & positions (week 4)

- Transaction entry form (manual)
- Position derivation logic
- Security detail page
- Dividend entry fast-path

### Phase 3b: CSV import (week 5)

- Upload + preview UI
- `ImportProfile` CRUD (save column mappings per broker)
- Column-mapping interface
- Duplicate detection and dry-run
- Commit + rollback
- `ImportBatch` history page
- Real-world test: import user's Desjardins buy history into a staging user

### Phase 4: Price & FX updates (week 6)

- Nightly cron container
- `yahoo-finance2` integration
- FX rate fetch
- Error handling / logging

### Phase 5: Dashboard computations (week 7)

- Replace hardcoded dashboard numbers with real queries
- Charts: net worth over time, income composition, day change
- Performance tuning if needed

### Phase 6: Contribution room (week 8)

- Year-by-year contribution UI
- Current year summary card on dashboard

### Phase 7: Retirement planning (weeks 9–10)

- Pension calculator
- Scenario model and UI
- FIRE calculator
- Income composition projection
- Integrate into dashboard

### Phase 8: Polish & launch (week 11)

- Mobile responsive pass
- Accessibility pass (keyboard nav, screen reader labels)
- Backup cron verified
- Documentation (README, operator guide)
- Migration rehearsal: fresh install → import → verify

**Estimate total:** ~11 weeks at ~8 hours/week = ~90–95 hours. The multi-user foundation in Phase 0/0.5 adds ~5–8 hours vs single-user; the CSV import module in Phase 3b adds another ~8 hours. Both pay for themselves quickly — multi-user retrofits are painful, and manual-only data entry becomes unsustainable past ~100 transactions.

---

## 10. Open questions

Decisions deferred to implementation time, flagged here so they don't get lost:

1. ~~**First-60-days REER rule:**~~ **RESOLVED (v1.3):** Ignored in v1. Tracked by calendar year only. See §4.1.
2. **Intraday price changes on the dashboard:** fetch on page load, or show end-of-day only? → **Recommend end-of-day only for v1** (matches cron cadence); intraday is a v1.1 feature if desired.
3. **2026 CRA contribution limits:** must be verified at implementation from canada.ca.
4. **CRCD data source:** manual for v1. A scraper for desjardins.com is a v1.1 candidate.
5. **Household aggregate views:** not in v1. Decision point is **1 month after the second user is actively using the app** — evaluate whether combined net worth and joint retirement projection are actually valuable, or whether separate personal views are sufficient.
6. **Logo / branding for Horizon.** A simple mark evoking the horizon metaphor (a line, a sunrise, a distant point). Placeholder SVG for favicon until designed. Low priority.
7. ~~**Excel import: synthetic BUYs vs real history:**~~ **RESOLVED (v1.3):** Synthetic BUYs as default, replaced via broker CSV later. See §8.2.
8. ~~**Historical price backfill:**~~ **RESOLVED (v1.3):** 5-year backfill on initial setup. See §6.2.1.

---

## 11. Appendix A: Example computations

Concrete worked examples that Claude Code can use as test fixtures. If the code produces these exact numbers, the logic is correct.

### 11.1 Position derivation

Given transactions on account `CELI (CAD)` for security `ENB.TO`:

| Date | Type | Qty | Price (cents) | Amount (cents) |
|---|---|---|---|---|
| 2021-03-15 | BUY | 30 | 4500 | 135000 |
| 2022-06-10 | BUY | 23 | 5500 | 126500 |
| 2024-11-01 | DIVIDEND | — | — | 20564 |

Expected computed position:
- Quantity: 53
- Total cost: 261,500 cents ($2,615.00)
- Average cost per share: 4,933.96 cents ($49.34/share)
- Total dividends received: 205.64 (for the period covered)

### 11.2 Pension calculation

Given:
- service_start_year = 2010
- retirement_year = 2039 (age 55)
- years_of_service = 29
- salary_basis = $90,000
- initial_base_years = 2
- base_accrual_rate = 0.015
- normal_retirement_age = 65
- reduction_rate = 0.04

Calculation:
- Base A: 2 × 0.015 × 90,000 = $2,700
- Base B: 27 × 0.015 × 90,000 = $36,450
- Pre-reduction: $39,150
- Reduction: (65 - 55) × 0.04 = 0.40
- Final annual pension: $39,150 × (1 − 0.40) = $23,490

### 11.3 FIRE income projection (simplified)

Given:
- Current portfolio value: $700,000
- Annual contribution: $40,000
- Expected price growth: 2%/year
- Expected dividend yield: 2.74%
- Dividend growth: 1%/year
- Years to retirement: 13
- Reinvest dividends: yes

Expected approximate portfolio value at retirement: ~$1.58M
Expected annual dividend income at retirement: ~$50,000 (0.0274 × 1.01^13 × 1.58M, compounded quarterly — see `/lib/projections/fire.ts` for exact algorithm)

Add pension ($23,490 at age 55) + QPP/OAS (none before 60) = total retirement income ~$73,490 at age 55, 81% of $90,000 × 70% × 1.025^13 = $90,000 target.

*(Exact numbers will be computed; these are sanity-check ballparks.)*

---

## 12. Appendix B: UI wireframe notes

Text-only wireframes. Actual visual design is deferred to implementation; the below are **structural** requirements only.

### 12.1 Dashboard (desktop, 1280px+)

```
┌─────────────────────────────────────────────────────────────┐
│ [logo] Horizon                [+ Add] [fr/en] [profile] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │   Years to freedom                                    │ │
│  │   13                    Coverage: 81% of target       │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─────────────────────┐  ┌──────────────────────────────┐ │
│  │ Net worth           │  │  Income composition          │ │
│  │ $700,200 CAD        │  │  [stacked area chart]        │ │
│  │ +$150 today (+0.0%) │  │                              │ │
│  │ [sparkline 365d]    │  │                              │ │
│  └─────────────────────┘  └──────────────────────────────┘ │
│                                                             │
│  ┌─────────────────────┐  ┌──────────────────────────────┐ │
│  │ Dividends           │  │ Day movers                    │ │
│  │ Annual $17,184      │  │ Up:   SU +$383 (1.9%)         │ │
│  │ Monthly avg $1,432  │  │ Down: VCE -$1,957 (-1.4%)     │ │
│  │ YTD $13,549         │  │                                │ │
│  └─────────────────────┘  └──────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Contribution room — 2026                              │ │
│  │ REER: $22,500 left / CELI: $5,500 left / CRCD $0/5000 │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  Last updated: 2026-04-21 23:00 • 0 errors                 │
└─────────────────────────────────────────────────────────────┘
```

### 12.2 Dashboard (mobile, 375px)

Single column, same order:
1. Hero: Years to freedom
2. Net worth
3. Income composition (chart fills width)
4. Dividends summary
5. Day movers
6. Contribution room
7. Last updated

### 12.3 Holdings page

Top: filter bar (account, asset class, currency, "paying dividends" toggle)
Main: sortable data table, 100+ rows, sticky header, horizontal scroll on mobile OR collapsible columns
Bottom: "+ Add transaction" floating button

### 12.4 Scenario comparison page

Left sidebar: list of scenarios with ability to duplicate/edit/delete
Main: selected scenario details (parameters + result card)
Bottom: toggle "compare mode" — shows up to 4 scenarios side-by-side

---

## 13. Appendix C: Things Claude Code should ask before implementing

When the developer (the user) runs Claude Code against this PRD, Claude Code should proactively ask about:

1. Confirmation of the app name before any branding is rendered
2. Confirmation of CRA limits for 2026 if any are missing from seeds
3. The exact salary basis to use in pension calculations (if the value in the spreadsheet has changed)
4. Whether to run the Excel importer against the attached `.xlsx` file in this conversation or a fresh export
5. Any broker/account structure changes since the spreadsheet was last updated
6. Preferred domain name for the deployment (for cookies, CORS, etc.)

---

**End of document.** Total: ~13,500 words. Density is intentional: every paragraph exists to prevent a specific bug or wrong-direction decision during implementation.
