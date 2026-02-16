# 🗺️ Master Roadmap: OFFER-HUB Orchestrator (100% Granular)

This roadmap is the definitive guide to building the Orchestrator. It maps 100% of the requirements from `/docs` into atomic, testable units of work.

---

## 🏗️ Phase 0: Project Foundation (COMPLETED)
- [x] Initial monorepo scaffolding (Apps, Packages).
- [x] Professional Documentation & English Translation.
- [x] Workflow improvements (Concurrent execution, Docker, Scripts).
- [x] Root configuration (.gitignore, tsconfig.json, docker-compose.yml).
- [x] AI Development Standards (`AI.md`).

---

## 🧬 Phase 1: Shared Domain & Types
*Goal: Define the schema and common logic used by both API and Worker.*

- [x] **Issue 1.1: Database Schema (Prisma)**
    - [x] 1.1.1: Core Identity: `User`, `ApiKey`, `Balance`.
    - [x] 1.1.2: Financials: `TopUp`, `Order`, `Escrow`, `Withdrawal`.
    - [x] 1.1.3: Details: `Milestone`, `Dispute`, `AuditLog`, `IdempotencyKey`.
    - [x] 1.1.4: Infrastructure: `WebhookEvent` (deduplication).
    - [x] 1.1.5: Performance: Add composite indexes for `user_id`, `status`, `external_id`.

- [x] **Issue 1.2: Domain Constants & Enums**
    - [x] 1.2.1: Enums: Implement all status enums from `docs/architecture/state-machines.md`.
    - [x] 1.2.2: ID Prefixes: Implement `usr_`, `ord_`, `topup_`, `esc_`, `dsp_`, `wd_`, `evt_`, `aud_`.
    - [x] 1.2.3: Error Codes: Implement full catalog from `docs/api/errors.md` with HTTP mappings.

- [x] **Issue 1.4: Logic Helpers**
    - [x] 1.4.1: Prefixed NanoID generator.
    - [x] 1.4.2: Financial arithmetic library integration (`Big.js` or `Decimal.js`).
    - [x] 1.4.3: Amount validator (`^\d+\.\d{2}$`).
    - [x] 1.4.4: State machine validator engine (enforcing `ORDER_TRANSITIONS`).

---

## 🔐 Phase 2: Security & Infrastructure
*Goal: Build the protective shell and the core request handlers.*

- [x] **Issue 2.1: Auth System**
    - [x] 2.1.1: API Key hashing logic (SHA-256 + salt).
    - [x] 2.1.2: `ApiKeyGuard` (Authenticates `ohk_` keys).
    - [x] 2.1.3: `ScopeGuard` (Enforces `read`, `write`, `support`).
    - [x] 2.1.4: Short-lived token logic (`ohk_tok_`) for frontend use.

- [x] **Issue 2.2: Idempotency System (Redis)**
    - [x] 2.2.1: `IdempotencyGuard`: Intercepts `Idempotency-Key` headers.
    - [x] 2.2.2: In-progress locking: Prevents concurrent requests with the same key.
    - [x] 2.2.3: Comparison logic: Ensures request hash matches the stored key body.
    - [x] 2.2.4: TTL Logic: 24h for payouts/topups, 7 days for orders, indefinite for disputes.

- [x] **Issue 2.3: Request/Response Pipeline**
    - [x] 2.3.1: Global Error Filter: Transform all exceptions to `docs/api/errors.md` format.
    - [x] 2.3.2: Standard Response Interceptor: Wrap all success responses.
    - [x] 2.3.3: Correlation ID Middleware: Handle `X-Request-ID` headers.
    - [x] 2.3.4: Global Rate Limiter: Implement Redis-based rate limiting (100 req/min general).

---

## 🔌 Phase 3: External Providers
*Goal: Implement the "Dialects" to talk to Airtm and Trustless Work.*

