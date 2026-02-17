-- AlterTable: Add missing columns to escrows table
ALTER TABLE "escrows" ADD COLUMN "amount" TEXT NOT NULL DEFAULT '0.00';
ALTER TABLE "escrows" ADD COLUMN "funded_at" TIMESTAMP(3);
ALTER TABLE "escrows" ADD COLUMN "released_at" TIMESTAMP(3);
ALTER TABLE "escrows" ADD COLUMN "refunded_at" TIMESTAMP(3);
