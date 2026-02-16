# Implementation Plan: Crypto-Native

**Status:** Approved
**Date:** 2026-02-16
**Estimated Effort:** 8-10 days (1 developer)

---

## Phases Overview

| Phase | Name | Duration | Description |
|-------|------|----------|-------------|
| 1 | Foundation | 1-2 days | Provider interface, crypto utils, schema migration |
| 2 | Wallet Module | 2-3 days | WalletService, blockchain monitor, deposit detection |
| 3 | Integration | 2-3 days | Update Orders, Balance, Users, Resolution to use provider |
| 4 | SDK & Docs | 1 day | Update SDK, CLI, documentation |
| 5 | Testing | 1-2 days | E2E tests on Stellar testnet |

---

## Phase 1: Foundation (Days 1-2)

### 1.1 Crypto Utilities
**File:** `apps/api/src/utils/crypto.ts`

- AES-256-GCM encrypt/decrypt functions
- Uses Node.js native `crypto` module
- Format: `iv:authTag:ciphertext` (all hex)
- Key from `WALLET_ENCRYPTION_KEY` env var

### 1.2 Database Migration
**File:** `packages/database/prisma/schema.prisma`

Add to User model:
```prisma
stellarPublicKey       String?   @unique
stellarSecretEncrypted String?
walletCreatedAt        DateTime?
```

Keep existing AirTM fields (nullable).

Run: `npx prisma migrate dev --name add_stellar_wallet_fields`

### 1.3 Payment Provider Interface
**File:** `apps/api/src/providers/payment/payment-provider.interface.ts`

Define the `PaymentProvider` interface (see [provider-interface.md](./provider-interface.md)).

### 1.4 Environment Variables
**File:** `.env.example`

Add:
```env
# Payment Provider (crypto or airtm)
PAYMENT_PROVIDER=crypto

# Wallet Encryption (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
WALLET_ENCRYPTION_KEY=

# Stellar (already partially present)
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_USDC_ASSET_CODE=USDC
STELLAR_USDC_ISSUER=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
```

### 1.5 Payment Provider Module
**Files:**
- `apps/api/src/providers/payment/payment-provider.module.ts`
- `apps/api/src/providers/payment/crypto-native.provider.ts`

Factory-based provider injection using `PAYMENT_PROVIDER` config.

---

## Phase 2: Wallet Module (Days 3-5)

### 2.1 Wallet Service
**File:** `apps/api/src/modules/wallet/wallet.service.ts`

Methods:
- `createWallet(userId)` -- Generate keypair, encrypt secret, save to DB, fund on testnet
- `getKeypair(userId)` -- Decrypt and return Keypair object
- `getBalance(userId)` -- Query Stellar Horizon for USDC balance
- `getPublicKey(userId)` -- Return public key from DB
- `signTransaction(userId, xdr)` -- Decrypt key, sign XDR, return signed XDR
- `sendPayment(userId, destination, amount)` -- Build + sign + submit USDC payment
- `accountExists(publicKey)` -- Check if Stellar account is active
- `setupTrustline(userId)` -- Add USDC trustline to new account

### 2.2 Wallet Controller
**File:** `apps/api/src/modules/wallet/wallet.controller.ts`

Endpoints:
- `GET /users/:id/wallet` -- Get wallet info (public key, balance)
- `GET /users/:id/wallet/deposit` -- Get deposit instructions (address + QR code data)
- `GET /users/:id/wallet/transactions` -- Transaction history from Horizon

### 2.3 Wallet Module
**File:** `apps/api/src/modules/wallet/wallet.module.ts`

NestJS module registering WalletService and WalletController.

### 2.4 Blockchain Monitor Service
**File:** `apps/api/src/modules/wallet/blockchain-monitor.service.ts`

- Implements `OnModuleInit` -- starts monitoring on app boot
- Uses Stellar Horizon streaming API (`server.payments().forAccount().stream()`)
- Detects incoming USDC payments
- Credits user balance in DB
- Emits `balance.credited` event
- Handles reconnection on stream errors
- Deduplicates using transaction hash (via processed payments table or similar)

### 2.5 Testnet Utilities
**File:** `apps/api/src/modules/wallet/testnet.utils.ts`

- `fundTestAccount(publicKey)` -- Friendbot XLM funding
- `setupTestTrustline(keypair)` -- Add USDC trustline on testnet

---

## Phase 3: Integration (Days 6-8)

### 3.1 Update Users Service
**File:** `apps/api/src/modules/users/users.service.ts`

