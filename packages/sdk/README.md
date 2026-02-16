# @offerhub/sdk

Official TypeScript SDK for the OfferHub Orchestrator API. Build marketplace escrow and payment flows with ease.

## Features

- 🔒 **Type-safe** - Full TypeScript support with comprehensive type definitions
- 🔄 **Automatic Retries** - Built-in retry logic with exponential backoff
- 🎯 **Error Handling** - Typed errors for better error handling and debugging
- 📦 **Resource-based** - Intuitive API organized by resource types
- 🔑 **Idempotency** - Built-in idempotency key support
- 🚀 **Modern** - Built on top of Ky HTTP client

## Installation

```bash
npm install @offerhub/sdk
```

## Quick Start

```typescript
import { OfferHubSDK } from '@offerhub/sdk';

// Initialize the SDK
const sdk = new OfferHubSDK({
  apiUrl: 'https://api.offerhub.com',
  apiKey: 'ohk_your_api_key_here'
});

// Create a user
const user = await sdk.users.create({
  externalUserId: 'user_123',
  email: 'user@example.com',
  type: 'BUYER'
});

// Create an order
const order = await sdk.orders.create({
  buyer_id: 'usr_buyer',
  seller_id: 'usr_seller',
  amount: '100.00',
  title: 'Website Development'
});
```

## Configuration

```typescript
const sdk = new OfferHubSDK({
  apiUrl: 'https://api.offerhub.com',    // Base API URL
  apiKey: 'ohk_your_api_key',            // Your API key
  timeout: 30000,                         // Request timeout (ms)
  retryAttempts: 3,                       // Max retry attempts
  headers: {                              // Custom headers
    'X-Custom-Header': 'value'
  }
});
```

## Resources

### Users

Manage users and Airtm account linking.

```typescript
// Create a new user
const user = await sdk.users.create({
  externalUserId: 'user_123',
  email: 'user@example.com',
  type: 'BUYER' // or 'SELLER', 'BOTH'
});

// Link Airtm account
const linkInfo = await sdk.users.linkAirtm('usr_123', {
  email: 'airtm@example.com'
});
```

### Balance

Manage user balances and fund operations.

```typescript
// Get user balance
const balance = await sdk.balance.get('usr_123');
console.log(balance.available, balance.reserved);

// Credit funds
await sdk.balance.credit('usr_123', {
  amount: '100.00',
  description: 'Top-up',
  reference: 'topup_abc'
});

// Reserve funds
await sdk.balance.reserve('usr_123', {
  amount: '50.00',
  reference: 'ord_123'
});

// Release funds to seller
await sdk.balance.release('usr_buyer', {
  amount: '50.00',
  reference: 'ord_123',
  recipientId: 'usr_seller'
});
```

### Orders

Manage the complete order lifecycle from creation to resolution.

```typescript
// Create an order with milestones
const order = await sdk.orders.create({
  buyer_id: 'usr_buyer',
  seller_id: 'usr_seller',
  amount: '100.00',
  title: 'Website Development',
  description: 'Build a landing page',
  milestones: [
    { ref: 'design', description: 'Design mockups', amount: '30.00' },
    { ref: 'dev', description: 'Development', amount: '70.00' }
  ]
});

// Reserve funds
await sdk.orders.reserve(order.id);

// Create escrow contract
await sdk.orders.createEscrow(order.id);

// Fund escrow (moves funds to blockchain)
await sdk.orders.fundEscrow(order.id);

// Complete a milestone
await sdk.orders.completeMilestone(order.id, 'design');

// Release funds to seller
await sdk.orders.release(order.id, 'Work completed successfully');

// Or request refund
await sdk.orders.refund(order.id, 'Work not delivered');

// List orders
const orders = await sdk.orders.list({
  buyer_id: 'usr_123',
  status: 'ESCROW_FUNDED',
  limit: 20
});
```

### Wallet (Crypto-Native Mode)

Access user wallets when using `PAYMENT_PROVIDER=crypto`. Wallets are created automatically on user registration.

```typescript
// Get wallet info (balance, public key, type)
const wallet = await sdk.wallet.getInfo('usr_123');
console.log(wallet.publicKey);     // 'GABCDEF...'
console.log(wallet.balance.usdc);  // '150.0000000'
console.log(wallet.balance.xlm);   // '5.0000000'

// Get deposit address — tell user where to send USDC
const deposit = await sdk.wallet.getDepositAddress('usr_123');
console.log(deposit.address);       // 'GABCDEF...'
console.log(deposit.asset.code);    // 'USDC'
console.log(deposit.network);       // 'testnet'
console.log(deposit.instructions);  // 'Send USDC to this Stellar address...'

// Get transaction history
const txs = await sdk.wallet.getTransactions('usr_123', 10);
txs.forEach(tx => {
  console.log(`${tx.type}: ${tx.amount} ${tx.asset} (${tx.hash})`);
});
```

### TopUps (AirTM Mode)

Handle top-up (payin) operations for adding funds to user balances.

```typescript
// Create a top-up
const topup = await sdk.topups.create({
  amount: '100.00',
  description: 'Add funds to account'
});

// Redirect user to confirmation URI
console.log(topup.confirmationUri);

// List user's top-ups
const topups = await sdk.topups.list({ limit: 10 });

// Get specific top-up
const topup = await sdk.topups.get('topup_abc123');

// Refresh status from provider
await sdk.topups.refresh('topup_abc123');

// Cancel pending top-up
await sdk.topups.cancel('topup_abc123');
```

