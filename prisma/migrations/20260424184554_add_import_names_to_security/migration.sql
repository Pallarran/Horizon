-- AlterTable
ALTER TABLE "Security" ADD COLUMN     "importNames" TEXT[] DEFAULT ARRAY[]::TEXT[];
