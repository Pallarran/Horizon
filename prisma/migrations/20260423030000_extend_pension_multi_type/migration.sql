-- CreateEnum
CREATE TYPE "PensionPlanType" AS ENUM ('DB_FORMULA', 'DB_STATEMENT', 'DC');

-- AlterTable
ALTER TABLE "Pension" DROP COLUMN "initialBaseYears",
ADD COLUMN     "assumedGrowthRate" DECIMAL(65,30) DEFAULT 0.05,
ADD COLUMN     "bridgeBenefitCents" BIGINT,
ADD COLUMN     "bridgeEndAge" INTEGER DEFAULT 65,
ADD COLUMN     "currentBalanceCents" BIGINT,
ADD COLUMN     "dcSalaryCents" BIGINT,
ADD COLUMN     "employeeContribRate" DECIMAL(65,30),
ADD COLUMN     "employerContribRate" DECIMAL(65,30),
ADD COLUMN     "indexationRate" DECIMAL(65,30) DEFAULT 0,
ADD COLUMN     "planType" "PensionPlanType" NOT NULL DEFAULT 'DB_FORMULA',
ADD COLUMN     "statementAnnualCents" BIGINT,
ADD COLUMN     "statementRetirementAge" INTEGER,
ALTER COLUMN "startYear" DROP NOT NULL,
ALTER COLUMN "baseAccrualRate" DROP NOT NULL,
ALTER COLUMN "earlyRetirementReduction" DROP NOT NULL,
ALTER COLUMN "earlyRetirementReduction" DROP DEFAULT,
ALTER COLUMN "normalRetirementAge" DROP NOT NULL,
ALTER COLUMN "normalRetirementAge" DROP DEFAULT,
ALTER COLUMN "salaryBasisCents" DROP NOT NULL;
