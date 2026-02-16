-- CreateEnum
CREATE TYPE "WalletType" AS ENUM ('INVISIBLE', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "WalletProvider" AS ENUM ('STELLAR');

-- AlterEnum
ALTER TYPE "Provider" ADD VALUE IF NOT EXISTS 'STELLAR';

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "WalletType" NOT NULL DEFAULT 'INVISIBLE',
    "provider" "WalletProvider" NOT NULL DEFAULT 'STELLAR',
    "public_key" TEXT NOT NULL,
    "secret_encrypted" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallets_public_key_key" ON "wallets"("public_key");

-- CreateIndex
CREATE INDEX "wallets_user_id_idx" ON "wallets"("user_id");

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
