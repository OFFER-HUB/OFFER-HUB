#!/usr/bin/env tsx
/**
 * OFFER-HUB Orchestrator Bootstrap Script
 *
 * Creates the platform user + Stellar wallet required for escrow operations.
 * Run this once after migrations, before the first server start.
 *
 * Usage:
 *   npm run bootstrap
 *
 * Idempotent: running twice skips creation if the platform user already exists.
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from monorepo root before any other imports
config({ path: resolve(process.cwd(), '.env') });

import { PrismaClient } from '@prisma/client';
import {
    Keypair,
    Horizon,
    TransactionBuilder,
    Networks,
    Operation,
    Asset,
    BASE_FEE,
} from '@stellar/stellar-sdk';
import { encrypt } from '../apps/api/src/utils/crypto';
import { generateUserId, generateWalletId } from '@offerhub/shared';

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_EXTERNAL_USER_ID = 'offerhub-platform';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fundTestAccount(publicKey: string): Promise<void> {
    console.log(`  → Funding testnet account via Friendbot: ${publicKey}`);
    const response = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Friendbot failed (${response.status}): ${body}`);
    }
    console.log('  ✓ Testnet account funded');
}

async function setupUsdcTrustline(
    keypair: Keypair,
    horizonUrl: string,
    usdcCode: string,
    usdcIssuer: string,
): Promise<void> {
    const server = new Horizon.Server(horizonUrl);
    const account = await server.loadAccount(keypair.publicKey());
    const usdcAsset = new Asset(usdcCode, usdcIssuer);

    const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
    })
        .addOperation(Operation.changeTrust({ asset: usdcAsset }))
        .setTimeout(30)
        .build();

    tx.sign(keypair);

    const result = await server.submitTransaction(tx);
    const hash = (result as { hash: string }).hash;
    console.log(`  ✓ USDC trustline established (tx: ${hash})`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('\n🚀 OFFER-HUB Orchestrator Bootstrap\n');

    // Validate required env vars
    const walletEncryptionKey = process.env.WALLET_ENCRYPTION_KEY;
    if (!walletEncryptionKey) {
        console.error('❌ WALLET_ENCRYPTION_KEY is not set.');
        console.error(
            '   Generate one: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
        );
        process.exit(1);
    }

    const horizonUrl = process.env.STELLAR_HORIZON_URL ?? 'https://horizon-testnet.stellar.org';
    const stellarNetwork = process.env.STELLAR_NETWORK ?? 'testnet';
    const usdcCode = process.env.STELLAR_USDC_ASSET_CODE ?? 'USDC';
    const usdcIssuer =
        process.env.STELLAR_USDC_ISSUER ??
        'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

    const prisma = new PrismaClient();

    try {
        // ── 1. Check if platform user already exists ────────────────────────
        const existing = await prisma.user.findUnique({
            where: { externalUserId: PLATFORM_EXTERNAL_USER_ID },
            include: { wallets: { where: { isActive: true } } },
        });

        if (existing) {
            console.log('✓ Platform user already exists — skipping creation.\n');
            console.log('─────────────────────────────────────────────');
            console.log(`PLATFORM_USER_ID=${existing.id}`);
            console.log('─────────────────────────────────────────────\n');
            console.log('Copy the line above into your .env file.\n');
            return;
        }

        // ── 2. Create platform user + balance ───────────────────────────────
        console.log('Creating platform user...');
        const userId = generateUserId();

        await prisma.$transaction(async (tx) => {
            await tx.user.create({
                data: {
                    id: userId,
                    externalUserId: PLATFORM_EXTERNAL_USER_ID,
                    email: null,
                    type: 'BOTH',
                    status: 'ACTIVE',
                },
            });

            await tx.balance.create({
                data: {
                    userId,
                    available: '0.00',
                    reserved: '0.00',
                    currency: 'USD',
                },
            });
        });

        console.log(`  ✓ Platform user created: ${userId}`);

        // ── 3. Generate Stellar keypair + wallet ────────────────────────────
        console.log('\nGenerating Stellar wallet...');
        const keypair = Keypair.random();
        const publicKey = keypair.publicKey();
        const secretEncrypted = encrypt(keypair.secret());

        await prisma.wallet.create({
            data: {
                id: generateWalletId(),
                userId,
                publicKey,
                secretEncrypted,
                type: 'INVISIBLE',
                provider: 'STELLAR',
                isPrimary: true,
                isActive: true,
            },
        });

        console.log(`  ✓ Wallet created: ${publicKey}`);

        // ── 4. Fund + trustline on testnet ──────────────────────────────────
        if (stellarNetwork === 'testnet') {
            console.log('\nSetting up testnet funding + USDC trustline...');
            try {
                await fundTestAccount(publicKey);
                await setupUsdcTrustline(keypair, horizonUrl, usdcCode, usdcIssuer);
            } catch (err) {
                console.warn(
                    `  ⚠ Testnet setup failed: ${err instanceof Error ? err.message : err}`,
                );
                console.warn('    The wallet was created. Fund it manually if needed.');
            }
        } else {
            console.log(
                '\n⚠  Mainnet detected — skipping Friendbot. Fund the wallet manually:',
            );
            console.log(`   Address: ${publicKey}`);
            console.log('   Required: XLM (minimum reserve) + USDC trustline');
        }

        // ── 5. Output result ────────────────────────────────────────────────
        console.log('\n✅ Bootstrap complete!\n');
        console.log('─────────────────────────────────────────────');
        console.log(`PLATFORM_USER_ID=${userId}`);
        console.log('─────────────────────────────────────────────\n');
        console.log('Add the line above to your .env file, then start the server.\n');
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((err) => {
    console.error('\n❌ Bootstrap failed:', err instanceof Error ? err.message : err);
    process.exit(1);
});
