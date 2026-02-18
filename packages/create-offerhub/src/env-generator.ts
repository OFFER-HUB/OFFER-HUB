export interface EnvConfig {
    port: number;
    databaseUrl: string;
    redisUrl: string;
    masterKey: string;
    paymentProvider: 'crypto' | 'airtm';
    walletEncryptionKey?: string;
    stellarNetwork: 'testnet' | 'mainnet';
    trustlessApiKey: string;
    trustlessWebhookSecret: string;
    publicBaseUrl: string;
    airtmApiKey?: string;
    airtmApiSecret?: string;
    airtmWebhookSecret?: string;
}

const STELLAR_CONFIG = {
    testnet: {
        horizonUrl: 'https://horizon-testnet.stellar.org',
        usdcIssuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
        trustlessApiUrl: 'https://dev.api.trustlesswork.com',
    },
    mainnet: {
        horizonUrl: 'https://horizon.stellar.org',
        usdcIssuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
        trustlessApiUrl: 'https://api.trustlesswork.com',
    },
} as const;

export function generateEnvFile(config: EnvConfig): string {
    const stellar = STELLAR_CONFIG[config.stellarNetwork];
    const lines: string[] = [];

    lines.push('# ============================================');
    lines.push('# OFFER-HUB Orchestrator Configuration');
    lines.push(`# Generated on ${new Date().toISOString()}`);
    lines.push('# ============================================');
    lines.push('');

    // Server
    lines.push('# Server');
    lines.push('NODE_ENV=development');
    lines.push(`PORT=${config.port}`);
    lines.push(`DATABASE_URL=${config.databaseUrl}`);
    lines.push(`REDIS_URL=${config.redisUrl}`);
    lines.push('');

    // Payment Provider
    lines.push('# Payment Provider');
    lines.push(`PAYMENT_PROVIDER=${config.paymentProvider}`);
    lines.push('');

    // Wallet Encryption (crypto mode)
    if (config.paymentProvider === 'crypto' && config.walletEncryptionKey) {
        lines.push('# Wallet Encryption (AES-256-GCM)');
        lines.push(`WALLET_ENCRYPTION_KEY=${config.walletEncryptionKey}`);
        lines.push('');
    }

    // Auth
    lines.push('# Marketplace Auth');
    lines.push(`OFFERHUB_MASTER_KEY=${config.masterKey}`);
    lines.push('');

    // AirTM (if applicable)
    if (config.paymentProvider === 'airtm') {
        lines.push('# AirTM');
        lines.push('AIRTM_ENV=sandbox');
        lines.push(`AIRTM_API_KEY=${config.airtmApiKey || ''}`);
        lines.push(`AIRTM_API_SECRET=${config.airtmApiSecret || ''}`);
        lines.push(`AIRTM_WEBHOOK_SECRET=${config.airtmWebhookSecret || ''}`);
        lines.push('');
    }

    // Trustless Work
    lines.push('# Trustless Work');
    lines.push(`TRUSTLESS_API_KEY=${config.trustlessApiKey}`);
    lines.push(`TRUSTLESS_API_URL=${stellar.trustlessApiUrl}`);
    lines.push(`TRUSTLESS_WEBHOOK_SECRET=${config.trustlessWebhookSecret}`);
    lines.push('TRUSTLESS_TIMEOUT_MS=60000');
    lines.push('');

    // Stellar
    lines.push('# Stellar');
    lines.push(`STELLAR_NETWORK=${config.stellarNetwork}`);
    lines.push(`STELLAR_HORIZON_URL=${stellar.horizonUrl}`);
    lines.push('STELLAR_USDC_ASSET_CODE=USDC');
    lines.push(`STELLAR_USDC_ISSUER=${stellar.usdcIssuer}`);
    lines.push('');

    // Platform Identity
    lines.push('# Platform Identity (run: npm run bootstrap → paste the output here)');
    lines.push('PLATFORM_USER_ID=');
    lines.push('');

    // Public URL
    lines.push('# Public URL (for webhooks)');
    lines.push(`PUBLIC_BASE_URL=${config.publicBaseUrl}`);
    lines.push('');

    return lines.join('\n');
}
