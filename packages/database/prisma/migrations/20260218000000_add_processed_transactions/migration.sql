-- CreateTable
CREATE TABLE "processed_transactions" (
    "id" TEXT NOT NULL,
    "transaction_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'stellar_deposit',
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "processed_transactions_transaction_hash_key" ON "processed_transactions"("transaction_hash");

-- CreateIndex
CREATE INDEX "processed_transactions_user_id_idx" ON "processed_transactions"("user_id");

-- CreateIndex
CREATE INDEX "processed_transactions_processed_at_idx" ON "processed_transactions"("processed_at");
