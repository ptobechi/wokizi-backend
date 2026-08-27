-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'CLOSED';

-- AlterEnum
ALTER TYPE "ServiceRequestStatus" ADD VALUE 'PRICE_UPDATED';

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_quotationId_fkey";

-- DropForeignKey
ALTER TABLE "service_requests" DROP CONSTRAINT "service_requests_quotationId_fkey";

-- DropIndex
DROP INDEX "service_requests_quotationId_key";

-- AlterTable: add totalAmount nullable first so existing rows aren't broken,
-- backfill from the linked quotation (every existing booking has one — this
-- is the only origin that existed before serviceRequestId), then enforce
-- NOT NULL now that every row has a value.
ALTER TABLE "bookings" ADD COLUMN     "serviceRequestId" TEXT,
ADD COLUMN     "totalAmount" DOUBLE PRECISION,
ALTER COLUMN "quotationId" DROP NOT NULL;

UPDATE "bookings" b
SET "totalAmount" = q."totalAmount"
FROM "quotations" q
WHERE q.id = b."quotationId" AND b."totalAmount" IS NULL;

ALTER TABLE "bookings" ALTER COLUMN "totalAmount" SET NOT NULL;

-- AlterTable
ALTER TABLE "service_requests" DROP COLUMN "quotationId";

-- CreateTable
CREATE TABLE "service_request_price_history" (
    "id" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "previousPrice" DOUBLE PRECISION NOT NULL,
    "newPrice" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "changedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_request_price_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_request_price_history_serviceRequestId_idx" ON "service_request_price_history"("serviceRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_serviceRequestId_key" ON "bookings"("serviceRequestId");

-- AddForeignKey
ALTER TABLE "service_request_price_history" ADD CONSTRAINT "service_request_price_history_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "service_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

