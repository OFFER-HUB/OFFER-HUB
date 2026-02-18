# Top-ups / Deposit Endpoints

> **Provider-dependent behavior:** How a buyer adds funds depends on `PAYMENT_PROVIDER`:
>
> | `PAYMENT_PROVIDER` | Deposit method | Endpoints used |
> |---------------------|----------------|----------------|
> | `crypto` | Send USDC to user's Stellar address | `GET /users/:userId/wallet/deposit` → send on-chain |
> | `airtm` | AirTM payin flow | `POST /topups` → redirect user → webhook confirms |
>
> See also: [Wallet Endpoints](./wallet.md) for the crypto deposit flow.

---

## Crypto-Native Deposit Flow (`PAYMENT_PROVIDER=crypto`)

When using the crypto provider, there is **no `/topups` call**. The buyer sends USDC directly to their invisible Stellar wallet address:

### Step 1 — Get the deposit address

```http
GET /api/v1/users/{userId}/wallet/deposit
Authorization: Bearer ohk_live_xxx
```

Response:
```json
{
  "data": {
    "provider": "crypto",
    "method": "stellar_address",
    "address": "GCV24WNJYX6QC3RX7QBB5GYE66YRDJPU6A4RKMRS33CDDTMWLQDA7Y27",
    "asset": {
      "code": "USDC",
      "issuer": "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
    },
    "network": "testnet",
    "instructions": "Send USDC to this Stellar address. Deposits are detected automatically within seconds."
  }
}
```

### Step 2 — User sends USDC on Stellar

The marketplace displays the address (or QR code) to the buyer. The buyer sends USDC from any Stellar wallet.

### Step 3 — Automatic credit (no action needed)

`BlockchainMonitorService` polls Stellar Horizon every few seconds for each monitored wallet. When a USDC payment is detected, the user's `available` balance is credited automatically and a `balance.credited` event is emitted.

**No webhook, no polling, no additional API calls required from the marketplace.**

---

## AirTM Top-up Flow (`PAYMENT_PROVIDER=airtm`)

## POST /topups

Starts a top-up and returns the confirmation URI.

### Request

```http
POST /api/v1/topups
Authorization: Bearer ohk_live_xxx
Idempotency-Key: {uuid}
Content-Type: application/json
```

```json
{
  "user_id": "usr_...",
  "amount": "50.00",
  "currency": "USD",
  "return_url": "https://marketplace.com/wallet/topup/success",
  "cancel_url": "https://marketplace.com/wallet/topup/cancel",
  "metadata": { "source": "wallet" }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | string | Yes | OFFER-HUB user ID |
| `amount` | string | Yes | Decimal string with 2 decimals |
| `currency` | string | Yes | `USD` |
| `return_url` | string | Yes | HTTPS URL for success |
| `cancel_url` | string | Yes | HTTPS URL for cancel |
| `metadata` | object | No | Free-form metadata |

### Response

```json
{
  "id": "topup_...",
  "status": "TOPUP_AWAITING_USER_CONFIRMATION",
  "amount": "50.00",
  "currency": "USD",
  "confirmation_uri": "https://.../confirm",
  "cancel_uri": "https://.../cancel",
  "created_at": "2026-01-12T10:00:00.000Z"
}
```

### Emitted Events

- `topup.created`
- `topup.confirmation_required`

### Errors

| Code | HTTP | Cause |
|------|------|-------|
| `USER_NOT_FOUND` | 404 | User does not exist |
| `AIRTM_USER_NOT_LINKED` | 422 | User not linked to Airtm |
| `VALIDATION_ERROR` | 400 | Invalid request |

---

## GET /topups/{topup_id}

Gets the top-up status.

### Request

```http
GET /api/v1/topups/topup_abc123
Authorization: Bearer ohk_live_xxx
```

### Response

```json
{
  "id": "topup_...",
  "status": "TOPUP_PROCESSING",
  "amount": "50.00",
  "currency": "USD",
  "provider_ref": { "airtm_payin_id": "..." },
  "updated_at": "2026-01-12T10:05:00.000Z"
}
```

---

## POST /topups/{topup_id}/refresh

Re-checks Airtm if a webhook is missing.

### Request

```http
POST /api/v1/topups/topup_abc123/refresh
Authorization: Bearer ohk_live_xxx
```

### Response

```json
{
  "id": "topup_...",
  "status": "TOPUP_PROCESSING"
}
```

### Notes

- This endpoint is naturally idempotent.
- Use it only when a webhook did not arrive.
