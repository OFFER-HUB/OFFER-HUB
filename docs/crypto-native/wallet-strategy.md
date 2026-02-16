# Wallet Strategy: Invisible Wallets

**Decision:** Server-side invisible Stellar wallets
**Date:** 2026-02-16
**Status:** Approved

---

## The Question

Should OFFER-HUB use:
- **A)** Invisible wallets (server-side keypair, custodial)
- **B)** Freighter browser extension (client-side, non-custodial)
- **C)** Smart Wallets with Passkeys (Soroban-based)

## Decision: Option A -- Invisible Wallets

### Why: The Architectural Constraint

The Orchestrator **must sign transactions server-side** for:
- Funding escrow contracts (buyer's wallet signs)
- Releasing funds to seller (signer role)
- Refunding buyer (signer role)
- Resolving disputes (dispute resolver role)

These operations happen **without user interaction** (e.g., webhook-triggered releases, automated dispute resolution). Freighter requires the user's browser to be open and actively approving each transaction -- this breaks the automated escrow flow.

### Comparison

| Aspect | Invisible Wallets | Freighter | Smart Wallets (Passkeys) |
|--------|-------------------|-----------|--------------------------|
| Backend effort | Medium (1 service) | High (adapter, SEP-10, relay) | Very High (Soroban contracts) |
| Frontend effort | **None** | High (wallet adapter, UX) | Medium (PasskeyKit) |
| UX | Web2 (transparent) | Web3 (extension required) | Web2.5 (passkey prompt) |
| Mobile support | Yes | No (browser extension only) | Yes |
| Automated escrow | Yes | No | Partial |
| Custodial risk | Yes (we hold keys) | No | No |
| Implementation time | ~1 week | ~2-3 weeks | ~3-4 weeks |
| Target audience fit (LATAM) | Excellent | Poor | Good |

### How Invisible Wallets Work

```
User registers (email/password)
    ↓
Backend generates Stellar Keypair
    ↓
Public key stored in DB (plain)
Secret key encrypted with AES-256-GCM, stored in DB
    ↓
User sees: "Balance: $0.00 USDC"
User never sees: wallet addresses, keys, blockchain
    ↓
To deposit: User sends USDC to their public address
    (shown as "Deposit Address" in UI)
    ↓
Backend monitors blockchain, credits balance
    ↓
For escrow: Backend decrypts key, signs transaction
```

### Security Measures

1. **AES-256-GCM encryption** for private keys at rest
2. **WALLET_ENCRYPTION_KEY** stored as environment variable (never in DB)
3. **Key never leaves server memory** except during signing
4. Keys are decrypted only for the duration of a transaction
5. Future: HSM (Hardware Security Module) for production

### Custodial Responsibility

We ARE custodians. This means:
- We are responsible for key security
- We must have disaster recovery procedures
- We should consider insurance for large amounts
- Legal implications vary by jurisdiction

### Future: Adding Freighter Support

In a future phase, we can add Freighter as an "advanced user" option:
- User connects their own Stellar wallet
- They sign transactions themselves via browser
- The Orchestrator uses their public key but doesn't hold their secret
- This would be a second wallet type, not a replacement

This is straightforward to add later because the Provider Interface abstraction supports it.
