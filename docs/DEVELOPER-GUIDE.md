# Developer Guide

Complete guide for developers working with the OfferHub Orchestrator.

## 🎯 Overview

The OfferHub Orchestrator is a self-hosted payment and escrow backend for marketplaces. It handles user balances, USDC escrow on Stellar (via Trustless Work), and withdrawals. It does NOT provide a UI or user authentication — those belong to your marketplace. The Orchestrator is server-to-server: your backend calls it with an API key.

Components:
- **API** — RESTful API on port **4000** (NestJS)
- **SDK** — TypeScript SDK for easy integration (`@offerhub/sdk`)
- **Worker** — Background jobs integrated into the API (BullMQ + Redis)
- **Database** — PostgreSQL with Prisma ORM (Supabase recommended)

---

## 📚 Documentation Structure

### For Marketplace Developers (Start Here)

1. **[Marketplace Integration Guide](./guides/marketplace-integration.md)** — Complete guide: prerequisites, quick start, all flow guides with curl + SDK examples
2. **[SDK Integration Guide](./sdk/integration-guide.md)** — Detailed SDK usage
3. **[SDK README](../packages/sdk/README.md)** — SDK API reference with examples
4. **[API Documentation](./api/overview.md)** — REST API endpoints and reference
5. **[Error Handling](./api/errors.md)** — Understanding and handling errors

### For Operators & Admins

1. **[CLI Quick Reference](./cli/quick-reference.md)** - Command-line tool usage
2. **[CLI README](../packages/cli/README.md)** - Complete CLI documentation
3. **[Deployment Guide](./deployment/README.md)** - Production deployment
4. **[Monitoring](./deployment/monitoring.md)** - Observability and alerts

### For Contributors

1. **[Architecture Overview](./architecture/README.md)** - System architecture
2. **[State Machines](./architecture/state-machines.md)** - Order and payment flows
3. **[Contributing Guide](../CONTRIBUTING.md)** - How to contribute
4. **[AI Development Standards](../AI.md)** - Development with AI assistance

---

## 🚀 Quick Start

### 1. Development Setup

