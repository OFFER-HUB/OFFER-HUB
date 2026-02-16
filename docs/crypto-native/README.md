# Crypto-Native Architecture

**Status:** Active Development
**Decision Date:** 2026-02-16
**Owner:** Josue

---

## Context

The OFFER-HUB Orchestrator was originally designed with AirTM as the fiat on/off-ramp provider. AirTM requires an Enterprise account (5,000+ transactions/month, $30,000+ USDC/month) which is not viable for a new project. After waiting since early February 2026, we decided to proceed with a crypto-native architecture.

## Strategic Decision

**Build crypto-native NOW, keep AirTM as a future switchable option.**

This is NOT a removal of AirTM -- it's an **abstraction** that:
1. Creates a `PaymentProvider` interface (Strategy Pattern)
2. Implements `CryptoNativeProvider` as the default
3. Keeps AirTM code intact, to be adapted later as `AirtmProvider`
4. Marketplace operators choose their provider via config

## Documentation Index

| Document | Description |
|----------|-------------|
| [Wallet Strategy](./wallet-strategy.md) | Why invisible wallets, not Freighter |
| [Architecture](./architecture.md) | Provider abstraction & system design |
| [Implementation Plan](./implementation-plan.md) | Step-by-step build plan with phases |
| [Provider Interface](./provider-interface.md) | Strategy pattern technical spec |

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Wallet type | Invisible (server-side) | Orchestrator must sign escrow txns server-side |
| AirTM code | Keep, abstract later | Avoid throwaway work, enable future switch |
| Provider selection | Config-based (`PAYMENT_PROVIDER`) | Simple, no code changes to switch |
| Encryption | AES-256-GCM | Industry standard, Node.js native crypto |
| Network | Stellar Testnet first | Trustless Work already on testnet |

## Related Documents

- [Original Migration Plan](../../CRYPTO_NATIVE_MIGRATION.md) -- Initial analysis (outdated approach of deleting AirTM)
- [Architecture Overview](../architecture/overview.md) -- Current system architecture
- [Flow of Funds](../architecture/flow-of-funds.md) -- Current fund flow (AirTM-based)