- [x] **Issue 3.1: Airtm Integration** *(PR #21)*
    - [x] 3.1.1: Payin flow (Top-up): URI generation and status check client.
    - [x] 3.1.2: Payout flow (Withdrawal): Create and Commit client.
    - [x] 3.1.3: User verification client (KYC/Country checks).
    - [x] 3.1.4: HMAC Signature verification logic for Airtm webhooks (Svix).

- [x] **Issue 3.2: Trustless Work Integration** *(PR #20)*
    - [x] 3.2.1: Stellar wallet logic (Balance projection).
    - [x] 3.2.2: Escrow contract creation client.
    - [x] 3.2.3: Partial Release / Partial Refund logic.
    - [x] 3.2.4: HMAC Signature verification logic for TW webhooks.

---

## 💰 Phase 4: Core Services (Business Logic)
*Goal: The heart of the Orchestrator - State & Money management.*

- [x] **Issue 4.1: Balance Orchestrator** *(PR #29)*
    - [x] 4.1.1: Implement atomic `available` vs `reserved` updates (Prisma Transactions).
    - [x] 4.1.2: Implement `MIRROR` logic: ensuring local balance reflects provider state.

- [x] **Issue 4.2: Top-Up Orchestrator** *(PR #21, #42)*
    - [x] 4.2.1: Flow orchestration: `CREATED` -> `AWAITING_CONFIRMATION` -> `PROCESSING` -> `SUCCEEDED`.
    - [x] 4.2.2: Success/Cancel URL redirection and state logic.

- [x] **Issue 4.3: Order & Escrow Orchestrator** *(PR #30)*
    - [x] 4.3.1: Funds reservation logic (`available` -= amount, `reserved` += amount).
    - [x] 4.3.2: Escrow Bridge: Triggering move to Stellar wallet when funding escrow.
    - [x] 4.3.3: Milestones flow: handling partial completions.

- [x] **Issue 4.4: Resolution Orchestrator** *(PR #31)*
    - [x] 4.4.1: Release flow: Funds to seller `available` balance.
    - [x] 4.4.2: Refund flow: Funds back to buyer `available` balance.
    - [x] 4.4.3: Dispute Split flow: Fractional distribution of escrow.

---

## 📡 Phase 5: API Endpoints (The Surface)
*Goal: Implement every endpoint documented in /docs/api/endpoints.*

- [x] **Issue 5.1: Auth & Config Endpoints** *(PR #15)*
    - [x] 5.1.1: `POST /auth/api-keys` and `GET /auth/api-keys` (paginated, masked).
    - [x] 5.1.2: `POST /auth/api-keys/:id/token` (Short-lived tokens).
    - [x] 5.1.3: `GET /me` and `GET /config`.
    - [x] 5.1.4: `GET /health` (Aggregated health check for DB, Redis, Airtm, TW).

- [x] **Issue 5.2: Users & Balances** *(PR #29)*
    - [x] 5.2.1: `POST /users` (Marketplace registration).
    - [x] 5.2.2: `POST /users/{id}/airtm/link`.
    - [x] 5.2.3: `GET /users/{id}/balance` (Full available/reserved breakdown).

- [x] **Issue 5.3: Top-Ups Endpoints** *(PR #21, #42)*
    - [x] 5.3.1: `POST /topups` (Payin start).
    - [x] 5.3.2: `POST /topups/{id}/refresh` (Manual poll sync).

- [x] **Issue 5.4: Orders & Escrow Endpoints** *(PR #30)*
    - [x] 5.4.1: `POST /orders`, `GET /orders`, `GET /orders/{id}`.
    - [x] 5.4.2: `POST /orders/{id}/reserve` and `/cancel`.
    - [x] 5.4.3: `POST /orders/{id}/escrow` and `/escrow/fund`.
    - [x] 5.4.4: `POST /orders/{id}/milestones/{ref}/complete`.

- [x] **Issue 5.5: Settlement Endpoints** *(PR #31)*
    - [x] 5.5.1: `POST /orders/{id}/release` and `/refund`.
    - [x] 5.5.2: `POST /orders/{id}/disputes` and `/disputes/{id}/resolve`.

- [x] **Issue 5.6: Withdrawals Endpoints** *(PR #21)*
    - [x] 5.6.1: `POST /withdrawals` and `/withdrawals/{id}/commit`.
    - [x] 5.6.2: `POST /withdrawals/{id}/refresh`.

---

## 📝 Phase 6: Observability (Events & Logs)
*Goal: Implement 100% traceability for events and audit.*

- [x] **Issue 6.1: Internal Event System**
    - [x] 6.1.1: Event Bus implementation.
    - [x] 6.1.2: Event Catalog implementation (mapping every event in `docs/events/catalog.md`).

- [x] **Issue 6.2: Real-time SSE**
    - [x] 6.2.1: `GET /events` endpoint with user-filtering.
    - [x] 6.2.2: SSE Heartbeat (ping) mechanism.
    - [x] 6.2.3: Reconnection logic (backlog replay from cursor).

- [x] **Issue 6.3: Audit System**
    - [x] 6.3.1: `AuditService`: Save `aud_` records for every mutation.
    - [x] 6.3.2: Data Redaction logic: mask sensitive fields in audit records.
    - [x] 6.3.3: `GET /audit/logs` with resource-type filters.

---

## 👷 Phase 7: Background Worker (BullMQ) (COMPLETED)
*Goal: Handle asynchronicity, retries, and scheduled health.*

- [x] **Issue 7.1: Infrastructure** *(PR #58, #60)*
    - [x] 7.1.1: Redis/BullMQ setup unified into API (single-deploy architecture).
    - [x] 7.1.2: Dead Letter Queue (DLQ) for failed jobs.

- [x] **Issue 7.2: Webhook Processing** *(PR #20, #21)*
    - [x] 7.2.1: Airtm webhook processor (Payin/Payout updates).
    - [x] 7.2.2: Trustless Work webhook processor (Escrow status updates).
    - [x] 7.2.3: Deduplication logic using `WebhookEvent` table.

- [x] **Issue 7.3: Scheduled Jobs (Reconciliation & Monitoring)** *(PR #61)*
    - [x] 7.3.1: Reconciliation Job: Cross-check pending TopUps/Withdrawals with Airtm (every 5 min).
    - [x] 7.3.2: Escrow Watcher: Verify Stellar contract state sync with Trustless Work (every 10 min).
    - [x] 7.3.3: Distributed locking to prevent concurrent runs.
    - [x] 7.3.4: Rate limiting and structured metrics logging.

---

## 📦 Phase 8: SDK & Developer Experience (COMPLETED)
*Goal: Provide the "Magic" for marketplace developers.*

- [x] **Issue 8.1: NPM Package `@offerhub/sdk`** *(PR #62)*
    - [x] 8.1.1: Base Ky-powered client with retry logic.
    - [x] 8.1.2: Resource mapping (Users, Orders, TopUps, Balance, Disputes, etc.).
    - [x] 8.1.3: Error typing (Proper instance checking for `InsufficientFundsError`, etc.).
    - [x] 8.1.4: Idempotency support via `withIdempotencyKey()`.
    - [x] 8.1.5: Full TypeScript types and comprehensive documentation.
    - [x] 8.1.6: Publishing guide for NPM release.

- [x] **Issue 8.2: Tooling** *(PR #63)*
    - [x] 8.2.1: CLI tool for API Key management (`offerhub keys create/list/revoke`).
    - [x] 8.2.2: Maintenance mode toggle commands (`offerhub maintenance enable/disable/status`).
    - [x] 8.2.3: Health check command (`offerhub health`).
    - [x] 8.2.4: Interactive configuration setup.

---

## 🏁 Phase 9: Final Polish & QA
- [x] 9.1: Comprehensive E2E test suite (API -> DB -> Worker).
- [x] 9.2: Rate limiting implementation (Redis-based, configurable).
- [ ] 9.3: Load testing suite (100+ req/min stress test).
- [ ] 9.4: Installer script `npm create offer-hub-orchestrator@latest`.
- [x] 9.5: Production deployment guide finalized (`docs/deployment/`).

---

## 🔄 Phase 10: Crypto-Native Provider (IN PROGRESS)
*Goal: Add crypto-native payment provider using invisible Stellar wallets, while keeping AirTM code intact for future use.*

**Status:** 🟢 Active Development (Decision: 2026-02-16)
**Approach:** Strategy Pattern -- NOT deleting AirTM, abstracting with `PaymentProvider` interface
**Documentation:** See [docs/crypto-native/](./docs/crypto-native/) for full plan and architecture.

### Context
- **Problem:** AirTM API requires Enterprise status (5k+ txns/month, $30k+/month) -- not viable
- **Decision:** Build crypto-native provider as default, keep AirTM as switchable alternative
- **Wallet Strategy:** Invisible wallets (server-side Stellar keypairs, AES-256-GCM encrypted)
- **Impact:** No code deletion. New provider + interface + wallet module added alongside existing code.

### Phase 10.1: Foundation (1-2 days) — [Issue #74](https://github.com/OFFER-HUB/OFFER-HUB/issues/74)

- [ ] **10.1.1:** Create `PaymentProvider` interface (Strategy Pattern)
- [ ] **10.1.2:** Create `CryptoNativeProvider` implementing the interface
- [ ] **10.1.3:** Create `PaymentProviderModule` with config-based factory injection
- [ ] **10.1.4:** Implement AES-256-GCM crypto utilities (`apps/api/src/utils/crypto.ts`)
- [ ] **10.1.5:** Database migration: new `Wallet` table (separate from User, supports multiple wallets)
- [ ] **10.1.6:** Add env vars: `PAYMENT_PROVIDER`, `WALLET_ENCRYPTION_KEY`
- [ ] **10.1.7:** Update `.env.example` (AirTM vars marked optional, new vars added)

### Phase 10.2: Wallet Module (2-3 days) — [Issue #75](https://github.com/OFFER-HUB/OFFER-HUB/issues/75)

- [ ] **10.2.1:** Implement `WalletService` (create, getKeypair, getBalance, signTransaction, sendPayment)
- [ ] **10.2.2:** Implement `WalletController` (GET wallet info, deposit address, transaction history)
- [ ] **10.2.3:** Implement `BlockchainMonitorService` (Horizon streaming, deposit detection, balance credit)
- [ ] **10.2.4:** Implement USDC trustline setup for new accounts
- [ ] **10.2.5:** Implement testnet utilities (friendbot funding)
- [ ] **10.2.6:** Register `WalletModule` in `AppModule`

### Phase 10.3: Service Integration (2-3 days) — [Issue #76](https://github.com/OFFER-HUB/OFFER-HUB/issues/76)

- [ ] **10.3.1:** Update `UsersService` -- auto-create wallet on registration via `PaymentProvider.initializeUser()`
- [ ] **10.3.2:** Update `BalanceService` -- sync from blockchain via `PaymentProvider.getBalance()`
- [ ] **10.3.3:** Update `OrdersService` -- replace `airtmUserId` checks with `PaymentProvider.isUserReady()`
- [ ] **10.3.4:** Update `OrdersService` -- use `PaymentProvider.signEscrowTransaction()` for escrow funding
- [ ] **10.3.5:** Update `ResolutionService` -- use PaymentProvider for crediting on release/refund
- [ ] **10.3.6:** Update reconciliation jobs to use PaymentProvider when `PAYMENT_PROVIDER=crypto`
- [ ] **10.3.7:** Ensure app boots without AirTM env vars when `PAYMENT_PROVIDER=crypto`

### Phase 10.4: SDK, Docs & Testing (2 days) — [Issue #77](https://github.com/OFFER-HUB/OFFER-HUB/issues/77)

- [ ] **10.4.1:** Add `wallet` resource to SDK (getWalletInfo, getDepositAddress, getTransactions)
- [ ] **10.4.2:** Update SDK types (User response includes wallet info)
- [ ] **10.4.3:** Update CLI installer (PAYMENT_PROVIDER selection, optional AirTM creds)
- [ ] **10.4.4:** Update deployment docs (env vars, crypto-native setup)
- [ ] **10.4.5:** Unit tests: WalletService, CryptoNativeProvider, CryptoUtils
- [ ] **10.4.6:** Integration tests: user creation -> wallet -> deposit -> escrow cycle
- [ ] **10.4.7:** Testnet E2E: full escrow flow on Stellar testnet

### Phase 9 Remaining (Parallel)

- [ ] 9.3: Load testing suite (100+ req/min stress test)
- [ ] 9.4: Installer script `npm create offer-hub-orchestrator@latest` (updated for crypto-native)

---

## 📊 Progress Summary

| Phase | Status | Completion |
|-------|--------|------------|
| Phase 0: Foundation | ✅ Complete | 100% |
| Phase 1: Domain & Types | ✅ Complete | 100% |
| Phase 2: Security & Infrastructure | ✅ Complete | 100% |
| Phase 3: External Providers | ✅ Complete | 100% |
| Phase 4: Core Services | ✅ Complete | 100% |
| Phase 5: API Endpoints | ✅ Complete | 100% |
| Phase 6: Observability | ✅ Complete | 100% |
| Phase 7: Background Worker | ✅ Complete | 100% |
| Phase 8: SDK & Developer Experience | ✅ Complete | 100% |
| Phase 9: Final Polish & QA | 🟡 In Progress | 60% |
| Phase 10: Crypto-Native Provider | 🟢 Active | 0% |

**Overall Project Status:** ~90% Complete (Phase 10 is the final major milestone)

---

## 🎯 Next Steps

### Immediate (Active)
1. 🟢 **Execute Phase 10.1** -- Foundation (Provider interface, crypto utils, schema migration)
2. 🟢 **Execute Phase 10.2** -- Wallet Module (WalletService, blockchain monitor)
3. 🟢 **Execute Phase 10.3** -- Integration (update existing services to use PaymentProvider)
4. 🟢 **Execute Phase 10.4** -- SDK, docs, testing

### After Phase 10
1. 🔵 **Phase 9 remaining** -- Load testing + installer script
2. 🔵 **AirTM adapter** -- When Enterprise access is available, wrap existing code in PaymentProvider interface
3. 🚀 **Launch crypto-native MVP** -- Deploy on testnet, onboard first users

---

## 📝 Related Documentation

- [Architecture Overview](./docs/architecture/overview.md)
- [API Documentation](./docs/api/README.md)
- [Deployment Guide](./docs/deployment/README.md)
- [SDK Documentation](./packages/sdk/README.md)
- [CLI Documentation](./packages/cli/README.md)
- **[Crypto-Native Plan](./docs/crypto-native/)** -- Strategy, architecture, implementation plan
- [Original Migration Analysis](./CRYPTO_NATIVE_MIGRATION.md) -- Initial analysis (superseded by docs/crypto-native/)
