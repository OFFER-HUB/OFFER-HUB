# Trustless Work Integration

Complete integration with Trustless Work as the escrow provider for non-custodial fund management on the Stellar blockchain.

## Overview

This module provides:
- **Escrow Contract Management:** Create, fund, release, and refund escrow contracts via Trustless Work API
- **Invisible Wallet Signing:** Server-side transaction signing with AES-256-GCM encrypted Stellar keypairs
- **Milestone Workflow:** Change milestone status + approve milestone before releasing funds
- **Stellar Wallet Queries:** Query on-chain USDC balances via Horizon API
- **Balance Projection:** Calculate total balance across wallets and escrow contracts

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Orchestrator  │────▶│  Trustless Work │────▶│    Stellar      │
│   (This API)    │◀────│  (Escrow API)   │◀────│   Blockchain    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                                              │
        │  Signs XDR with                              │
        │  invisible wallets                           │
        └──────────────────────────────────────────────┘
```

**Non-Custodial Design:** The Orchestrator holds encrypted private keys for invisible wallets. All funds are managed through Trustless Work's smart contracts on Stellar. The user never needs to interact with a browser wallet (Freighter/Albedo).

**Key Principle:** Every write operation to Trustless Work returns an **unsigned XDR transaction**. The Orchestrator signs it server-side using the user's invisible wallet, then submits via `POST /helper/send-transaction`.

## Module Structure

```
apps/api/src/providers/trustless-work/
├── trustless-work.module.ts          # NestJS module definition
├── trustless-work.config.ts          # Configuration with validation
├── clients/
│   ├── escrow.client.ts              # Escrow operations (create, fund, milestone, release, refund)
│   └── wallet.client.ts              # Stellar balance queries via Horizon
├── services/
│   ├── webhook.service.ts            # Webhook processing (future use)
│   └── balance-projection.service.ts # Balance calculation logic
├── dto/
│   ├── escrow.dto.ts                 # Escrow creation DTOs
│   ├── release.dto.ts                # Release operation DTOs
│   ├── refund.dto.ts                 # Refund operation DTOs
│   ├── dispute-resolution.dto.ts     # Dispute split DTOs
│   └── webhook.dto.ts                # Webhook event DTOs
└── types/
    └── trustless-work.types.ts       # API response types and mappings
```

## Configuration

### Environment Variables

```bash
# Trustless Work API
TRUSTLESS_API_KEY=your_api_key_here        # Get from https://dapp.trustlesswork.com
TRUSTLESS_API_URL=https://dev.api.trustlesswork.com  # Testnet
# TRUSTLESS_API_URL=https://api.trustlesswork.com    # Mainnet (after audit)
TRUSTLESS_WEBHOOK_SECRET=tw_whsec_your_webhook_secret_here
TRUSTLESS_TIMEOUT_MS=60000

# Stellar Network
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_USDC_ASSET_CODE=USDC
STELLAR_USDC_ISSUER=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5  # Testnet

# Payment Provider (must be "crypto" for Trustless Work)
PAYMENT_PROVIDER=crypto
WALLET_ENCRYPTION_KEY=your_32_byte_hex_key  # For AES-256-GCM wallet encryption
```

### Key Configuration Notes

1. **API URL**:
   - Testnet: `https://dev.api.trustlesswork.com`
   - Mainnet: `https://api.trustlesswork.com` (post-audit)

2. **Amounts**: All amounts sent to TW API are in **USDC** (human-readable numbers, e.g., `1` for 1 USDC). TW converts to stroops internally. **Never send stroops to TW API.**

3. **Platform Fee**: Must be > 0 (percentage, not fixed amount). Example: `5` = 5% fee.

4. **USDC Trustlines**: All wallet addresses in `roles` MUST have USDC trustline configured on Stellar.

5. **Invisible Wallets**: The `platformAddress` (signer) must be a wallet the Orchestrator controls -- used to sign the deploy transaction.

## Complete Escrow Lifecycle

This is the **verified end-to-end flow** tested on Stellar Testnet (Feb 2026).

