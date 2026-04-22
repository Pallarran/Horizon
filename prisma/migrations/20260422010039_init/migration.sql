-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CELI', 'REER', 'MARGE', 'CRCD', 'CASH', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetClass" AS ENUM ('CANADIAN_EQUITY', 'US_EQUITY', 'INTERNATIONAL_EQUITY', 'REIT', 'ETF', 'BOND', 'PREFERRED_SHARE', 'CRCD_SHARE', 'CASH', 'OTHER');

-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('YAHOO', 'MANUAL', 'CRCD_FEED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('BUY', 'SELL', 'DIVIDEND', 'INTEREST', 'FEE', 'DEPOSIT', 'WITHDRAWAL', 'TAX_WITHHELD', 'SPLIT', 'DRIP', 'MERGER', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "IncomeType" AS ENUM ('PENSION', 'GOVERNMENT_BENEFIT', 'RENTAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PREVIEW', 'COMMITTED', 'ROLLED_BACK', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "birthYear" INTEGER NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'fr-CA',
    "baseCurrency" TEXT NOT NULL DEFAULT 'CAD',
    "theme" TEXT NOT NULL DEFAULT 'system',
    "targetRetirementAge" INTEGER NOT NULL DEFAULT 55,
    "targetIncomeReplacement" DECIMAL(65,30) NOT NULL DEFAULT 0.70,
    "currentSalaryCents" BIGINT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "householdId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Household" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Household_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "currency" TEXT NOT NULL,
    "externalId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "openedDate" TIMESTAMP(3),
    "closedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Security" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "assetClass" "AssetClass" NOT NULL,
    "sector" TEXT,
    "industry" TEXT,
    "isDividendAristocrat" BOOLEAN NOT NULL DEFAULT false,
    "isDividendKing" BOOLEAN NOT NULL DEFAULT false,
    "isPaysMonthly" BOOLEAN NOT NULL DEFAULT false,
    "dataSource" "DataSource" NOT NULL DEFAULT 'YAHOO',
    "manualPrice" DECIMAL(65,30),
    "notes" TEXT,
    "annualDividendCents" BIGINT,
    "dividendFrequency" TEXT,
    "dividendGrowthYears" INTEGER,
    "manualDividendOverride" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Security_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "securityId" TEXT,
    "type" "TransactionType" NOT NULL,
    "date" DATE NOT NULL,
    "quantity" DECIMAL(65,30),
    "priceCents" BIGINT,
    "amountCents" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "feeCents" BIGINT NOT NULL DEFAULT 0,
    "note" TEXT,
    "importBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Price" (
    "id" TEXT NOT NULL,
    "securityId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "priceCents" BIGINT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'yahoo',

    CONSTRAINT "Price_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FxRate" (
    "id" TEXT NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'yahoo',

    CONSTRAINT "FxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pension" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startYear" INTEGER NOT NULL,
    "baseAccrualRate" DECIMAL(65,30) NOT NULL,
    "initialBaseYears" INTEGER NOT NULL DEFAULT 2,
    "earlyRetirementReduction" DECIMAL(65,30) NOT NULL DEFAULT 0.04,
    "normalRetirementAge" INTEGER NOT NULL DEFAULT 65,
    "salaryBasisCents" BIGINT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Pension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomeStream" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "IncomeType" NOT NULL,
    "startAge" INTEGER NOT NULL,
    "endAge" INTEGER,
    "annualAmountCents" BIGINT,
    "computedFromPensionId" TEXT,
    "inflationIndexed" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "IncomeStream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "retirementAge" INTEGER NOT NULL,
    "targetIncomeReplacement" DECIMAL(65,30) NOT NULL,
    "assumedPriceGrowth" DECIMAL(65,30) NOT NULL,
    "assumedDividendGrowth" DECIMAL(65,30) NOT NULL,
    "assumedInflation" DECIMAL(65,30) NOT NULL DEFAULT 0.025,
    "monthlyContributionCents" BIGINT NOT NULL,
    "contributionAllocation" JSONB NOT NULL,
    "reinvestDividends" BOOLEAN NOT NULL DEFAULT true,
    "isBaseline" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContributionYear" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "age" INTEGER NOT NULL,
    "reerLimitCents" BIGINT NOT NULL DEFAULT 0,
    "reerContributionCents" BIGINT NOT NULL DEFAULT 0,
    "celiLimitCents" BIGINT NOT NULL DEFAULT 0,
    "celiContributionCents" BIGINT NOT NULL DEFAULT 0,
    "margeContributionCents" BIGINT NOT NULL DEFAULT 0,
    "crcdContributionCents" BIGINT NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "ContributionYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contribution" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "note" TEXT,

    CONSTRAINT "Contribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CRCDHolding" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "purchaseYear" INTEGER NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "averagePriceCents" BIGINT NOT NULL,
    "redemptionEligibleDate" DATE NOT NULL,
    "taxCreditClaimedCents" BIGINT NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "CRCDHolding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "securityId" TEXT NOT NULL,
    "source" TEXT,
    "targetBuyPriceCents" BIGINT,
    "note" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "columnMapping" JSONB NOT NULL,
    "options" JSONB NOT NULL,
    "defaultAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "ImportProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT,
    "sourceFilename" TEXT NOT NULL,
    "sourceChecksum" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "createdCount" INTEGER NOT NULL,
    "skippedCount" INTEGER NOT NULL,
    "errorCount" INTEGER NOT NULL,
    "status" "ImportStatus" NOT NULL,
    "log" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CraLimit" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "limitCents" BIGINT NOT NULL,

    CONSTRAINT "CraLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_householdId_idx" ON "User"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_token_idx" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Security_symbol_exchange_key" ON "Security"("symbol", "exchange");

-- CreateIndex
CREATE INDEX "Transaction_accountId_date_idx" ON "Transaction"("accountId", "date");

-- CreateIndex
CREATE INDEX "Transaction_securityId_date_idx" ON "Transaction"("securityId", "date");

-- CreateIndex
CREATE INDEX "Transaction_importBatchId_idx" ON "Transaction"("importBatchId");

-- CreateIndex
CREATE INDEX "Price_date_idx" ON "Price"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Price_securityId_date_key" ON "Price"("securityId", "date");

-- CreateIndex
CREATE INDEX "FxRate_date_idx" ON "FxRate"("date");

-- CreateIndex
CREATE UNIQUE INDEX "FxRate_fromCurrency_toCurrency_date_key" ON "FxRate"("fromCurrency", "toCurrency", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ContributionYear_userId_year_key" ON "ContributionYear"("userId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_userId_securityId_key" ON "WatchlistItem"("userId", "securityId");

-- CreateIndex
CREATE INDEX "ImportProfile_userId_idx" ON "ImportProfile"("userId");

-- CreateIndex
CREATE INDEX "ImportBatch_userId_idx" ON "ImportBatch"("userId");

-- CreateIndex
CREATE INDEX "ImportBatch_sourceChecksum_idx" ON "ImportBatch"("sourceChecksum");

-- CreateIndex
CREATE UNIQUE INDEX "CraLimit_year_type_key" ON "CraLimit"("year", "type");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "Security"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Price" ADD CONSTRAINT "Price_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "Security"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pension" ADD CONSTRAINT "Pension_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeStream" ADD CONSTRAINT "IncomeStream_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionYear" ADD CONSTRAINT "ContributionYear_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CRCDHolding" ADD CONSTRAINT "CRCDHolding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "Security"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportProfile" ADD CONSTRAINT "ImportProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportProfile" ADD CONSTRAINT "ImportProfile_defaultAccountId_fkey" FOREIGN KEY ("defaultAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ImportProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