Changes:
- On `createUser`: call `paymentProvider.initializeUser(user.id)` to auto-create wallet
- Keep `linkAirtm` method but make it conditional (only when `PAYMENT_PROVIDER=airtm`)
- Add `getWalletInfo(userId)` method

### 3.2 Update Balance Service
**File:** `apps/api/src/modules/balance/balance.service.ts`

Changes:
- `syncBalanceFromProvider`: Use `paymentProvider.getBalance()` instead of AirTM client
- `getBalanceWithProviderCheck`: Compare DB balance vs blockchain balance
- Remove direct AirtmUserClient dependency, use PaymentProvider instead

### 3.3 Update Orders Service
**File:** `apps/api/src/modules/orders/orders.service.ts`

Changes:
- `createEscrow`: Replace `buyer.airtmUserId` check with `paymentProvider.isUserReady()`
- `fundEscrow`: Use `paymentProvider.signEscrowTransaction()` for signing
- Remove all direct AirTM references

### 3.4 Update Resolution Service
**File:** `apps/api/src/modules/resolution/resolution.service.ts`

Changes:
- `confirmRelease`: Use PaymentProvider for crediting seller
- `confirmRefund`: Use PaymentProvider for crediting buyer

### 3.5 Update App Module
**File:** `apps/api/src/app.module.ts`

- Add `WalletModule`
- Add `PaymentProviderModule`
- Keep AirTM module loaded (for future use) but not injected as active provider

### 3.6 Update Scheduled Jobs
**File:** `apps/api/src/worker/` (reconciliation jobs)

- Reconciliation job: sync with blockchain instead of AirTM when `PAYMENT_PROVIDER=crypto`
- Escrow watcher: no changes needed (already uses Trustless Work)

---

## Phase 4: SDK & Docs (Day 9)

### 4.1 Update SDK
**File:** `packages/sdk/src/resources/`

- Add `wallet` resource: `getWalletInfo()`, `getDepositAddress()`, `getTransactions()`
- Keep `topups` and `withdrawals` resources (for AirTM mode) but document as "AirTM only"
- Update `users.create()` response type to include `stellarPublicKey`

### 4.2 Update CLI
**File:** `packages/cli/`

- Update installer prompts: add `WALLET_ENCRYPTION_KEY` generation
- Add `PAYMENT_PROVIDER` selection prompt
- Make AirTM credentials optional (only when `airtm` selected)

### 4.3 Update Documentation

Files to update:
- `docs/deployment/env-variables.md` -- Add new vars, mark AirTM as optional
- `docs/deployment/README.md` -- Add crypto-native setup instructions
- `docs/api/endpoints/users.md` -- Add wallet endpoints
- `docs/architecture/overview.md` -- Update pyramid diagram
- `docs/architecture/flow-of-funds.md` -- Add crypto-native flow
- `README.md` -- Update project description

---

## Phase 5: Testing (Day 10)

### 5.1 Unit Tests
- `WalletService` -- wallet creation, encryption, balance query
- `CryptoNativeProvider` -- all interface methods
- `BlockchainMonitorService` -- deposit detection, balance update
- `CryptoUtils` -- encrypt/decrypt round-trip

### 5.2 Integration Tests
- User creation → wallet auto-creation
- Deposit detection → balance credit
- Order → reserve → escrow fund → release (full flow with testnet)

### 5.3 Testnet E2E
- Create users on testnet
- Fund wallets via friendbot
- Execute full escrow cycle
- Verify balances on-chain match DB

---

## Implementation Order (Critical Path)

```
Phase 1.1 (crypto utils) ──┐
Phase 1.2 (schema)       ──┤── Can be parallel
Phase 1.3 (interface)     ──┘
         │
Phase 1.4 + 1.5 (env + module) ── Depends on 1.1-1.3
         │
Phase 2.1 (wallet service) ── Depends on 1.1, 1.2
         │
Phase 2.2 + 2.3 (controller + module) ── Depends on 2.1
Phase 2.4 (blockchain monitor) ── Depends on 2.1
         │
Phase 3.1-3.6 (integrations) ── Depends on 2.x
         │
Phase 4 (SDK + docs) ── Depends on 3.x
         │
Phase 5 (testing) ── Depends on all above
```

## Success Criteria

- [ ] User registration auto-creates Stellar wallet
- [ ] User can see their deposit address
- [ ] Deposits are detected and credited automatically
- [ ] Full escrow cycle works on testnet (create → fund → release)
- [ ] AirTM code untouched (still compiles, not active)
- [ ] `PAYMENT_PROVIDER=crypto` is the default
- [ ] All existing tests still pass
- [ ] No AirTM env vars required to boot the app in crypto mode
