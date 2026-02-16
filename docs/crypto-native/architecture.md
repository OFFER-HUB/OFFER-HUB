# Crypto-Native Architecture

**Status:** Planned
**Date:** 2026-02-16

---

## New Architecture Pyramid

```
┌─────────────────────────────────────┐
│         Marketplace UI              │  ← Built by marketplace developers
├─────────────────────────────────────┤
│         @offerhub/sdk               │  ← Our SDK (updated)
├─────────────────────────────────────┤
│      OFFER-HUB Orchestrator         │  ← Our API
├──────────────┬──────────────────────┤
│ PaymentProvider (interface)         │  ← NEW: Strategy Pattern
│  ├─ CryptoNativeProvider (default)  │  ← NEW: Build now
│  └─ AirtmProvider (future)          │  ← Existing code, adapt later
├──────────────┴──────────────────────┤
│       Trustless Work (Escrow)       │  ← Already integrated
├─────────────────────────────────────┤
│       Stellar Network               │  ← Blockchain layer
└─────────────────────────────────────┘
```

## What Changes vs Current Architecture

### Before (AirTM-dependent)
```
User registers → Links AirTM account → Top-up via AirTM → Balance in DB
Order created → Reserve from DB balance → Fund escrow → Release/Refund
Withdrawal → AirTM payout → Fiat to bank
```

### After (Crypto-native)
```
User registers → Invisible wallet auto-created → Deposit USDC to address → Balance on-chain
Order created → Reserve from wallet → Fund escrow → Release/Refund
Withdrawal → Send USDC to external wallet
```

## Component Changes

### New Components

| Component | Purpose |
|-----------|---------|
| `PaymentProviderInterface` | Abstract interface for fund operations |
| `CryptoNativeProvider` | Implements interface using Stellar wallets |
| `WalletModule` | Manages invisible wallets (create, encrypt, decrypt, balance) |
| `BlockchainMonitorService` | Watches Stellar for incoming deposits |
| `CryptoUtils` | AES-256-GCM encrypt/decrypt utilities |

### Modified Components

| Component | Change |
|-----------|--------|
| `UsersService` | Auto-create wallet on registration |
| `BalanceService` | Sync from blockchain instead of AirTM |
| `OrdersService` | Remove `airtmUserId` requirement, use wallet keypair |
| `ResolutionService` | Use wallet keypair for signing |
| `Prisma Schema` | Add Stellar fields to User model |
| `SDK` | Add wallet endpoints, make topup/withdrawal optional |
| `.env` | Add `WALLET_ENCRYPTION_KEY`, `PAYMENT_PROVIDER` |

### Untouched Components

Everything else stays the same:
- Auth system, API keys, scopes
- Rate limiting, idempotency, correlation IDs
- Audit logging, event system, SSE
- Dispute management
- Trustless Work integration (escrow client, webhook service)
- BullMQ worker infrastructure
- CLI tool

## Provider Selection Flow

```typescript
// config
PAYMENT_PROVIDER=crypto  // or "airtm"

// At bootstrap, NestJS injects the right provider:
@Module({
  providers: [
    {
      provide: 'PAYMENT_PROVIDER',
      useFactory: (config: ConfigService) => {
        const provider = config.get('PAYMENT_PROVIDER');
        if (provider === 'airtm') return new AirtmPaymentProvider(...);
        return new CryptoNativePaymentProvider(...);
      },
    },
  ],
})
```

## Database Schema Changes

### New: `Wallet` table (separate from User)

Following the same pattern as `Balance` (already separate from `User`), wallets get their own table. This supports multiple wallets per user (invisible now, external/Freighter later).

```prisma
enum WalletType {
  INVISIBLE  // Server-side keypair, we hold encrypted secret
  EXTERNAL   // User-connected wallet (Freighter, etc.) — future
}

enum WalletProvider {
  STELLAR
}

model Wallet {
  id                    String         @id @default(dbgenerated()) // wal_ prefix
  userId                String
  user                  User           @relation(fields: [userId], references: [id])
  type                  WalletType     @default(INVISIBLE)
  provider              WalletProvider @default(STELLAR)
  publicKey             String         @unique
  secretEncrypted       String?        // AES-256-GCM (null for EXTERNAL wallets)
  isPrimary             Boolean        @default(true)
  isActive              Boolean        @default(true)
  lastSyncAt            DateTime?
  createdAt             DateTime       @default(now())
  updatedAt             DateTime       @updatedAt

  @@index([userId])
  @@map("wallets")
}
```

User model: AirTM fields **kept**. `stellarAddress` removed (replaced by `Wallet.publicKey`). New `wallets Wallet[]` relation added.

## Fund Flow: Crypto-Native

### Deposit (replaces Top-up)
```
1. User requests deposit address
2. Backend returns user's stellarPublicKey
3. User sends USDC from any Stellar wallet (exchange, Freighter, etc.)
4. BlockchainMonitorService detects payment
5. Balance updated in DB
6. Event emitted: balance.credited
```

### Escrow (same concept, different signing)
```
1. Order created, funds reserved (DB)
2. Backend decrypts buyer's secret key
3. Backend creates escrow via Trustless Work
4. Backend signs funding transaction with buyer's keypair
5. Escrow funded on Stellar
6. On completion: backend signs release with signer keypair
7. Seller's wallet receives USDC on-chain
```

### Withdrawal (replaces AirTM Payout)
```
1. User provides external Stellar address
2. Backend decrypts user's secret key
3. Backend signs USDC payment transaction
4. USDC sent to external address
5. Balance updated in DB
6. Event emitted: balance.debited
```
