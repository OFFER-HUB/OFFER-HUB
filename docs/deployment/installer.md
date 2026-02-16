# Installer

Interactive setup tool for OFFER-HUB Orchestrator. Configures environment, runs migrations, and generates your initial API key.

## Usage

From the root of your cloned/forked OFFER-HUB Orchestrator project:

```bash
npx create-offer-hub-orchestrator
```

Or run directly from the monorepo:

```bash
npm run dev -w packages/create-offerhub
```

## What It Does

1. **Prompts** for your configuration (database, Redis, payment provider, Stellar network, etc.)
2. **Generates** a `.env` file with all required variables
3. **Auto-generates** secure keys:
   - `OFFERHUB_MASTER_KEY` — API authentication
   - `WALLET_ENCRYPTION_KEY` — Wallet private key encryption (crypto mode only)
4. **Runs** database migrations (optional)
5. **Creates** an initial admin API key (optional, requires running server)

## Configuration Prompts

| Prompt | Default | Description |
|--------|---------|-------------|
| API Port | `4000` | Port for the HTTP server |
| PostgreSQL URL | `postgresql://...` | Database connection string |
| Redis URL | `redis://localhost:6379` | Redis connection for queues/cache |
| Payment Provider | `crypto` | `crypto` (Stellar) or `airtm` (fiat) |
| Stellar Network | `testnet` | `testnet` or `mainnet` |
| Trustless Work API Key | — | From trustlesswork.com |
| Trustless Work Webhook Secret | — | For webhook verification |
| Public URL | `http://localhost:4000` | For webhook callbacks |
| AirTM credentials | — | Only prompted when `airtm` is selected |

## Generated .env

The installer creates a `.env` file with:

```env
# Server
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379

# Payment Provider
PAYMENT_PROVIDER=crypto

# Wallet Encryption (auto-generated)
WALLET_ENCRYPTION_KEY=<64-char-hex>

# Auth (auto-generated)
OFFERHUB_MASTER_KEY=ohk_master_<random>

# Trustless Work
TRUSTLESS_API_KEY=your_key
TRUSTLESS_API_URL=https://dev.api.trustlesswork.com

# Stellar
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_USDC_ASSET_CODE=USDC
STELLAR_USDC_ISSUER=GBBD47IF6LWK7P7...
```

## After Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Verify health
curl http://localhost:4000/api/v1/health
```

## Package Structure

```
packages/create-offerhub/
├── src/
│   ├── index.ts            # Main entry point, prompts flow
│   ├── env-generator.ts    # .env file generation
│   └── ui.ts               # Banner and success messages
├── package.json
└── tsconfig.json
```

## Related

- [Main Deployment Guide](./README.md) - Platform-specific deployment
- [Crypto-Native Setup](./crypto-native-setup.md) - Wallet deployment details
- [Environment Variables](./env-variables.md) - Complete variable reference
