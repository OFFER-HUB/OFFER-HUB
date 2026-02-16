import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WalletService } from '../wallet.service';
import { PrismaService } from '../../database/prisma.service';
import { TrustlessWorkConfig } from '../../../providers/trustless-work/trustless-work.config';

// Mock Stellar SDK
jest.mock('@stellar/stellar-sdk', () => {
    const mockKeypair = {
        publicKey: () => 'GABCDEF_PUBLIC_KEY',
        secret: () => 'STEST_SECRET_KEY',
        sign: jest.fn(),
    };

    return {
        Keypair: {
            random: jest.fn(() => mockKeypair),
            fromSecret: jest.fn(() => mockKeypair),
        },
        Horizon: {
            Server: jest.fn().mockImplementation(() => ({
                loadAccount: jest.fn().mockResolvedValue({
                    balances: [
                        { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: 'ISSUER', balance: '100.0000000' },
                        { asset_type: 'native', balance: '5.0000000' },
                    ],
                    accountId: jest.fn(() => 'GABCDEF_PUBLIC_KEY'),
                    sequenceNumber: jest.fn(() => '123'),
                    sequence: '123',
                    incrementSequenceNumber: jest.fn(),
                }),
                payments: jest.fn(() => ({
                    forAccount: jest.fn().mockReturnThis(),
                    limit: jest.fn().mockReturnThis(),
                    order: jest.fn().mockReturnThis(),
                    call: jest.fn().mockResolvedValue({
                        records: [
                            {
                                id: 'pay_1',
                                type: 'payment',
                                from: 'GSENDER',
                                to: 'GABCDEF_PUBLIC_KEY',
                                amount: '50.00',
                                asset_code: 'USDC',
                                asset_issuer: 'ISSUER',
                                created_at: '2026-01-01T00:00:00Z',
                                transaction_hash: 'tx_hash_1',
                                transaction_successful: true,
                            },
                        ],
                    }),
                })),
                submitTransaction: jest.fn().mockResolvedValue({ hash: 'tx_hash_submit' }),
            })),
        },
        TransactionBuilder: jest.fn().mockImplementation(() => ({
            addOperation: jest.fn().mockReturnThis(),
            setTimeout: jest.fn().mockReturnThis(),
            build: jest.fn().mockReturnValue({
                sign: jest.fn(),
                toXDR: jest.fn(() => 'signed-xdr'),
            }),
        })),
        Networks: { TESTNET: 'Test SDF Network ; September 2015', PUBLIC: 'Public Global Stellar Network ; September 2015' },
        Operation: { payment: jest.fn(), changeTrust: jest.fn() },
        Asset: jest.fn(),
        BASE_FEE: '100',
    };
});

// Mock crypto utils
jest.mock('../../../utils/crypto', () => ({
    encrypt: jest.fn((text: string) => `encrypted:${text}`),
    decrypt: jest.fn((text: string) => text.replace('encrypted:', '')),
}));

// Mock testnet utils
jest.mock('../testnet.utils', () => ({
    fundTestAccount: jest.fn().mockResolvedValue(undefined),
    setupTestTrustline: jest.fn().mockResolvedValue(undefined),
}));

// Mock shared
jest.mock('@offerhub/shared', () => ({
    generateWalletId: jest.fn(() => 'wal_test123'),
}));

const createMockPrisma = () => ({
    wallet: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
    },
});

const createMockStellarConfig = (): Partial<TrustlessWorkConfig> => ({
    stellarHorizonUrl: 'https://horizon-testnet.stellar.org',
    stellarUsdcAssetCode: 'USDC',
    stellarUsdcIssuer: 'ISSUER',
    stellarNetwork: 'testnet',
    isTestnet: jest.fn(() => true) as any,
});

describe('WalletService', () => {
    let service: WalletService;
    let mockPrisma: ReturnType<typeof createMockPrisma>;
    let mockConfig: ReturnType<typeof createMockStellarConfig>;

    beforeEach(async () => {
        mockPrisma = createMockPrisma();
        mockConfig = createMockStellarConfig();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WalletService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: TrustlessWorkConfig, useValue: mockConfig },
            ],
        }).compile();

        service = module.get<WalletService>(WalletService);
    });

    describe('createWallet', () => {
        it('should return existing wallet if user already has one', async () => {
            mockPrisma.wallet.findFirst.mockResolvedValueOnce({
                publicKey: 'GEXISTING',
                isActive: true,
            });

            const result = await service.createWallet('usr_123');
            expect(result.publicKey).toBe('GEXISTING');
            expect(mockPrisma.wallet.create).not.toHaveBeenCalled();
        });

        it('should create new wallet when none exists', async () => {
            mockPrisma.wallet.findFirst.mockResolvedValueOnce(null);
            mockPrisma.wallet.create.mockResolvedValueOnce({});

            const result = await service.createWallet('usr_123');

            expect(mockPrisma.wallet.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    id: 'wal_test123',
                    userId: 'usr_123',
                    type: 'INVISIBLE',
                    provider: 'STELLAR',
                    isPrimary: true,
                    isActive: true,
                }),
            });
            expect(result.publicKey).toBe('GABCDEF_PUBLIC_KEY');
        });
    });

    describe('getPrimaryWallet', () => {
        it('should return wallet when found', async () => {
            const wallet = { id: 'wal_1', publicKey: 'GTEST', userId: 'usr_1' };
            mockPrisma.wallet.findFirst.mockResolvedValueOnce(wallet);

            const result = await service.getPrimaryWallet('usr_1');
            expect(result).toEqual(wallet);
        });

        it('should throw NotFoundException when no wallet found', async () => {
            mockPrisma.wallet.findFirst.mockResolvedValueOnce(null);

            await expect(service.getPrimaryWallet('usr_missing')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('getBalance', () => {
        it('should return USDC and XLM balances', async () => {
            mockPrisma.wallet.findFirst.mockResolvedValueOnce({
                publicKey: 'GTEST',
                isActive: true,
                isPrimary: true,
            });

            const result = await service.getBalance('usr_123');

            expect(result.usdc).toBe('100.0000000');
            expect(result.xlm).toBe('5.0000000');
        });
    });

    describe('getPublicKey', () => {
        it('should return the public key', async () => {
            mockPrisma.wallet.findFirst.mockResolvedValueOnce({
                publicKey: 'GTEST_KEY',
                isActive: true,
                isPrimary: true,
            });

            const result = await service.getPublicKey('usr_123');
            expect(result).toBe('GTEST_KEY');
        });
    });

    describe('getTransactions', () => {
        it('should return formatted transaction history', async () => {
            mockPrisma.wallet.findFirst.mockResolvedValueOnce({
                publicKey: 'GABCDEF_PUBLIC_KEY',
                isActive: true,
                isPrimary: true,
            });

            const result = await service.getTransactions('usr_123', 10);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                id: 'pay_1',
                type: 'payment',
                from: 'GSENDER',
                to: 'GABCDEF_PUBLIC_KEY',
                amount: '50.00',
                asset: 'USDC:ISSUER',
                createdAt: '2026-01-01T00:00:00Z',
                hash: 'tx_hash_1',
                successful: true,
            });
        });
    });
});