### Flow Diagram

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│  Deploy  │──▶│   Fund   │──▶│ Milestone│──▶│ Approve  │──▶│ Release  │──▶│  CLOSED  │
│ (signer) │   │ (buyer)  │   │ (seller) │   │ (buyer)  │   │ (buyer)  │   │          │
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
```

### Step 1: Deploy Escrow Contract

**Endpoint:** `POST /deployer/single-release` (or `multi-release` for multiple milestones)

**Who signs:** Platform wallet (signer)

```typescript
const payload = {
    signer: platformAddress,         // Platform wallet (signs deploy tx)
    engagementId: 'ord_abc123',      // Order ID
    title: 'Escrow for order',
    description: 'Service escrow',
    roles: {
        approver: buyerAddress,       // Buyer approves milestones
        serviceProvider: sellerAddress,// Seller provides service
        platformAddress: platformAddress,
        releaseSigner: buyerAddress,   // Buyer releases funds
        disputeResolver: buyerAddress, // Buyer resolves disputes
        receiver: sellerAddress,       // Seller receives funds
    },
    amount: 1,                        // USDC amount (NOT stroops!)
    platformFee: 5,                   // 5% platform fee
    milestones: [{
        description: 'Complete delivery of service',
    }],
    trustline: {
        address: 'GBBD47IF6LWK...',  // USDC issuer
        symbol: 'USDC',
    },
};

// Returns: { unsignedTransaction: 'AAAA...' }
// Sign with platform wallet -> sendTransaction -> returns { contractId: 'C...' }
```

### Step 2: Fund Escrow

**Endpoint:** `POST /escrow/single-release/fund-escrow`

**Who signs:** Buyer wallet

```typescript
const payload = {
    contractId: 'CCBSP...',
    amount: 1,                        // USDC amount (must match deploy amount)
    signer: buyerAddress,
};

// Returns: { unsignedTransaction: 'AAAA...' }
// Sign with buyer wallet -> sendTransaction
```

### Step 3: Change Milestone Status (Mark Complete)

**Endpoint:** `POST /escrow/single-release/change-milestone-status`

**Who signs:** Seller wallet (serviceProvider role)

```typescript
const payload = {
    contractId: 'CCBSP...',
    milestoneIndex: '0',              // First milestone
    newStatus: 'completed',
    serviceProvider: sellerAddress,    // Required
};

// Returns: { unsignedTransaction: 'AAAA...' }
// Sign with SELLER wallet -> sendTransaction
```

### Step 4: Approve Milestone

**Endpoint:** `POST /escrow/single-release/approve-milestone`

**Who signs:** Buyer wallet (approver role)

```typescript
const payload = {
    contractId: 'CCBSP...',
    milestoneIndex: '0',
    approver: buyerAddress,           // Required
};

// Returns: { unsignedTransaction: 'AAAA...' }
// Sign with BUYER wallet -> sendTransaction
```

### Step 5: Release Funds

**Endpoint:** `POST /escrow/single-release/release-funds`

**Who signs:** Buyer wallet (releaseSigner role)

```typescript
const payload = {
    contractId: 'CCBSP...',
    releaseSigner: buyerAddress,      // Required
};

// Returns: { unsignedTransaction: 'AAAA...' }
// Sign with BUYER wallet -> sendTransaction
// Funds released to seller on Stellar blockchain
```

### Step 6 (Alternative): Refund

**Endpoint:** `POST /escrow/single-release/refund`

```typescript
const payload = {
    contractId: 'CCBSP...',
};

// Returns: { unsignedTransaction: 'AAAA...' }
// Sign -> sendTransaction -> Funds returned to buyer
```

## Transaction Signing Pattern

Every TW write operation follows this pattern:

```typescript
// 1. Call TW API -> get unsigned XDR
const result = await escrowClient.someOperation(params);

// 2. Sign with the correct user's invisible wallet
const signedXdr = await paymentProvider.signEscrowTransaction(
    userId,                           // Owner of the signing wallet
    result.unsignedTransaction,       // Unsigned XDR from TW
);

// 3. Submit signed transaction to Stellar
const txResult = await escrowClient.sendTransaction(signedXdr);
// txResult: { status: 'SUCCESS', contractId?: 'C...' }
```

**Critical:** Each step requires a specific signer:

| Step | Who Signs | Role |
|------|-----------|------|
| Deploy | Platform | signer |
| Fund | Buyer | signer (buyer wallet) |
| Change Milestone | **Seller** | serviceProvider |
| Approve Milestone | Buyer | approver |
| Release Funds | Buyer | releaseSigner |
| Refund | Buyer | (any authorized) |

## Amount Handling

**Important:** TW API expects amounts in **USDC** (human-readable), not stroops.

| Context | Format | Example |
|---------|--------|---------|
| Orchestrator internal | 2 decimal string | `"1.00"` |
| TW API deploy/fund | Number (USDC) | `1` |
| Stellar on-chain | Stroops (integer) | `10000000` |

```typescript
// Orchestrator -> TW API
const amount = parseFloat("1.00"); // -> 1

