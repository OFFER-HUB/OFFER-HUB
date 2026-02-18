# Installer (`create-offer-hub-orchestrator`)

Interactive setup wizard for OFFER-HUB Orchestrator. Configures environment, runs migrations, bootstraps the platform user, and generates your initial API key.

**npm:** [`create-offer-hub-orchestrator`](https://www.npmjs.com/package/create-offer-hub-orchestrator)

## Usage

From the root of your cloned OFFER-HUB Orchestrator project:

```bash
npx create-offer-hub-orchestrator
```

Or run directly from the monorepo (development):

```bash
npm run dev -w packages/create-offerhub
```

## What It Does

1. **Prompts** for your configuration (database, Redis, payment provider, Stellar network, etc.)
2. **Generates** a `.env` file with all required variables
3. **Auto-generates** secure keys:
   - `OFFERHUB_MASTER_KEY` — API authentication bootstrap key
   - `WALLET_ENCRYPTION_KEY` — AES-256-GCM key for wallet encryption (crypto mode only)
4. **Runs** database migrations (`prisma migrate deploy`)
5. **Bootstraps** the platform user — runs `npm run bootstrap`, creates the Stellar wallet, and writes `PLATFORM_USER_ID` into `.env` automatically
6. **Creates** an initial admin API key (optional — requires the server to be running)

## Configuration Prompts

| Prompt | Default | Description |
|--------|---------|-------------|
| API Port | `4000` | Port for the HTTP server |
| PostgreSQL URL | `postgresql://...` | Use pooler URL (port 6543) for Supabase |
| Redis URL | `redis://localhost:6379` | Redis connection for queues/cache |
| Payment Provider | `crypto` | `crypto` (Stellar) or `airtm` (fiat) |
| Stellar Network | `testnet` | `testnet` for development, `mainnet` for production |
| Trustless Work API Key | — | From [dapp.trustlesswork.com](https://dapp.trustlesswork.com) |
| Trustless Work Webhook Secret | — | For webhook signature verification |
| Public URL | `http://localhost:4000` | Your server's HTTPS URL (for webhook callbacks) |
| AirTM credentials | — | Only prompted when `airtm` provider is selected |
| Run migrations? | `Yes` | Applies all pending Prisma migrations |
| Generate API key? | `Yes` | Creates first admin key (requires running server) |

## Generated `.env`

```env
# Server
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379

# Payment Provider
PAYMENT_PROVIDER=crypto

# Wallet Encryption (auto-generated — BACK THIS UP)
WALLET_ENCRYPTION_KEY=<64-char-hex>

# Auth (auto-generated)
OFFERHUB_MASTER_KEY=ohk_master_<random>

# Platform Identity (written automatically by bootstrap)
PLATFORM_USER_ID=usr_<random>

# Trustless Work
TRUSTLESS_API_KEY=your_key
TRUSTLESS_API_URL=https://dev.api.trustlesswork.com
TRUSTLESS_WEBHOOK_SECRET=your_secret

# Stellar
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_USDC_ASSET_CODE=USDC
STELLAR_USDC_ISSUER=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5

# Public URL
PUBLIC_BASE_URL=http://localhost:4000
```

## After Setup

```bash
# Start development server
npm run dev

# Verify the server is healthy
curl http://localhost:4000/api/v1/health

# Create your first marketplace API key
curl -X POST http://localhost:4000/api/v1/auth/api-keys \
  -H "Authorization: Bearer $OFFERHUB_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Marketplace", "scopes": ["read", "write"]}'
```

## Important Notes

- **`WALLET_ENCRYPTION_KEY` is critical** — back it up in a secrets manager before anything else. If lost, all encrypted wallet keys become unrecoverable.
- The wizard is **safe to re-run** — it asks before overwriting an existing `.env`. The bootstrap step is idempotent (will not create duplicate platform users).
- **Never commit `.env` to git.** Verify `.gitignore` includes it.
- For production, switch `STELLAR_NETWORK=mainnet` and use your production database/Redis URLs.

## Package Structure

```
packages/create-offerhub/
├── src/
│   ├── index.ts            # Main wizard flow
│   ├── env-generator.ts    # .env file generation
│   └── ui.ts               # Banner and success messages
├── package.json
└── tsconfig.json
```

## Related

- [npm Packages Guide](../guides/npm-packages.md) — Overview of all 3 packages
- [Deployment Guide](../guides/deployment.md) — Full self-hosting guide
- [Crypto-Native Setup](./crypto-native-setup.md) — Wallet configuration details
- [Environment Variables](./env-variables.md) — Complete variable reference
