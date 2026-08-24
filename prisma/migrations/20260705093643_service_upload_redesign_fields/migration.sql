-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('LABOUR', 'MATERIALS', 'BOTH');

-- CreateEnum
CREATE TYPE "PricingModel" AS ENUM ('FIXED_PRICE', 'CUSTOM_QUOTE');

-- CreateEnum
CREATE TYPE "ResponseTime" AS ENUM ('WITHIN_30_MIN', 'WITHIN_1_HOUR', 'WITHIN_FEW_HOURS', 'WITHIN_24_HOURS', 'WITHIN_2_3_DAYS');

-- AlterTable
ALTER TABLE "availability" ADD COLUMN     "advanceBookingHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "breakEndTime" TEXT,
ADD COLUMN     "breakStartTime" TEXT;

-- AlterTable
ALTER TABLE "service_listings" ADD COLUMN     "customerRequirements" TEXT,
ADD COLUMN     "extraCharges" JSONB,
ADD COLUMN     "isEmergency" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "materialHandlingFee" DOUBLE PRECISION,
ADD COLUMN     "minimumServiceCharge" DOUBLE PRECISION,
ADD COLUMN     "pricingModel" "PricingModel" NOT NULL DEFAULT 'FIXED_PRICE',
ADD COLUMN     "responseTime" "ResponseTime" NOT NULL DEFAULT 'WITHIN_1_HOUR',
ADD COLUMN     "serviceType" "ServiceType" NOT NULL DEFAULT 'BOTH',
ADD COLUMN     "shortDescription" TEXT,
ADD COLUMN     "toolsEquipment" TEXT,
ADD COLUMN     "whatsIncluded" TEXT,
ADD COLUMN     "whatsNotIncluded" TEXT;