### Withdrawals (AirTM Mode)

Handle withdrawal (payout) operations for moving funds out of the platform.

```typescript
// Create a two-step withdrawal (requires commit)
const withdrawal = await sdk.withdrawals.create({
  amount: '50.00',
  description: 'Cash out earnings'
});

// Commit when ready
await sdk.withdrawals.commit(withdrawal.id);

// Or create one-step withdrawal
const withdrawal = await sdk.withdrawals.create({
  amount: '50.00',
  commit: true
});

// List withdrawals
const withdrawals = await sdk.withdrawals.list({ limit: 10 });

// Refresh status
await sdk.withdrawals.refresh('wd_abc123');
```

### Disputes

Handle dispute creation and resolution.

```typescript
// Open a dispute
const dispute = await sdk.disputes.open('ord_abc123', {
  reason: 'Work not delivered as promised',
  evidence: 'Screenshots and chat logs'
});

// Get dispute details
const dispute = await sdk.disputes.get('dsp_abc123');

// Assign to support agent
await sdk.disputes.assign('dsp_abc123', {
  supportAgentId: 'agent_456'
});

// Resolve - full release to seller
await sdk.disputes.resolve('dsp_abc123', {
  resolution: 'RELEASE_TO_SELLER',
  notes: 'Evidence shows work was completed'
});

// Resolve - full refund to buyer
await sdk.disputes.resolve('dsp_abc123', {
  resolution: 'REFUND_TO_BUYER',
  notes: 'Work was not delivered'
});

// Resolve - split decision
await sdk.disputes.resolve('dsp_abc123', {
  resolution: 'SPLIT',
  sellerAmount: '60.00',
  buyerAmount: '40.00',
  notes: 'Partial work completed'
});
```

## Advanced Usage

### Idempotency

Use idempotency keys to safely retry requests without side effects:

```typescript
const idempotentSdk = sdk.withIdempotencyKey('unique-operation-123');

// This request can be safely retried
const order = await idempotentSdk.orders.create({
  buyer_id: 'usr_buyer',
  seller_id: 'usr_seller',
  amount: '100.00',
  title: 'Website Development'
});
```

### Custom Headers

Add custom headers for specific requests:

```typescript
const customSdk = sdk.withHeaders({
  'X-Request-ID': 'req_123',
  'X-User-Agent': 'MyApp/1.0'
});

await customSdk.orders.create({ ... });
```

## Error Handling

The SDK provides typed errors for better error handling:

```typescript
import {
  InsufficientFundsError,
  NotFoundError,
  ValidationError,
  AuthenticationError,
  OfferHubError
} from '@offerhub/sdk';

try {
  await sdk.orders.reserve('ord_123');
} catch (error) {
  if (error instanceof InsufficientFundsError) {
    console.log(`Need ${error.required}, but only have ${error.available}`);
  } else if (error instanceof NotFoundError) {
    console.log(`Resource ${error.resourceType} not found`);
  } else if (error instanceof ValidationError) {
    console.log('Validation errors:', error.errors);
  } else if (error instanceof AuthenticationError) {
    console.log('Invalid API key');
  } else if (error instanceof OfferHubError) {
    console.log(`Error ${error.code}: ${error.message}`);
  }
}
```

### Available Error Types

- `OfferHubError` - Base error class
- `AuthenticationError` - Invalid API key (401)
- `AuthorizationError` - Insufficient permissions (403)
- `NotFoundError` - Resource not found (404)
- `ValidationError` - Request validation failed (422)
- `InsufficientFundsError` - Not enough funds (402)
- `InvalidTransitionError` - Invalid state transition (409)
- `IdempotencyError` - Idempotency key conflict (409)
- `ProviderError` - External provider error (502/503)
- `RateLimitError` - Rate limit exceeded (429)
- `NetworkError` - Network or timeout error

## TypeScript Support

The SDK is written in TypeScript and provides full type definitions:

```typescript
import type {
  User,
  Order,
  Balance,
  TopUp,
  Withdrawal,
  Dispute,
  WalletInfo,
  DepositInfo,
  WalletTransaction,
  OrderStatus,
  UserType,
  // ... and many more
} from '@offerhub/sdk';
```

## Structure

```
src/
├── index.ts                # Main SDK export
├── offerhub-sdk.ts         # Main SDK class
├── client/
│   └── http-client.ts      # HTTP client with retry logic
├── resources/
│   ├── users.ts            # Users resource
│   ├── balance.ts          # Balance resource
│   ├── orders.ts           # Orders resource
│   ├── topups.ts           # TopUps resource
│   ├── withdrawals.ts      # Withdrawals resource
│   ├── disputes.ts         # Disputes resource
│   └── wallet.ts           # Wallet resource (crypto-native)
├── types/
│   └── index.ts            # Type definitions
└── errors/
    └── index.ts            # Error classes
```

## Documentation

- [SDK Integration Guide](../../docs/sdk/integration-guide.md)
- [API Documentation](../../docs/api/README.md)
- [Error Reference](../../docs/api/errors.md)
- [Development Guidelines](../../docs/AI.md)

## License

MIT

## Support

For issues and questions:
- [GitHub Issues](https://github.com/OFFER-HUB/OFFER-HUB/issues)
- [Documentation](https://docs.offerhub.com)
