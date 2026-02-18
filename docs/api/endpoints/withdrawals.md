# Withdrawals Endpoints

A withdrawal moves funds from a user's Orchestrator balance to an external destination (Stellar address or AirTM account). The path taken depends on `destinationType`:

| `destinationType` | Provider | Flow |
|-------------------|----------|------|
| `crypto` | Stellar (USDC) | **Synchronous** — completes in one call, `WITHDRAWAL_COMPLETED` immediately |
| `bank` | AirTM | **Asynchronous** — two-step (create → commit), final status via webhook |
| `airtm_balance` | AirTM | **Asynchronous** — two-step (create → commit), final status via webhook |

> **Note:** When `PAYMENT_PROVIDER=crypto`, use `destinationType: "crypto"`. AirTM types require the user to have a linked AirTM account.

---

## POST /withdrawals

Creates a new withdrawal for a user.

### Request

```http
POST /api/v1/withdrawals
Authorization: Bearer ohk_live_xxx
Content-Type: application/json
```

```json
{
  "userId": "usr_9DUCBnLofU9lLK88aIbfV3QEAcebHS8o",
  "amount": "5.00",
  "currency": "USD",
  "destinationType": "crypto",
  "destinationRef": "GDWXCMZTP6DVDBJY54NSNPH4CBOEUMVRMSY2XRG4VBSDYORMHJK4QOC3"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string | Yes | Internal OFFER-HUB user ID (`usr_...`) |
| `amount` | string | Yes | Decimal string with exactly 2 decimal places (e.g. `"5.00"`) |
| `currency` | string | No | Default: `"USD"` |
| `destinationType` | string | Yes | `"crypto"`, `"bank"`, or `"airtm_balance"` |
| `destinationRef` | string | Yes | Stellar address (crypto) or bank/AirTM account reference |
| `commit` | boolean | No | AirTM only — if `true`, creates and commits in one step. Default: `false` |
| `description` | string | No | Optional human-readable description |

### Response — Crypto path (`destinationType: "crypto"`)

```json
{
  "id": "wd_VSx3RjKlanuOOFa0i4FJXk4OhmtaAxZP",
  "amount": "5.00",
  "currency": "USD",
  "status": "WITHDRAWAL_COMPLETED",
  "destinationType": "crypto",
  "committed": true,
  "createdAt": "2026-02-18T17:04:46.736Z"
}
```

The withdrawal is **completed synchronously** — the Stellar transaction has already been submitted when this response is returned.

### Response — AirTM path (`destinationType: "bank"` or `"airtm_balance"`)

```json
{
  "id": "wd_...",
  "amount": "80.00",
  "currency": "USD",
  "status": "WITHDRAWAL_CREATED",
  "destinationType": "bank",
  "committed": false,
  "createdAt": "2026-01-12T10:00:00.000Z"
}
```

Requires a separate `POST /withdrawals/{id}/commit` call unless `commit: true` was passed.

### Withdrawal Statuses

| Status | Description |
|--------|-------------|
| `WITHDRAWAL_CREATED` | Record created, not yet committed (AirTM only) |
| `WITHDRAWAL_COMMITTED` | Committed to AirTM, awaiting processing |
| `WITHDRAWAL_PENDING` | AirTM is processing |
| `WITHDRAWAL_COMPLETED` | Funds delivered to destination |
| `WITHDRAWAL_FAILED` | Failed — balance rolled back automatically |

### Emitted Events

- `withdrawal.created`
- `withdrawal.completed` (crypto path — emitted immediately)
- `withdrawal.committed` (AirTM path)
- `withdrawal.pending` (AirTM path)
- `withdrawal.failed`

### Errors

| Code | HTTP | Cause |
|------|------|-------|
| `USER_NOT_FOUND` | 404 | User does not exist |
| `INSUFFICIENT_FUNDS` | 422 | User's available balance is less than `amount` |
| `AIRTM_USER_NOT_LINKED` | 422 | AirTM path requires linked AirTM account |
| `AIRTM_USER_INVALID` | 422 | AirTM user not KYC-verified or inactive |
| `VALIDATION_ERROR` | 400 | Invalid amount format or missing fields |

---

## GET /withdrawals

Lists withdrawals for a user.

### Request

```http
GET /api/v1/withdrawals?userId=usr_9DUCBnLofU9lLK88aIbfV3QEAcebHS8o&limit=20
Authorization: Bearer ohk_live_xxx
```

| Query Param | Type | Required | Description |
|-------------|------|----------|-------------|
| `userId` | string | Yes | Internal user ID |
| `limit` | number | No | Max records (default: 20, max: 100) |
| `cursor` | string | No | Pagination cursor (last `id` from previous page) |

### Response

```json
{
  "data": [
    {
      "id": "wd_VSx3RjKlanuOOFa0i4FJXk4OhmtaAxZP",
      "userId": "usr_9DUCBnLofU9lLK88aIbfV3QEAcebHS8o",
      "amount": "5.00",
      "currency": "USD",
      "status": "WITHDRAWAL_COMPLETED",
      "destinationType": "crypto",
      "destinationRef": "GCV24WNJYX6QC3RX7QBB5GYE66YRDJPU6A4RKMRS33CDDTMWLQDA7Y27",
      "createdAt": "2026-02-18T17:04:46.736Z",
      "updatedAt": "2026-02-18T17:04:54.000Z"
    }
  ],
  "hasMore": false
}
```

---

## GET /withdrawals/{id}

Gets a specific withdrawal by ID.

### Request

```http
GET /api/v1/withdrawals/wd_VSx3RjKlanuOOFa0i4FJXk4OhmtaAxZP?userId=usr_9DUCBnLofU9lLK88aIbfV3QEAcebHS8o
Authorization: Bearer ohk_live_xxx
```

### Response

Same shape as individual item in the list above.

---

## POST /withdrawals/{id}/commit

Commits a pending AirTM withdrawal. **Only applicable for `destinationType: "bank"` or `"airtm_balance"`** — crypto withdrawals complete in the creation step and cannot be committed.

### Request

```http
POST /api/v1/withdrawals/wd_abc123/commit?userId=usr_9DUCBnLofU9lLK88aIbfV3QEAcebHS8o
Authorization: Bearer ohk_live_xxx
```

### Response

```json
{ "id": "wd_...", "status": "WITHDRAWAL_COMMITTED" }
```

### Errors

| Code | HTTP | Cause |
|------|------|-------|
| `WITHDRAWAL_NOT_COMMITTABLE` | 409 | Status is not `WITHDRAWAL_CREATED` |
| `PROVIDER_ERROR` | 422 | No associated AirTM payout found |

---

## POST /withdrawals/{id}/refresh

Re-checks AirTM for the latest payout status. Use when a webhook was missed. **Only applicable for AirTM withdrawals** — crypto withdrawals are synchronous and have no webhook.

### Request

```http
POST /api/v1/withdrawals/wd_abc123/refresh?userId=usr_9DUCBnLofU9lLK88aIbfV3QEAcebHS8o
Authorization: Bearer ohk_live_xxx
```

### Response

```json
{ "id": "wd_...", "status": "WITHDRAWAL_PENDING" }
```

### Notes

- This endpoint is naturally idempotent.
- For crypto withdrawals, calling this returns the current record without making any external calls.
