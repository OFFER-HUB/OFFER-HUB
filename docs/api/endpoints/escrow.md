# Escrow Endpoints

## POST /orders/{order_id}/escrow

Creates an escrow contract on Stellar via Trustless Work and links it to the order.

The Orchestrator automatically:
1. Gets buyer and seller Stellar addresses from their invisible wallets
2. Deploys a Soroban smart contract via Trustless Work API
3. Signs the deploy transaction with the platform wallet
4. Submits the signed transaction to Stellar
5. Stores the `contractId` in the escrow record

### Prerequisites

- Order must be in `FUNDS_RESERVED` status
- Both buyer and seller must have wallets with USDC trustlines
- `PAYMENT_PROVIDER=crypto` must be set

### Request

```http
POST /api/v1/orders/ord_abc123/escrow
x-api-key: ohk_live_xxx
```

No request body required.

### Response

```json
{
    "data": {
        "success": true,
        "data": {
            "id": "ord_abc123",
            "status": "ESCROW_FUNDING",
            "escrow": {
                "id": "esc_xxx",
                "trustlessContractId": "CCBSP...",
                "status": "CREATED",
                "amount": "100.00"
            }
        }
    }
}
```

### Emitted Events

- `order.escrow_creating`

---

## POST /orders/{order_id}/escrow/fund

Funds the escrow using the buyer's reserved balance. The reserved balance is deducted and USDC is sent to the on-chain smart contract.

The Orchestrator automatically:
1. Deducts from buyer's reserved balance
2. Calls TW fund-escrow endpoint with USDC amount
3. Signs the funding transaction with the buyer's invisible wallet
4. Submits to Stellar
5. Transitions escrow to `FUNDED` and order to `IN_PROGRESS`

### Request

```http
POST /api/v1/orders/ord_abc123/escrow/fund
x-api-key: ohk_live_xxx
```

No request body required. Amount is taken from the order.

### Response

```json
{
    "data": {
        "success": true,
        "data": {
            "id": "ord_abc123",
            "status": "IN_PROGRESS",
            "escrow": {
                "id": "esc_xxx",
                "trustlessContractId": "CCBSP...",
                "status": "FUNDED",
                "amount": "100.00",
                "fundedAt": "2026-02-17T16:35:20.405Z"
            }
        }
    }
}
```

### Emitted Events

- `balance.released` (reserved balance deducted)
- `order.escrow_funded`

---

## GET /orders/{order_id}

Returns the order with escrow details (use the standard GET order endpoint).

### Request

```http
GET /api/v1/orders/ord_abc123
x-api-key: ohk_live_xxx
```

### Response

```json
{
    "data": {
        "success": true,
        "data": {
            "id": "ord_abc123",
            "status": "IN_PROGRESS",
            "escrow": {
                "id": "esc_xxx",
                "trustlessContractId": "CCBSP...",
                "status": "FUNDED",
                "amount": "100.00",
                "fundedAt": "2026-02-17T16:35:20.405Z",
                "releasedAt": null,
                "refundedAt": null
            },
            "milestones": []
        }
    }
}
```

---

## Important Notes

### Amount Format

The Orchestrator stores amounts as strings with 2 decimal places (e.g., `"100.00"`). When communicating with Trustless Work API, amounts are converted to USDC numbers (e.g., `100`). **Never send stroops to TW API.**

### Escrow States

```
CREATING -> CREATED -> FUNDED -> RELEASED / REFUNDED
```

### On-Chain Contract

The `trustlessContractId` (e.g., `CCBSP...`) is a Soroban smart contract address on Stellar. You can verify it on:
- Testnet: https://stellar.expert/explorer/testnet/contract/{contractId}
- Mainnet: https://stellar.expert/explorer/public/contract/{contractId}

### Error Scenarios

| Scenario | Error Code | Resolution |
|----------|------------|------------|
| Order not in FUNDS_RESERVED | `INVALID_STATE` | Reserve funds first |
| Escrow already exists | `ESCROW_ALREADY_EXISTS` | Cannot create duplicate |
| TW API unavailable | `PROVIDER_UNAVAILABLE` | Retry later |
| Insufficient USDC balance | `ESCROW_INSUFFICIENT_FUNDS` | Top up buyer wallet |