\`\`\`bash
# Clone repository
git clone https://github.com/OFFER-HUB/OFFER-HUB.git
cd OFFER-HUB

# Install dependencies
npm install

# Setup database
npm run prisma:generate
npm run prisma:migrate

# Start development server
npm run dev
\`\`\`

### 2. Using the SDK

\`\`\`typescript
import { OfferHubSDK } from '@offerhub/sdk';

const sdk = new OfferHubSDK({
  apiUrl: 'http://localhost:4000',
  apiKey: process.env.OFFERHUB_API_KEY
});

// Create a user
const user = await sdk.users.create({
  externalUserId: 'user_123',
  email: 'user@example.com',
  type: 'BUYER'
});

// Create an order
const order = await sdk.orders.create({
  buyer_id: user.id,
  seller_id: 'usr_seller',
  amount: '100.00',
  title: 'Logo Design'
});
\`\`\`

### 3. Using the CLI

\`\`\`bash
# Configure CLI
offerhub config set

# Create API key
offerhub keys create --user-id usr_admin --scopes read,write

# Enable maintenance mode
offerhub maintenance enable --message "Upgrading database"
\`\`\`

---

## 🏗️ Architecture

### System Components

\`\`\`
┌─────────────────────────────────────────────────────────┐
│                    Marketplace App                      │
│              (Your Frontend Application)                │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ Uses SDK
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  @offerhub/sdk                          │
│            (TypeScript SDK Package)                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ HTTP/REST
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   OfferHub API                          │
│         (NestJS REST API + Background Jobs)             │
├─────────────────────────────────────────────────────────┤
│  • Auth & Security                                      │
│  • Order Management                                     │
│  • Balance Operations                                   │
│  • Escrow Contracts                                     │
│  • Dispute Resolution                                   │
│  • Background Jobs (BullMQ)                             │
└────┬──────────────┬─────────────────┬──────────────────┘
     │              │                 │
     ▼              ▼                 ▼
┌─────────┐  ┌─────────────┐  ┌─────────────────┐
│PostgreSQL│  │    Redis    │  │External Providers│
│ (Prisma)│  │   (Cache +  │  │• Airtm (Payments)│
│         │  │    Queue)   │  │• Trustless Work  │
│         │  │             │  │  (Blockchain)    │
└─────────┘  └─────────────┘  └─────────────────┘
\`\`\`

### Order Flow

\`\`\`
1. Create Order        → ORDER_CREATED
2. Reserve Funds       → FUNDS_RESERVED
3. Create Escrow       → ESCROW_CREATED
4. Fund Escrow         → ESCROW_FUNDED
5. Complete Milestones → IN_PROGRESS
6. Release/Refund      → COMPLETED/RELEASED/REFUNDED
\`\`\`

See [State Machines](./architecture/state-machines.md) for detailed flows.

---

## 🔧 Development Workflow

### Making Changes

1. **Create a Branch**
   \`\`\`bash
   git checkout -b feat/your-feature
   \`\`\`

2. **Make Changes**
   - Follow [AI Development Standards](../AI.md)
   - Write tests for new features
   - Update documentation

3. **Build & Test**
   \`\`\`bash
   npm run build
   npm run test
   \`\`\`

4. **Commit**
   \`\`\`bash
   git add .
   git commit -m "feat(api): add new feature"
   \`\`\`

5. **Push & Create PR**
   \`\`\`bash
   git push -u origin feat/your-feature
   gh pr create
   \`\`\`

### Working with Packages

The project uses a monorepo structure:

\`\`\`
packages/
├── sdk/        # TypeScript SDK for marketplace integration
├── cli/        # Command-line tool for administration
├── shared/     # Shared types and utilities
└── database/   # Prisma schema and migrations

apps/
└── api/        # Main API application (includes worker)
\`\`\`

To work on a specific package:

\`\`\`bash
# Build SDK
npm run build --workspace=packages/sdk

# Run CLI in dev mode
npm run dev --workspace=packages/cli

# Run API
npm run dev --workspace=apps/api
\`\`\`

---

## 📦 Publishing

### SDK to NPM

See [Publishing Guide](./sdk/publishing-guide.md) for detailed instructions.

Quick version:
\`\`\`bash
cd packages/sdk
npm version patch  # or minor, major
npm publish --access public
\`\`\`

### CLI to NPM

\`\`\`bash
cd packages/cli
npm version patch
npm publish --access public
\`\`\`

---

## 🧪 Testing

### Unit Tests

\`\`\`bash
npm run test
\`\`\`

### Integration Tests

\`\`\`bash
npm run test:integration
\`\`\`

### E2E Tests

\`\`\`bash
npm run test:e2e
\`\`\`

### Coverage

\`\`\`bash
npm run test:coverage
\`\`\`

---

## 🐛 Debugging

### API Debugging

\`\`\`bash
# Enable debug logs
DEBUG=offerhub:* npm run dev

# Or in your .env
LOG_LEVEL=debug
\`\`\`

### SDK Debugging

The SDK automatically retries failed requests. To debug:

\`\`\`typescript
const sdk = new OfferHubSDK({
  apiUrl: 'http://localhost:3000',
  apiKey: process.env.OFFERHUB_API_KEY,
  timeout: 60000,        // Increase timeout
  retryAttempts: 0,      // Disable retries for debugging
});
\`\`\`

### CLI Debugging

\`\`\`bash
# Show detailed errors
offerhub keys list --verbose

# Or set environment variable
DEBUG=offerhub:cli offerhub keys list
\`\`\`

---

## 🔐 Security

### API Keys

- Never commit API keys to git
- Use environment variables
- Rotate keys regularly
- Use scoped keys (read/write/support)

### Best Practices

1. **Always use HTTPS** in production
2. **Validate user input** on the server
3. **Implement rate limiting** (built-in)
4. **Monitor for suspicious activity**
5. **Keep dependencies updated**

---

## 📊 Monitoring

### Health Checks

\`\`\`bash
# API health
curl http://localhost:3000/health

# CLI check
offerhub maintenance status
\`\`\`

### Metrics

The API exposes Prometheus metrics at \`/metrics\`.

### Logging

All operations are logged with structured JSON:

\`\`\`json
{
  "level": "info",
  "timestamp": "2026-02-05T12:00:00.000Z",
  "message": "Order created",
  "orderId": "ord_abc123",
  "userId": "usr_buyer123"
}
\`\`\`

---

## 🆘 Support

### Documentation

- [Full Documentation](./README.md)
- [API Reference](./api/README.md)
- [SDK Guide](./sdk/integration-guide.md)
- [CLI Guide](./cli/quick-reference.md)

### Community

- [GitHub Issues](https://github.com/OFFER-HUB/OFFER-HUB/issues)
- [GitHub Discussions](https://github.com/OFFER-HUB/OFFER-HUB/discussions)

### Professional Support

Contact: support@offerhub.com

---

## 📝 License

MIT License - see [LICENSE](../LICENSE) for details.

---

## 🙏 Contributing

We welcome contributions! See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

### Areas for Contribution

- 🐛 Bug fixes
- ✨ New features
- 📚 Documentation improvements
- 🧪 Test coverage
- 🌍 Translations
- 🎨 UI/UX improvements (for future dashboard)

---

## 🗺️ Roadmap

See [ROADMAP.md](../ROADMAP.md) for planned features and progress.

### Completed

- ✅ Phase 0-7: Core functionality
- ✅ SDK implementation
- ✅ CLI tool

### In Progress

- 🚧 Phase 8: Developer tooling
- 🚧 Phase 9: Final polish & QA

### Planned

- 📅 Web dashboard
- 📅 Mobile SDKs (iOS/Android)
- 📅 More payment providers
- 📅 Advanced analytics
