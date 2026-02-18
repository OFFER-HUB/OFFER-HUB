import { ReconciliationProcessor } from '../reconciliation.processor';

/**
 * Unit tests for the missed deposit deduplication logic in checkMissedDeposits().
 *
 * These tests use the processor as a plain class (no NestJS DI) and
 * mock only the methods needed to verify deduplication behavior.
 */

const mockPrisma = () => ({
    wallet: {
        findMany: jest.fn(),
    },
    balance: {
        findFirst: jest.fn(),
        update: jest.fn(),
    },
    processedTransaction: {
        findUnique: jest.fn(),
        create: jest.fn(),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
});

const mockStellarConfig = () => ({
    stellarHorizonUrl: 'https://horizon-testnet.stellar.org',
    stellarUsdcAssetCode: 'USDC',
    stellarUsdcIssuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    isTestnet: () => true,
    isMainnet: () => false,
});

const mockEventBus = () => ({ emit: jest.fn() });

const mockPayment = (overrides: Record<string, unknown> = {}) => ({
    type: 'payment',
    to: 'GWALLETPUBKEY',
    asset_code: 'USDC',
    asset_issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    transaction_hash: 'tx_abc123',
    amount: '50.00',
    created_at: new Date().toISOString(),
    ...overrides,
});

// Build a minimal processor instance without NestJS
function buildProcessor(prisma: ReturnType<typeof mockPrisma>, eventBus: ReturnType<typeof mockEventBus>) {
    const mockHorizonServer = {
        payments: jest.fn().mockReturnValue({
            forAccount: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            call: jest.fn().mockResolvedValue({ records: [] }),
        }),
    };

    const processor = Object.create(ReconciliationProcessor.prototype);
    Object.assign(processor, {
        prisma,
        eventBus,
        stellarConfig: mockStellarConfig(),
        horizonServer: mockHorizonServer,
        logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    });

    return { processor, mockHorizonServer };
}

describe('ReconciliationProcessor.checkMissedDeposits() — deduplication', () => {
    let prisma: ReturnType<typeof mockPrisma>;
    let eventBus: ReturnType<typeof mockEventBus>;

    const defaultConfig = { batchSize: 100, rateLimitDelay: 0, staleThreshold: 0 };
    const defaultMetrics = { jobType: 'test', startTime: 0, recordsProcessed: 0, recordsSynced: 0, errors: 0, discrepancies: 0 };

    beforeEach(() => {
        jest.clearAllMocks();
        prisma = mockPrisma();
        eventBus = mockEventBus();
    });

    it('skips payment already in ProcessedTransaction', async () => {
        const { processor, mockHorizonServer } = buildProcessor(prisma, eventBus);

        prisma.wallet.findMany.mockResolvedValue([{ userId: 'usr_1', publicKey: 'GWALLETPUBKEY' }]);
        mockHorizonServer.payments().call.mockResolvedValue({ records: [mockPayment()] });
        prisma.processedTransaction.findUnique.mockResolvedValue({ id: 'existing' }); // already processed

        const metrics = { ...defaultMetrics };
        await processor.checkMissedDeposits(defaultConfig, metrics);

        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(eventBus.emit).not.toHaveBeenCalled();
        expect(metrics.recordsSynced).toBe(0);
    });

    it('credits balance and creates ProcessedTransaction for new payment', async () => {
        const { processor, mockHorizonServer } = buildProcessor(prisma, eventBus);

        prisma.wallet.findMany.mockResolvedValue([{ userId: 'usr_1', publicKey: 'GWALLETPUBKEY' }]);
        mockHorizonServer.payments().call.mockResolvedValue({ records: [mockPayment()] });
        prisma.processedTransaction.findUnique.mockResolvedValue(null); // not yet processed
        prisma.balance.findFirst.mockResolvedValue({ id: 'bal_1', available: '100.00' });

        const metrics = { ...defaultMetrics };
        await processor.checkMissedDeposits(defaultConfig, metrics);

        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(eventBus.emit).toHaveBeenCalledWith(
            expect.objectContaining({
                payload: expect.objectContaining({
                    source: 'stellar_deposit_reconciled',
                    transactionHash: 'tx_abc123',
                    amount: '50.00',
                }),
            }),
        );
        expect(metrics.recordsSynced).toBe(1);
    });

    it('skips non-USDC payments', async () => {
        const { processor, mockHorizonServer } = buildProcessor(prisma, eventBus);

        prisma.wallet.findMany.mockResolvedValue([{ userId: 'usr_1', publicKey: 'GWALLETPUBKEY' }]);
        mockHorizonServer.payments().call.mockResolvedValue({
            records: [mockPayment({ asset_code: 'XLM', asset_issuer: '' })],
        });
        prisma.processedTransaction.findUnique.mockResolvedValue(null);

        const metrics = { ...defaultMetrics };
        await processor.checkMissedDeposits(defaultConfig, metrics);

        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(metrics.recordsSynced).toBe(0);
    });

    it('skips payments outside the lookback window', async () => {
        const { processor, mockHorizonServer } = buildProcessor(prisma, eventBus);

        const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(); // 48h ago
        prisma.wallet.findMany.mockResolvedValue([{ userId: 'usr_1', publicKey: 'GWALLETPUBKEY' }]);
        mockHorizonServer.payments().call.mockResolvedValue({
            records: [mockPayment({ created_at: oldDate })],
        });
        prisma.processedTransaction.findUnique.mockResolvedValue(null);

        const metrics = { ...defaultMetrics };
        // lookbackHours = 24, but payment is 48h old
        await processor.checkMissedDeposits({ ...defaultConfig, lookbackHours: 24 } as any, metrics);

        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(metrics.recordsSynced).toBe(0);
    });

    it('handles Horizon 404 gracefully (unfunded account)', async () => {
        const { processor, mockHorizonServer } = buildProcessor(prisma, eventBus);

        prisma.wallet.findMany.mockResolvedValue([{ userId: 'usr_1', publicKey: 'GWALLETPUBKEY' }]);
        mockHorizonServer.payments().call.mockRejectedValue(new Error('Request failed with status 404'));

        const metrics = { ...defaultMetrics };
        await expect(processor.checkMissedDeposits(defaultConfig, metrics)).resolves.not.toThrow();
        expect(metrics.errors).toBe(0); // 404 is NOT counted as error
    });

    it('logs summary with wallet count and missed deposit count', async () => {
        const { processor, mockHorizonServer } = buildProcessor(prisma, eventBus);

        prisma.wallet.findMany.mockResolvedValue([
            { userId: 'usr_1', publicKey: 'GWALLET1' },
            { userId: 'usr_2', publicKey: 'GWALLET2' },
        ]);
        mockHorizonServer.payments().call.mockResolvedValue({ records: [] });

        const metrics = { ...defaultMetrics };
        await processor.checkMissedDeposits(defaultConfig, metrics);

        expect(metrics.recordsProcessed).toBe(2);
        expect(processor.logger.log).toHaveBeenCalledWith(
            expect.stringContaining('Checked 2 wallets'),
        );
    });
});
