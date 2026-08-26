-- DropIndex
DROP INDEX "service_requests_conversationId_key";

-- CreateIndex
CREATE INDEX "service_requests_conversationId_idx" ON "service_requests"("conversationId");

