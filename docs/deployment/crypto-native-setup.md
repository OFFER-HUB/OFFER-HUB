# Crypto-Native Deployment Guide

Production deployment guide for OFFER-HUB Orchestrator in **crypto-native mode** (Stellar invisible wallets).

## Overview

In crypto-native mode, the Orchestrator manages custodial Stellar wallets for each user. This requires additional security considerations compared to AirTM mode.

```
User registers → Invisible wallet created → Keypair encrypted (AES-256-GCM)
                                           → Funded via Friendbot (testnet)
                                           → USDC trustline established
                                           → BlockchainMonitor starts watching
```

---

## Prerequisites

### 1. Stellar Network Access

| Network | Horizon URL | Use Case |
|---------|-------------|----------|
| **Testnet** | `https://horizon-testnet.stellar.org` | Development, staging |
| **Mainnet** | `https://horizon.stellar.org` | Production |

No API key needed for Horizon. Rate limits apply (~100 req/s for public endpoints).

### 2. USDC Asset Configuration

**Testnet:**
```env
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_USDC_ASSET_CODE=USDC
STELLAR_USDC_ISSUER=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
```

**Mainnet:**
```env
STELLAR_NETWORK=mainnet
STELLAR_HORIZON_URL=https://horizon.stellar.org
STELLAR_USDC_ASSET_CODE=USDC
STELLAR_USDC_ISSUER=GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN
```

> **Important:** The USDC issuer on mainnet is Circle's official Stellar anchor. Verify the address at [stellar.expert](https://stellar.expert) before deploying.

### 3. Trustless Work Integration

