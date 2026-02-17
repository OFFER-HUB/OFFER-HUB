import { execSync } from 'child_process';
import { join } from 'path';

const COMPOSE_FILE = join(__dirname, 'docker-compose.e2e.yml');

export default async function globalSetup() {
    console.log('\n🐳 Starting E2E Docker containers...');

    // Start containers
    execSync(`docker compose -f ${COMPOSE_FILE} up -d --wait`, {
        stdio: 'inherit',
    });

    // Set env vars for the test process
    process.env.DATABASE_URL = 'postgresql://e2e_user:e2e_password@localhost:5433/offerhub_e2e';
    process.env.DIRECT_URL = 'postgresql://e2e_user:e2e_password@localhost:5433/offerhub_e2e';
    process.env.REDIS_URL = 'redis://localhost:6380';
    process.env.NODE_ENV = 'test';
    process.env.PORT = '4001';
    process.env.PAYMENT_PROVIDER = 'crypto';
    process.env.WALLET_ENCRYPTION_KEY = require('crypto').randomBytes(32).toString('hex');
    process.env.OFFERHUB_MASTER_KEY = 'e2e_master_key_for_testing_only';
    process.env.STELLAR_NETWORK = 'testnet';
    process.env.STELLAR_HORIZON_URL = 'https://horizon-testnet.stellar.org';
    process.env.STELLAR_USDC_ASSET_CODE = 'USDC';
    process.env.STELLAR_USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
    process.env.TRUSTLESS_API_KEY = 'e2e_test_trustless_key';
    process.env.TRUSTLESS_WEBHOOK_SECRET = 'e2e_test_webhook_secret';
    process.env.TRUSTLESS_API_URL = 'https://dev.api.trustlesswork.com';

    // Airtm dummy credentials (required by AirtmConfig even in crypto mode)
    process.env.AIRTM_API_KEY = process.env.AIRTM_API_KEY || 'e2e_dummy_airtm_key';
    process.env.AIRTM_API_SECRET = process.env.AIRTM_API_SECRET || 'e2e_dummy_airtm_secret';
    process.env.PUBLIC_BASE_URL = 'http://localhost:4001';

    // Run Prisma migrations
    console.log('📦 Running database migrations...');
    execSync(
        'npx prisma migrate deploy --schema packages/database/prisma/schema.prisma',
        { stdio: 'inherit', env: process.env },
    );

    // Generate Prisma client
    execSync(
        'npx prisma generate --schema packages/database/prisma/schema.prisma',
        { stdio: 'pipe', env: process.env },
    );

    console.log('✅ E2E environment ready\n');
}
