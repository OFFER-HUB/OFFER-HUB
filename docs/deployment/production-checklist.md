# Production Checklist

One-page go-live verification for OFFER-HUB Orchestrator.

---

## Infrastructure

- [ ] PostgreSQL 15+ running with SSL enabled
- [ ] Redis 7+ running with TLS (if remote)
- [ ] Domain name configured with SSL certificate
- [ ] DNS pointing to deployment

## Database

- [ ] Prisma migrations deployed: `npx prisma migrate deploy --schema packages/database/prisma/schema.prisma`
- [ ] Connection uses `?sslmode=require`
- [ ] Backups configured (daily recommended)
- [ ] Connection pooling configured

## Environment Variables

- [ ] `NODE_ENV=production`
- [ ] `PORT` set (default: 4000)
- [ ] `DATABASE_URL` set with SSL
- [ ] `REDIS_URL` set
- [ ] `OFFERHUB_MASTER_KEY` generated (32+ random bytes)
- [ ] `PAYMENT_PROVIDER` set (`crypto` or `airtm`)
- [ ] `PUBLIC_BASE_URL` set to your public domain

### Crypto-Native Mode

- [ ] `WALLET_ENCRYPTION_KEY` generated (64 hex chars)
- [ ] `WALLET_ENCRYPTION_KEY` backed up securely
- [ ] `STELLAR_NETWORK` set (`testnet` or `mainnet`)
- [ ] `STELLAR_HORIZON_URL` set
- [ ] `STELLAR_USDC_ASSET_CODE=USDC`
- [ ] `STELLAR_USDC_ISSUER` set (verify against [stellar.expert](https://stellar.expert))
- [ ] `TRUSTLESS_API_KEY` set
- [ ] `TRUSTLESS_WEBHOOK_SECRET` set

### AirTM Mode (if applicable)

- [ ] `AIRTM_API_KEY` set
- [ ] `AIRTM_API_SECRET` set
- [ ] `AIRTM_WEBHOOK_SECRET` set
- [ ] `AIRTM_ENV=prod`

## Security

- [ ] No secrets in source code or Docker images
- [ ] CORS restricted to your frontend domain
- [ ] Rate limiting active (verify: send 101 requests in 1 minute)
- [ ] Webhook signature verification enabled
- [ ] SSL/TLS on all connections (API, DB, Redis)
- [ ] Master key is not a dictionary word or predictable string

## Post-Deploy Verification

### Health Check

```bash
curl https://your-domain.com/api/v1/health/detailed
# Expect: all dependencies "healthy"
```

### Create API Key

```bash
curl -X POST https://your-domain.com/api/v1/auth/api-keys \
  -H "Authorization: Bearer $OFFERHUB_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Production Key", "scopes": ["orders", "users", "balance"]}'
# Save the returned key securely — it's shown only once
```

### Test User Creation

```bash
curl -X POST https://your-domain.com/api/v1/users \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"externalUserId": "verify-1", "email": "verify@example.com", "type": "BUYER"}'
```

### Test Wallet (crypto mode)

```bash
# Verify wallet was created automatically
curl https://your-domain.com/api/v1/users/usr_xxx/wallet \
  -H "x-api-key: $API_KEY"
# Expect: publicKey, balance, isActive
```

### Webhook Registration

- [ ] Trustless Work webhook URL registered: `https://your-domain.com/api/v1/webhooks/trustless-work`
- [ ] AirTM webhook URL registered (if using): `https://your-domain.com/api/v1/webhooks/airtm`

## Monitoring

- [ ] Uptime monitoring configured (Pingdom, UptimeRobot, etc.)
- [ ] Error tracking configured (Sentry, Bugsnag, etc.)
- [ ] Log aggregation configured (Datadog, Papertrail, etc.)
- [ ] Alert for health check failures (Critical)
- [ ] Alert for high error rate >5% (High)
- [ ] Alert for encryption errors (Critical — crypto mode)

## Backups

- [ ] Database backup schedule configured
- [ ] `WALLET_ENCRYPTION_KEY` backup stored separately from database
- [ ] Recovery procedure documented and tested

---

## Sign-Off

| Item | Verified By | Date |
|------|-------------|------|
| Infrastructure ready | | |
| Migrations deployed | | |
| Health check passing | | |
| API key created | | |
| Test user created | | |
| Wallet working (crypto) | | |
| Monitoring active | | |
| Backups configured | | |

---

## Related Documentation

- [Main Deployment Guide](./README.md) - Platform-specific deployment
- [Crypto-Native Setup](./crypto-native-setup.md) - Stellar wallet deployment
- [Security Hardening](./security-hardening.md) - Security best practices
- [Environment Variables](./env-variables.md) - Complete variable reference