Register at [trustlesswork.com](https://trustlesswork.com) and obtain:
- `TRUSTLESS_API_KEY`
- `TRUSTLESS_WEBHOOK_SECRET`

Configure the webhook URL after deployment:
```
https://your-domain.com/api/v1/webhooks/trustless-work
```

---

## Wallet Encryption Key

The `WALLET_ENCRYPTION_KEY` protects all user private keys. **If lost, all wallets become unrecoverable.**

### Generate the Key

```bash
# Generate a 32-byte (256-bit) hex key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Storage Requirements

| Environment | Storage Method |
|-------------|---------------|
| Development | `.env` file (gitignored) |
| Staging | Platform secrets (Railway, Render) |
| Production | Secrets manager (AWS Secrets Manager, HashiCorp Vault, GCP Secret Manager) |

### Backup Procedures

1. **Generate the key** using the command above
2. **Store the primary copy** in your secrets manager
3. **Store a backup copy** in a separate secure location (e.g., encrypted USB in a safe)
4. **Document who has access** to the key
5. **Never commit** the key to version control

### Key Rotation

Key rotation requires re-encrypting all wallet secrets:

```
1. Generate new WALLET_ENCRYPTION_KEY
2. Run migration script (decrypt with old key, re-encrypt with new key)
3. Update environment variable
4. Restart service
5. Verify wallet operations work
6. Securely destroy old key after confirmation period (72h recommended)
```

> **Warning:** Key rotation requires downtime or a maintenance window. All wallet operations will fail during rotation.

---

## Environment Configuration

### Minimal Crypto-Native `.env`

```env
# Server
NODE_ENV=production
PORT=4000

# Database
DATABASE_URL=postgresql://user:password@host:5432/offerhub?sslmode=require

# Redis
REDIS_URL=rediss://:password@host:6379

# Auth
OFFERHUB_MASTER_KEY=your-secure-master-key

# Payment Provider
PAYMENT_PROVIDER=crypto

# Wallet Encryption
WALLET_ENCRYPTION_KEY=your-64-char-hex-key

# Stellar
STELLAR_NETWORK=mainnet
STELLAR_HORIZON_URL=https://horizon.stellar.org
STELLAR_USDC_ASSET_CODE=USDC
STELLAR_USDC_ISSUER=GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN

# Trustless Work
TRUSTLESS_API_KEY=your-trustless-api-key
TRUSTLESS_WEBHOOK_SECRET=your-trustless-webhook-secret

# Public URL
PUBLIC_BASE_URL=https://your-domain.com
```

### What You Don't Need (crypto mode)

These AirTM variables are **not required** in crypto-native mode:
- `AIRTM_API_KEY`
- `AIRTM_API_SECRET`
- `AIRTM_WEBHOOK_SECRET`
- `AIRTM_ENV`

---

## Deployment Steps

### Step 1: Database Migration

```bash
# Run Prisma migrations (includes Wallet table)
npx prisma migrate deploy --schema packages/database/prisma/schema.prisma
```

The migration creates:
- `Wallet` table with `encrypted_secret`, `public_key`, `type`, `provider` columns
- `WalletType` enum (`INVISIBLE`, `EXTERNAL`)
- `WalletProvider` enum (`STELLAR`)

### Step 2: Deploy the Service

Deploy using your platform of choice (see [main deployment guide](./README.md)).

### Step 3: Verify Health

```bash
curl https://your-domain.com/api/v1/health/detailed
```

Expected response includes blockchain connectivity:
```json
{
  "data": {
    "status": "healthy",
    "dependencies": {
      "database": { "status": "healthy" },
      "redis": { "status": "healthy" },
      "trustlessWork": { "status": "healthy" }
    }
  }
}
```

### Step 4: Test Wallet Creation

```bash
# Create a test user (wallet is created automatically)
curl -X POST https://your-domain.com/api/v1/users \
  -H "x-api-key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"externalUserId": "test-1", "email": "test@example.com", "type": "BUYER"}'

# Check wallet was created
curl https://your-domain.com/api/v1/users/usr_xxx/wallet \
  -H "x-api-key: your-api-key"
```

### Step 5: Verify Blockchain Monitor

The `BlockchainMonitorService` starts automatically and watches all active wallets for incoming USDC deposits. Check logs for:

```
[BlockchainMonitor] Monitoring wallet GABCDEF... for user usr_xxx
```

---

## Testnet vs Mainnet

### Testnet Considerations

- **Friendbot**: Automatically funds new accounts with 10,000 XLM (testnet only)
- **Test USDC**: Available from the testnet USDC issuer
- **No real money**: Safe for testing full flows
- **Resets**: Stellar testnet resets periodically (all balances wiped)

### Mainnet Migration Checklist

- [ ] Update `STELLAR_NETWORK=mainnet`
- [ ] Update `STELLAR_HORIZON_URL=https://horizon.stellar.org`
- [ ] Update `STELLAR_USDC_ISSUER` to Circle's mainnet issuer
- [ ] Remove Friendbot funding logic (mainnet accounts need real XLM)
- [ ] Fund a master account with XLM for creating user accounts
- [ ] Verify USDC trustline with mainnet asset
- [ ] Test with small amounts first
- [ ] Set up monitoring alerts for failed transactions

### Account Funding on Mainnet

On mainnet, new Stellar accounts need a minimum balance of ~1 XLM. Options:

1. **Fund from a master account** - Your platform holds XLM and sponsors account creation
2. **User funds their own account** - Send XLM to the deposit address first
3. **Sponsored reserves** - Use Stellar's sponsorship feature (advanced)

---

## Monitoring

### Key Metrics to Watch

| Metric | Alert Threshold | Description |
|--------|-----------------|-------------|
| Wallet creation failures | Any failure | Stellar account creation failing |
| USDC trustline failures | Any failure | Trustline not being established |
| Deposit detection lag | >30 seconds | BlockchainMonitor falling behind |
| Encryption/decryption errors | Any error | Possible key issues |
| Horizon API errors | >5% error rate | Stellar network issues |
| Failed transactions | Any failure | Payment or escrow signing issues |

### Log Patterns to Monitor

```bash
# Wallet creation success
grep "Wallet created for user" /var/log/offerhub.log

# Deposit detected
grep "Deposit detected" /var/log/offerhub.log

# Encryption errors (critical)
grep "WALLET_ENCRYPTION_KEY" /var/log/offerhub.log

# Horizon errors
grep "Horizon" /var/log/offerhub.log | grep -i error
```

---

## Troubleshooting

### "WALLET_ENCRYPTION_KEY is not set"

The key is missing from environment variables:
```bash
# Verify it's set
echo $WALLET_ENCRYPTION_KEY | wc -c
# Should output 65 (64 hex chars + newline)
```

### "must be 32 bytes"

The key is not the correct length. Generate a new one:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### "Wallet creation failed"

Check Stellar network connectivity:
```bash
curl https://horizon-testnet.stellar.org/
# or for mainnet:
curl https://horizon.stellar.org/
```

### "USDC trustline failed"

The account may not have enough XLM for the trustline reserve (~0.5 XLM needed):
```bash
# Check account balance
curl https://horizon-testnet.stellar.org/accounts/GABCDEF...
```

### "Decryption failed"

The `WALLET_ENCRYPTION_KEY` may have changed or been corrupted:
1. Verify the key matches what was used during wallet creation
2. Check for environment variable encoding issues (no trailing spaces/newlines)
3. If the key was rotated without re-encryption, wallets from before rotation are unrecoverable

### BlockchainMonitor not detecting deposits

1. Verify the monitor is running: check logs for `[BlockchainMonitor]` entries
2. Confirm the wallet's public key is being watched
3. Check Stellar network status: https://dashboard.stellar.org
4. Verify USDC asset code and issuer match the sender's asset

---

## Related Documentation

- [Main Deployment Guide](./README.md) - General deployment (platforms, DB, Redis)
- [Environment Variables](./env-variables.md) - Complete variable reference
- [Wallet Strategy](../crypto-native/wallet-strategy.md) - Architecture decisions
- [Security Hardening](./security-hardening.md) - Production security checklist
- [Production Checklist](./production-checklist.md) - Go-live verification
