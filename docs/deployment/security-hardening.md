# Security Hardening Guide

Production security checklist for OFFER-HUB Orchestrator, with emphasis on custodial wallet management.

---

## Wallet Encryption Security

### Key Management

| Requirement | Details |
|-------------|---------|
| Algorithm | AES-256-GCM (authenticated encryption) |
| Key length | 32 bytes (64 hex characters) |
| IV | Random 16 bytes per encryption (never reused) |
| Auth tag | 16 bytes (tamper detection) |
| Storage format | `iv:authTag:ciphertext` (hex encoded) |

### Key Generation

```bash
# Always use cryptographically secure random generation
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or with openssl
openssl rand -hex 32
```

Never use:
- Passwords or passphrases as keys
- Deterministic generation (hashing a string)
- Online key generators

### Key Storage Tiers

| Tier | Method | Use Case |
|------|--------|----------|
| Basic | Platform env vars (Railway, Render) | Small deployments, startups |
| Standard | Secrets manager (AWS SM, GCP SM, Vault) | Production deployments |
| Enterprise | HSM (AWS CloudHSM, Azure Dedicated HSM) | Regulated environments |

### Key Rotation Procedure

1. **Schedule a maintenance window** (wallet operations will be paused)
2. **Generate new key**: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
3. **Run re-encryption migration**:
   ```
   For each wallet in database:
     1. Decrypt encrypted_secret with OLD key
     2. Re-encrypt with NEW key
     3. Update database row
   ```
4. **Update environment variable** to new key
5. **Restart service**
6. **Test wallet operations** (create user, check wallet, attempt transaction)
7. **Monitor for 72 hours** before destroying old key
8. **Destroy old key** after confirmation

### Key Compromise Response

If you suspect the encryption key has been compromised:

1. **Immediately rotate the key** using the procedure above
2. **Audit access logs** to determine scope of exposure
3. **Review wallet transactions** for unauthorized activity
4. **Notify affected users** if required by regulation
5. **Document the incident** for compliance

---

## API Security

### Authentication

- [ ] `OFFERHUB_MASTER_KEY` is 32+ random bytes (not a dictionary word)
- [ ] API keys use SHA-256 hashing with salt (built-in)
- [ ] Short-lived tokens expire within configured TTL
- [ ] Rate limiting is active (100 req/min default)

### Key Generation

```bash
# Generate master key
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### CORS Configuration

Only allow your frontend domain:
```env
# Do NOT use * in production
CORS_ORIGIN=https://your-marketplace.com
```

### Headers

The API automatically sets:
- `X-Request-ID` — Correlation ID for tracing
- `X-RateLimit-*` — Rate limit status headers

---

## Network Security

### TLS/SSL

- [ ] All endpoints served over HTTPS (no HTTP)
- [ ] Database connections use `?sslmode=require`
- [ ] Redis connections use `rediss://` (TLS)
- [ ] Webhook endpoints verify signatures before processing

### Firewall Rules

| From | To | Port | Protocol |
|------|-----|------|----------|
| Internet | API Server | 443 | HTTPS |
| API Server | PostgreSQL | 5432 | TCP/TLS |
| API Server | Redis | 6379 | TCP/TLS |
| API Server | Stellar Horizon | 443 | HTTPS |
| API Server | Trustless Work | 443 | HTTPS |
| Airtm webhooks | API Server | 443 | HTTPS |
| TW webhooks | API Server | 443 | HTTPS |

### Database Security

- [ ] Database not publicly accessible (private network only)
- [ ] Dedicated database user with minimum privileges
- [ ] Connection pooling configured (prevents exhaustion)
- [ ] Regular backups enabled with point-in-time recovery

---

## Webhook Security

### Signature Verification

All incoming webhooks are verified before processing:

| Provider | Method | Header |
|----------|--------|--------|
| Airtm | HMAC-SHA256 (Svix) | `svix-signature` |
| Trustless Work | HMAC-SHA256 | `x-tw-signature` |

### Webhook Best Practices

- [ ] Webhook secrets stored in environment variables (never hardcoded)
- [ ] Signature verification happens before any processing
- [ ] Webhook deduplication enabled (`WebhookEvent` table)
- [ ] Failed webhooks go to Dead Letter Queue for investigation
- [ ] Webhook endpoints return 200 quickly (processing happens in background)

---

## Data Protection

### Sensitive Data Handling

| Data | Protection | Storage |
|------|------------|---------|
| Wallet private keys | AES-256-GCM encryption | Database (encrypted) |
| API keys | SHA-256 + salt hashing | Database (hashed) |
| Webhook secrets | Environment variables | Not in database |
| User emails | Plain text | Database |
| Transaction amounts | Plain text | Database + audit log |

### Audit Trail

All mutations are logged in the audit system:
- User creation/modification
- Balance changes
- Order state transitions
- Wallet operations
- API key usage

Sensitive fields are automatically redacted in audit logs.

### Data Retention

Define retention policies for:
- Audit logs (recommended: 2+ years)
- Webhook events (recommended: 90 days)
- Job history (recommended: 30 days)
- SSE event backlog (recommended: 24 hours)

---

## Container Security (Docker)

If deploying with Docker:

- [ ] Use minimal base image (`node:20-alpine`)
- [ ] Run as non-root user
- [ ] No secrets in Docker images or layers
- [ ] Scan images for vulnerabilities (Snyk, Trivy)
- [ ] Use read-only filesystem where possible
- [ ] Limit container resources (CPU, memory)

```dockerfile
# Run as non-root
RUN addgroup -g 1001 offerhub && adduser -u 1001 -G offerhub -s /bin/sh -D offerhub
USER offerhub
```

---

## Incident Response

### Severity Levels

| Level | Example | Response Time |
|-------|---------|---------------|
| P0 - Critical | Encryption key compromised, unauthorized transactions | Immediate |
| P1 - High | Service down, database unreachable | 15 minutes |
| P2 - Medium | High error rate, slow responses | 1 hour |
| P3 - Low | Non-critical feature degraded | Next business day |

### P0 Playbook (Key Compromise)

1. Rotate `WALLET_ENCRYPTION_KEY` immediately
2. Revoke all API keys
3. Review transaction logs for unauthorized activity
4. Enable maintenance mode
5. Notify stakeholders
6. Conduct post-mortem

---

## Compliance Considerations

### Custodial Wallets

Operating custodial wallets means your platform holds user funds. Consider:

- **Terms of Service**: Clearly state you hold custodial control
- **Local regulations**: Check crypto custody laws in your jurisdiction
- **Insurance**: Consider coverage for wallet losses
- **Transparency**: Provide users with their public key and on-chain verification

### Audit Requirements

Maintain documentation for:
- Key generation procedures
- Access control lists (who can access production secrets)
- Incident response history
- Regular security review schedule

---

## Related Documentation

- [Crypto-Native Setup](./crypto-native-setup.md) - Deployment guide for crypto mode
- [Environment Variables](./env-variables.md) - Complete variable reference
- [Production Checklist](./production-checklist.md) - Go-live verification
- [Wallet Strategy](../crypto-native/wallet-strategy.md) - Architecture decisions
