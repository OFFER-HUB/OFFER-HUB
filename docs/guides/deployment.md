# Deployment Guide

Self-hosting the OFFER-HUB Orchestrator on a VPS, Railway, Render, or Kubernetes.

## Prerequisites

- Node.js 20+
- PostgreSQL (Supabase recommended)
- Redis 7+
- A [Trustless Work](https://dapp.trustlesswork.com) API key
- Public HTTPS URL (for webhooks)

## Step-by-Step

### 1. Clone and install

```bash
git clone https://github.com/OFFER-HUB/OFFER-HUB.git
cd OFFER-HUB
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
```

Required variables for `PAYMENT_PROVIDER=crypto` (default):

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres pooler URL (port 6543 for Supabase) |
| `DIRECT_URL` | Postgres direct URL (port 5432 — for migrations) |
| `REDIS_URL` | Redis connection URL |
| `WALLET_ENCRYPTION_KEY` | 32-byte hex key for AES-256-GCM |
| `OFFERHUB_MASTER_KEY` | Master API key for bootstrapping marketplace keys |
| `TRUSTLESS_API_KEY` | Trustless Work API key |
| `TRUSTLESS_WEBHOOK_SECRET` | Webhook secret from Trustless Work dashboard |
| `PUBLIC_BASE_URL` | Public HTTPS URL of this instance |

Generate `WALLET_ENCRYPTION_KEY`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Run database migrations

```bash
npm run prisma:migrate
```

> Use `DIRECT_URL` (port 5432) for migrations — not the pooler.

### 4. Bootstrap the platform user

The Orchestrator requires a dedicated platform user whose Stellar wallet serves as `disputeResolver` and `platformAddress` in all escrow contracts.

```bash
npm run bootstrap
```

Expected output:

```
🚀 OFFER-HUB Orchestrator Bootstrap

Creating platform user...
  ✓ Platform user created: usr_xxxxxxxxxxxx
Generating Stellar wallet...
  ✓ Wallet created: GXXXXXXXXXXXXXXXX
Setting up testnet funding + USDC trustline...
  ✓ Testnet account funded
  ✓ USDC trustline established

✅ Bootstrap complete!

─────────────────────────────────────────────
PLATFORM_USER_ID=usr_xxxxxxxxxxxx
─────────────────────────────────────────────
```

Copy the `PLATFORM_USER_ID=...` line into your `.env` file.

> **Idempotent**: Running `npm run bootstrap` again will detect the existing platform user and print its ID without creating a duplicate.

### 5. Start the server

```bash
npm run dev        # development (tsx watch)
npm run build && npm start  # production
```

Startup logs confirm readiness:

```
[Bootstrap] Platform user validated: usr_xxx (wallet: GXXX...)
[BlockchainMonitor] Starting monitor for N wallets
[Shutdown] Graceful shutdown handler registered
API listening on port 4000
```

## Environment Variables Reference

See `.env.example` for the full list with descriptions.

### Horizontal Scaling

If running multiple instances, set `DISABLE_BLOCKCHAIN_MONITOR=true` on all but one instance. See [Scaling & Customization](./scaling-customization.md).

## Security Checklist

- [ ] `WALLET_ENCRYPTION_KEY` is random, 32 bytes, stored in a secrets manager (not git)
- [ ] `OFFERHUB_MASTER_KEY` is rotated after initial setup
- [ ] `DATABASE_URL` uses SSL (`?sslmode=require` or Supabase default)
- [ ] `PUBLIC_BASE_URL` is HTTPS only
- [ ] API is behind a reverse proxy (nginx / Cloudflare) — never expose port 4000 directly
- [ ] Rate limiting is enabled (built-in `RateLimitGuard`)
- [ ] Webhook secrets (`TRUSTLESS_WEBHOOK_SECRET`) are set and validated

## Mainnet Checklist

- [ ] `STELLAR_NETWORK=mainnet`
- [ ] `STELLAR_HORIZON_URL=https://horizon.stellar.org`
- [ ] `STELLAR_USDC_ISSUER` set to Circle mainnet issuer
- [ ] `TRUSTLESS_API_URL=https://api.trustlesswork.com`
- [ ] Platform wallet manually funded with XLM + USDC trustline
