-- AlterTable
ALTER TABLE "api_keys" ADD COLUMN "marketplace_id" TEXT;

-- CreateIndex
CREATE INDEX "api_keys_marketplace_id_idx" ON "api_keys"("marketplace_id");
