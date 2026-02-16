# Wallet Endpoints

Wallet endpoints provide access to a user's crypto wallet (Stellar) for balance queries, deposit instructions, and transaction history. Available when `PAYMENT_PROVIDER=crypto`.

## Base Path

```
/api/v1/users/:userId/wallet
```

## Authentication

All endpoints require `ApiKeyGuard` + `ScopeGuard` with `read` scope.

```bash
Authorization: Bearer <API_KEY>
```

---

## GET /users/:userId/wallet

Returns wallet information including public key, type, and current balance.

### Response

```json
{
  "data": {
    "publicKey": "GABCDEF...",
    "type": "INVISIBLE",
    "provider": "STELLAR",
    "isActive": true,
    "isPrimary": true,
    "balance": {
      "usdc": "150.0000000",
      "xlm": "5.0000000"
    },
    "createdAt": "2026-02-16T00:00:00.000Z"
  }
}
```

### Errors

| Status | Code | Description |
|--------|------|-------------|
| 404 | `NOT_FOUND` | No active wallet found for user |
| 401 | `UNAUTHORIZED` | Invalid or missing API key |

---

## GET /users/:userId/wallet/deposit

Returns deposit instructions — the Stellar address where the user can receive USDC.

### Response

```json
{
  "data": {
    "provider": "crypto",
    "method": "stellar_address",
    "address": "GABCDEF...",
    "asset": {
      "code": "USDC",
      "issuer": "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
    },
    "network": "testnet",
    "instructions": "Send USDC to this Stellar address. Deposits are detected automatically within seconds."
  }
}
```

### Notes

- Deposits to this address are detected automatically by the `BlockchainMonitorService`
- Balance is credited within seconds of on-chain confirmation
- Only USDC deposits are auto-credited; other assets are ignored

---

## GET /users/:userId/wallet/transactions

Returns recent transaction history from Stellar Horizon.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 20 | Max transactions to return (max: 100) |

### Response

```json
{
  "data": [
    {
      "id": "12345",
      "type": "payment",
      "from": "GSENDER...",
      "to": "GABCDEF...",
      "amount": "50.00",
      "asset": "USDC:GA5ZSEJYB...",
      "createdAt": "2026-02-16T12:00:00Z",
      "hash": "abc123...",
      "successful": true
    }
  ]
}
```

### Transaction Types

| Type | Description |
|------|-------------|
| `payment` | USDC or XLM transfer |
| `create_account` | Initial account funding (testnet) |

---

## SDK Usage

```typescript
// Get wallet info
const wallet = await sdk.wallet.getInfo('usr_123');
console.log(wallet.balance.usdc); // '150.0000000'

// Get deposit address
const deposit = await sdk.wallet.getDepositAddress('usr_123');
console.log(deposit.address); // 'GABCDEF...'

// Get transactions
const txs = await sdk.wallet.getTransactions('usr_123', 10);
```
