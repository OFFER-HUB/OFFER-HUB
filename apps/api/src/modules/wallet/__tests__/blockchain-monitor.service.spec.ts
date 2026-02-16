import { Test, TestingModule } from '@nestjs/testing';
import { BlockchainMonitorService } from '../blockchain-monitor.service';
import { PrismaService } from '../../database/prisma.service';
import { TrustlessWorkConfig } from '../../../providers/trustless-work/trustless-work.config';
import { EventBusService } from '../../events/event-bus.service';

// Mock Stellar SDK
const mockStream = jest.fn().mockReturnValue(jest.fn()); // Returns close function

jest.mock('@stellar/stellar-sdk', () => ({
    Horizon: {
        Server: jest.fn().mockImplementation(() => ({
            payments: jest.fn(() => ({
                forAccount: jest.fn().mockReturnThis(),
                cursor: jest.fn().mockReturnThis(),
                stream: mockStream,
            })),
        })),
    },
}));

const createMockPrisma = () => ({
    wallet: {
        findMany: jest.fn().mockResolvedValue([]),
    },
    balance: {
        findFirst: jest.fn(),
        update: jest.fn(),
    },
});

const createMockStellarConfig = (): Partial<TrustlessWorkConfig> => ({
    stellarHorizonUrl: 'https://horizon-testnet.stellar.org',
    stellarUsdcAssetCode: 'USDC',
    stellarUsdcIssuer: 'ISSUER',
    stellarNetwork: 'testnet',
});

const createMockEventBus = () => ({
    emit: jest.fn(),
});

describe('BlockchainMonitorService', () => {
    let service: BlockchainMonitorService;
    let mockPrisma: ReturnType<typeof createMockPrisma>;
    let mockEventBus: ReturnType<typeof createMockEventBus>;

    beforeEach(async () => {
        jest.clearAllMocks();
        mockPrisma = createMockPrisma();
        mockEventBus = createMockEventBus();

        // Set test env to prevent onModuleInit from auto-starting
        process.env.NODE_ENV = 'test';

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BlockchainMonitorService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: TrustlessWorkConfig, useValue: createMockStellarConfig() },
                { provide: EventBusService, useValue: mockEventBus },
            ],
        }).compile();

        service = module.get<BlockchainMonitorService>(BlockchainMonitorService);
    });

    describe('onModuleInit', () => {
        it('should skip monitoring in test environment', async () => {
            await service.onModuleInit();
            expect(mockPrisma.wallet.findMany).not.toHaveBeenCalled();
        });
    });

    describe('startMonitoringAllWallets', () => {
        it('should start monitoring all active wallets', async () => {
            mockPrisma.wallet.findMany.mockResolvedValueOnce([
                { userId: 'usr_1', publicKey: 'GKEY1' },
                { userId: 'usr_2', publicKey: 'GKEY2' },
            ]);

            await service.startMonitoringAllWallets();

            expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith({
                where: { isActive: true, type: 'INVISIBLE' },
                select: { userId: true, publicKey: true },
            });
            // stream() should be called for each wallet
            expect(mockStream).toHaveBeenCalledTimes(2);
        });

        it('should handle no wallets gracefully', async () => {
            mockPrisma.wallet.findMany.mockResolvedValueOnce([]);
            await service.startMonitoringAllWallets();
            expect(mockStream).not.toHaveBeenCalled();
        });
    });

    describe('monitorWallet', () => {
        it('should not create duplicate monitors for same wallet', () => {
            service.monitorWallet('usr_1', 'GKEY1');
            service.monitorWallet('usr_1', 'GKEY1');

            // stream() should only be called once for same publicKey
            expect(mockStream).toHaveBeenCalledTimes(1);
        });
    });

    describe('stopMonitoringWallet', () => {
        it('should call the close function for a monitored wallet', () => {
            const closeFn = jest.fn();
            mockStream.mockReturnValueOnce(closeFn);

            service.monitorWallet('usr_1', 'GSTOP_KEY');
            service.stopMonitoringWallet('GSTOP_KEY');

            expect(closeFn).toHaveBeenCalled();
        });

        it('should do nothing for unmonitored wallet', () => {
            service.stopMonitoringWallet('GUNKNOWN');
            // No error
        });
    });

    describe('onModuleDestroy', () => {
        it('should stop all streams', () => {
            const closeFn1 = jest.fn();
            const closeFn2 = jest.fn();
            mockStream.mockReturnValueOnce(closeFn1);
            mockStream.mockReturnValueOnce(closeFn2);

            service.monitorWallet('usr_1', 'GKEY1');
            service.monitorWallet('usr_2', 'GKEY2');
            service.onModuleDestroy();

            expect(closeFn1).toHaveBeenCalled();
            expect(closeFn2).toHaveBeenCalled();
        });
    });
});
