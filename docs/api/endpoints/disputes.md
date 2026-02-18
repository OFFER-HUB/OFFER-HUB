# Disputes Endpoints

> **Note:** The dispute endpoint is under `/resolution/`, not `/disputes/`. Disputes are opened as part of the resolution flow.

## POST /orders/{orderId}/resolution/dispute

Opens a dispute for an order and freezes automated flows. Both buyer and seller can open a dispute.

> **Important:** `openedBy` must be `"BUYER"` or `"SELLER"` (uppercase enum) — NOT a user ID.

### Request

```http
POST /api/v1/orders/ord_VxaMOdTTsNKjDEhfagkI0/resolution/dispute
Authorization: Bearer ohk_live_xxx
Content-Type: application/json
```

```json
{
  "openedBy": "BUYER",
  "reason": "QUALITY_ISSUE",
  "evidence": ["https://.../img1.png"]
}
```

| Field | Type | Required | Values |
|-------|------|----------|--------|
| `openedBy` | string (enum) | Yes | `"BUYER"` or `"SELLER"` |
| `reason` | string (enum) | Yes | `"NOT_DELIVERED"`, `"QUALITY_ISSUE"`, `"OTHER"` |
| `evidence` | string[] | No | Array of URLs |

### Response

```json
{
  "success": true,
  "data": {
    "id": "dsp_...",
    "orderId": "ord_VxaMOdTTsNKjDEhfagkI0",
    "status": "OPEN",
    "openedBy": "BUYER",
    "reason": "QUALITY_ISSUE"
  }
}
```

### Emitted Events

- `dispute.opened`

---

## GET /disputes/{id}

Gets dispute details by ID.

### Request

```http
GET /api/v1/disputes/dsp_Abc123...
Authorization: Bearer ohk_live_xxx
```

### Response

```json
{
  "success": true,
  "data": {
    "id": "dsp_Abc123...",
    "orderId": "ord_VxaMOdTTsNKjDEhfagkI0",
    "status": "UNDER_REVIEW",
    "openedBy": "BUYER",
    "reason": "QUALITY_ISSUE",
    "resolutionDecision": null,
    "createdAt": "2026-02-18T10:00:00.000Z",
    "updatedAt": "2026-02-18T10:05:00.000Z"
  }
}
```

### Dispute Statuses

| Status | Description |
|--------|-------------|
| `OPEN` | Dispute filed, awaiting assignment |
| `UNDER_REVIEW` | Assigned to a support agent |
| `RESOLVED` | Decision made, funds distributed |

---

## POST /disputes/{id}/assign

Assigns a dispute to a support agent (internal/admin use).

### Request

```http
POST /api/v1/disputes/dsp_Abc123.../assign
Authorization: Bearer ohk_live_xxx
Content-Type: application/json
```

```json
{
  "agentId": "usr_support_agent_id"
}
```

### Response

```json
{
  "success": true,
  "data": {
    "id": "dsp_Abc123...",
    "status": "UNDER_REVIEW"
  }
}
```

---

## POST /disputes/{id}/resolve

Resolves a dispute with a decision. Executes on-chain fund distribution via Trustless Work.

### Request

```http
POST /api/v1/disputes/dsp_Abc123.../resolve
Authorization: Bearer ohk_live_xxx
Content-Type: application/json
```

**FULL_RELEASE** (seller wins — all funds go to seller):
```json
{ "decision": "FULL_RELEASE" }
```

**FULL_REFUND** (buyer wins — all funds returned to buyer):
```json
{ "decision": "FULL_REFUND" }
```

**SPLIT** (partial resolution):
```json
{
  "decision": "SPLIT",
  "releaseAmount": "80.00",
  "refundAmount": "20.00",
  "note": "80% delivered, 20% refunded"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `decision` | string (enum) | Yes | `"FULL_RELEASE"`, `"FULL_REFUND"`, or `"SPLIT"` |
| `releaseAmount` | string | SPLIT only | Amount to seller (e.g. `"80.00"`) |
| `refundAmount` | string | SPLIT only | Amount to buyer (e.g. `"20.00"`) |
| `note` | string | No | Internal note for the decision |

> **Note:** For `SPLIT`, `releaseAmount + refundAmount` must equal the escrow total.

### Response

```json
{
  "success": true,
  "data": {
    "id": "dsp_Abc123...",
    "status": "RESOLVED",
    "resolutionDecision": "SPLIT"
  }
}
```

### Emitted Events

- `dispute.resolved`
- `order.closed`
- `balance.credited` (seller, if FULL_RELEASE or SPLIT)
- `balance.credited` (buyer, if FULL_REFUND or SPLIT)

### Errors

| Code | HTTP | Cause |
|------|------|-------|
| `DISPUTE_NOT_FOUND` | 404 | Dispute does not exist |
| `INVALID_STATE_TRANSITION` | 409 | Dispute already resolved |
| `VALIDATION_ERROR` | 400 | Invalid decision or missing SPLIT amounts |
