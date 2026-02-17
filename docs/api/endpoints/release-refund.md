# Release and Refund Endpoints

## POST /orders/{orderId}/resolution/release

Releases escrow funds to the seller. In crypto-native mode, this executes 3 on-chain Stellar transactions automatically:

1. **changeMilestoneStatus** -- Seller marks work as complete (signed by seller's wallet)
2. **approveMilestone** -- Buyer approves the milestone (signed by buyer's wallet)
3. **releaseFunds** -- Buyer releases USDC to seller (signed by buyer's wallet)

After successful release, the seller's internal balance is credited and the order is closed.

### Request

```http
POST /api/v1/orders/ord_abc123/resolution/release
x-api-key: ohk_live_xxx
Content-Type: application/json
```

```json
{
    "requestedBy": "usr_buyer123",
    "reason": "Work completed successfully"
}
```

### Response

```json
{
    "data": {
        "success": true,
        "data": {
            "id": "ord_abc123",
            "status": "CLOSED",
            "escrow": {
                "trustlessContractId": "CCBSP...",
                "status": "FUNDED"
            }
        }
    }
}
```

### What Happens Internally

```
1. Validate order is IN_PROGRESS with FUNDED escrow
2. Get buyer and seller Stellar addresses
3. Call TW: changeMilestoneStatus (seller signs XDR)
4. Call TW: approveMilestone (buyer signs XDR)
5. Call TW: releaseFunds (buyer signs XDR)
6. Credit seller's internal balance
7. Transition order: RELEASE_REQUESTED -> CLOSED
8. Emit events: order.release_requested, order.released, order.closed
```

### Emitted Events

- `order.release_requested`
- `order.released`
- `balance.released`
- `balance.credited` (seller)
- `order.closed`

---

## POST /orders/{orderId}/resolution/refund

Refunds escrow funds to the buyer. In crypto-native mode, this calls the TW refund endpoint and signs with the buyer's wallet.

### Request

```http
POST /api/v1/orders/ord_abc123/resolution/refund
x-api-key: ohk_live_xxx
Content-Type: application/json
```

```json
{
    "requestedBy": "usr_buyer123",
    "reason": "Service not delivered"
}
```

### Response

```json
{
    "data": {
        "success": true,
        "data": {
            "id": "ord_abc123",
            "status": "CLOSED"
        }
    }
}
```

### Emitted Events

- `order.refund_requested`
- `order.refunded`
- `balance.credited` (buyer)
- `order.closed`

---

## POST /orders/{orderId}/resolution/dispute

Opens a dispute, freezing the escrow until resolved.

### Request

```http
POST /api/v1/orders/ord_abc123/resolution/dispute
x-api-key: ohk_live_xxx
Content-Type: application/json
```

```json
{
    "filedBy": "usr_buyer123",
    "reason": "quality_issue",
    "description": "The delivered work does not match the requirements"
}
```

### Response

```json
{
    "data": {
        "success": true,
        "data": {
            "id": "ord_abc123",
            "status": "DISPUTED",
            "dispute": {
                "id": "dsp_xxx",
                "status": "OPEN"
            }
        }
    }
}
```

---

## Important Notes

### Crypto-Native Release Process

The release endpoint triggers **3 separate Stellar transactions** (each taking ~5-8 seconds). Total release time is approximately 15-25 seconds. The marketplace should handle this with appropriate loading states.

### Signer Roles

| Transaction | Signer | TW Role |
|-------------|--------|---------|
| changeMilestoneStatus | Seller | serviceProvider |
| approveMilestone | Buyer | approver |
| releaseFunds | Buyer | releaseSigner |

### Error Scenarios

| Scenario | Error | Resolution |
|----------|-------|------------|
| Order not IN_PROGRESS | `INVALID_STATE` | Order must be funded first |
| TW milestone error | `PROVIDER_ERROR` | Check TW API logs |
| TW release error | `PROVIDER_ERROR` | Verify escrow state on-chain |
| Amount mismatch | `PROVIDER_ERROR` | Ensure deploy and fund used same USDC amount |