// Orchestrator internal conversions (for display/storage only)
import { orchestratorToStellar, toStroops } from '@offerhub/shared';
orchestratorToStellar('1.00');  // -> '1.000000'
toStroops('1.000000');          // -> '1000000'
```

## Error Handling

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `PROVIDER_UNAVAILABLE` | 503 | Trustless Work temporarily unavailable |
| `PROVIDER_TIMEOUT` | 504 | API request timeout (default 60s) |
| `ESCROW_NOT_FOUND` | 404 | Contract doesn't exist |
| `ESCROW_ALREADY_FUNDED` | 409 | Attempting to fund funded contract |
| `ESCROW_INSUFFICIENT_FUNDS` | 422 | Operation amount exceeds available |
| `ESCROW_INVALID_STATE` | 409 | Operation not allowed in current state |
| `PROVIDER_ERROR` | 500 | General TW API error |

### Common TW API Errors

| TW Error Message | Cause | Solution |
|-----------------|-------|----------|
| `"The escrow must be completed to release earnings"` | Milestone not completed/approved before release | Call changeMilestoneStatus + approveMilestone first |
| `"The escrow balance must be equal to the amount of earnings"` | Amount mismatch between deploy and fund | Ensure both use USDC format (not stroops) |
| `"serviceProvider required"` | Missing seller address in milestone change | Pass seller's Stellar address as `serviceProvider` |
| `"approver required"` | Missing buyer address in milestone approval | Pass buyer's Stellar address as `approver` |
| `"releaseSigner required"` | Missing buyer address in release | Pass buyer's Stellar address as `releaseSigner` |

## Orchestrator Integration

### How the Resolution Service Uses This Module

```typescript
// In ResolutionService.requestRelease():

// 1. Get both user addresses
const buyerAddress = (await paymentProvider.getDepositInfo(order.buyerId)).address;
const sellerAddress = (await paymentProvider.getDepositInfo(order.sellerId)).address;

// 2. Complete milestone (seller signs)
const milestoneResult = await escrowClient.changeMilestoneStatus(
    contractId, '0', 'completed', sellerAddress, escrowType,
);
const signedMilestone = await paymentProvider.signEscrowTransaction(
    order.sellerId, milestoneResult.unsignedTransaction,
);
await escrowClient.sendTransaction(signedMilestone);

// 3. Approve milestone (buyer signs)
const approveResult = await escrowClient.approveMilestone(
    contractId, '0', buyerAddress, escrowType,
);
const signedApproval = await paymentProvider.signEscrowTransaction(
    order.buyerId, approveResult.unsignedTransaction,
);
await escrowClient.sendTransaction(signedApproval);

// 4. Release funds (buyer signs)
const releaseResult = await escrowClient.releaseEscrow(
    contractId, buyerAddress, escrowType,
);
const signedRelease = await paymentProvider.signEscrowTransaction(
    order.buyerId, releaseResult.unsignedTransaction,
);
await escrowClient.sendTransaction(signedRelease);

// 5. Update internal state -> order CLOSED, seller balance credited
```

## Webhook Processing (Future)

The webhook service is prepared for future use when TW implements real-time notifications. Currently, the Orchestrator handles all state transitions synchronously after each TW API call.

```typescript
// Future webhook endpoint: POST /webhooks/trustless-work
// Signature verification: HMAC-SHA256 with TRUSTLESS_WEBHOOK_SECRET
// Events: escrow.funded, escrow.released, escrow.refunded, etc.
```

## Production Checklist

- [ ] Set `STELLAR_NETWORK=mainnet`
- [ ] Update `STELLAR_USDC_ISSUER` to mainnet issuer (Circle)
- [ ] Configure production `TRUSTLESS_API_KEY` from https://dapp.trustlesswork.com
- [ ] Update `TRUSTLESS_API_URL` to `https://api.trustlesswork.com`
- [ ] Ensure all platform wallet addresses have USDC trustline on mainnet
- [ ] Configure `WALLET_ENCRYPTION_KEY` (32-byte hex, stored securely)
- [ ] Set up monitoring for Stellar network errors and TW API failures
- [ ] Test complete escrow lifecycle on testnet before mainnet deployment
- [ ] Configure rate limiting for TW API calls (60s timeout)

## Related Documentation

- [Escrow Lifecycle](../../../../docs/crypto-native/escrow-lifecycle.md)
- [Flow of Funds](../../../../docs/architecture/flow-of-funds.md)
- [Crypto-Native Architecture](../../../../docs/crypto-native/architecture.md)
- [Wallet Strategy](../../../../docs/crypto-native/wallet-strategy.md)
- [Escrow API Endpoints](../../../../docs/api/endpoints/escrow.md)
