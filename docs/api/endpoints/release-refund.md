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

Refunds escrow funds to the buyer. In crypto-native mode, this executes a **2-step on-chain process** since Trustless Work has no direct refund endpoint:

1. **Dispute escrow** -- Buyer disputes the contract (signed by buyer's wallet)
2. **Resolve dispute** -- Platform resolves with 100% distribution back to buyer (signed by platform wallet as `disputeResolver`)

> **Why 2 steps?** Trustless Work smart contracts enforce that `disputeResolver` cannot be the same address as the disputer. The Orchestrator uses a dedicated platform wallet (`PLATFORM_USER_ID`) as `disputeResolver`, separate from buyer and seller.

### Request

```http
POST /api/v1/orders/ord_abc123/resolution/refund
Authorization: Bearer ohk_live_xxx
Content-Type: application/json
```

```json
{
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

### What Happens Internally

```
1. Validate order is IN_PROGRESS with FUNDED escrow
2. Get buyer and platform Stellar addresses
3. Call TW: dispute-escrow (buyer signs XDR)
4. Call TW: resolve-dispute with 100% to buyer (platform signs XDR as disputeResolver)
5. Credit buyer's internal balance
6. Transition order: REFUND_REQUESTED -> CLOSED
7. Emit events: order.refund_requested, order.refunded, order.closed
```

### Signer Roles (Refund)

| Transaction | Signer | TW Role |
|-------------|--------|---------|
| dispute-escrow | Buyer | approver (the disputer) |
| resolve-dispute | Platform | disputeResolver |

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

## POST /disputes/{disputeId}/resolve (SPLIT Decision)

Resolves a dispute by splitting escrow funds between buyer and seller. Uses the same 2-step on-chain process as refund, but with **distributions to both parties** instead of 100% to one.

1. **Dispute escrow** -- Buyer disputes the contract (signed by buyer's wallet)
2. **Resolve dispute with distributions** -- Platform resolves with split amounts to buyer AND seller (signed by platform wallet as `disputeResolver`)

### Request

```http
POST /api/v1/disputes/dsp_xxx/resolve
x-api-key: ohk_live_xxx
Content-Type: application/json
```

```json
{
    "decision": "SPLIT",
    "release_amount": "6.00",
    "refund_amount": "4.00",
    "note": "Partial delivery — 60% work completed"
}
```

> **Validation:** `release_amount + refund_amount` must equal the order's total `amount`.

### Response

```json
{
    "data": {
        "success": true,
        "data": {
            "id": "dsp_xxx",
            "status": "RESOLVED",
            "resolutionDecision": "SPLIT",
            "order": {
                "id": "ord_xxx",
                "status": "CLOSED"
            },
            "escrow": {
                "status": "RELEASED",
                "releasedAt": "2026-02-17T19:19:39.605Z"
            }
        }
    }
}
```

### What Happens Internally

```
1. Validate dispute is UNDER_REVIEW with IN_PROGRESS order
2. Validate release_amount + refund_amount == order.amount
3. Get buyer, seller, and platform Stellar addresses
4. Call TW: dispute-escrow (buyer signs XDR)
5. Call TW: resolve-dispute with distributions (platform signs XDR)
   → distributions: [{seller, releaseAmount}, {buyer, refundAmount}]
6. Credit seller's internal balance with release_amount
7. Credit buyer's internal balance with refund_amount
8. Transition: dispute RESOLVED, order CLOSED, escrow RELEASED
9. Emit event: DISPUTE_RESOLVED (decision: SPLIT)
```

### Signer Roles (SPLIT)

| Transaction | Signer | TW Role |
|-------------|--------|---------|
| dispute-escrow | Buyer | approver (the disputer) |
| resolve-dispute | Platform | disputeResolver |

### TW API Payload (resolve-dispute with distributions)

```json
{
    "contractId": "CAKRHV...",
    "disputeResolver": "GDGLXL...",
    "distributions": [
        { "address": "GDWXCM...", "amount": 6 },
        { "address": "GCV24W...", "amount": 4 }
    ]
}
```

> **Note:** Amounts are in USDC (not stroops). TW converts internally.

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
