import { Test, TestingModule } from '@nestjs/testing';
import { CryptoNativeProvider } from '../crypto-native.provider';
import { WalletService } from '../../../modules/wallet/wallet.service';

const createMockWalletService = () => ({
    createWallet: jest.fn(),
    getPrimaryWallet: jest.fn(),
    getBalance: jest.fn(),
    getPublicKey: jest.fn(),
    signTransaction: jest.fn(),
    sendPayment: jest.fn(),
});

describe('CryptoNativeProvider', () => {
    let provider: CryptoNativeProvider;
    let walletService: ReturnType<typeof createMockWalletService>;

    beforeEach(async () => {
        walletService = createMockWalletService();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CryptoNativeProvider,
                {
                    provide: WalletService,
                    useValue: walletService,
                },
            ],
        }).compile();

        provider = module.get<CryptoNativeProvider>(CryptoNativeProvider);
    });

    describe('initializeUser', () => {
        it('should create wallet and return payment info', async () => {
            walletService.createWallet.mockResolvedValueOnce({
                publicKey: 'GABCDEF123',
                funded: true,
                trustlineReady: true,
            });

            const result = await provider.initializeUser('usr_123');

            expect(walletService.createWallet).toHaveBeenCalledWith('usr_123');
            expect(result).toEqual({
                provider: 'crypto',
                publicAddress: 'GABCDEF123',
                ready: true,
            });
        });

        it('should return ready=false when not funded or no trustline', async () => {
            walletService.createWallet.mockResolvedValueOnce({
                publicKey: 'GABCDEF123',
                funded: false,
                trustlineReady: false,
            });

            const result = await provider.initializeUser('usr_123');
            expect(result.ready).toBe(false);
        });
    });

    describe('isUserReady', () => {
        it('should return true when wallet exists', async () => {
            walletService.getPrimaryWallet.mockResolvedValueOnce({
                id: 'wal_123', publicKey: 'GABCDEF123',
            } as any);

            const result = await provider.isUserReady('usr_123');
            expect(result).toBe(true);
        });

        it('should return false when no wallet exists', async () => {
            walletService.getPrimaryWallet.mockRejectedValueOnce(
                new Error('No active wallet'),
            );

            const result = await provider.isUserReady('usr_123');
            expect(result).toBe(false);
        });
    });

    describe('getBalance', () => {
        it('should return USDC balance as string', async () => {
            walletService.getBalance.mockResolvedValueOnce({
                usdc: '150.5000000',
                xlm: '10.0000000',
            });

            const result = await provider.getBalance('usr_123');
            expect(result).toBe('150.5000000');
        });
    });

    describe('getDepositInfo', () => {
        it('should return deposit info with stellar address', async () => {
            walletService.getPublicKey.mockResolvedValueOnce('GTEST_PUBLIC_KEY');

            const result = await provider.getDepositInfo('usr_123');

            expect(result.provider).toBe('crypto');
            expect(result.method).toBe('stellar_address');
            expect(result.address).toBe('GTEST_PUBLIC_KEY');
        });
    });

    describe('signEscrowTransaction', () => {
        it('should delegate to walletService.signTransaction', async () => {
            walletService.signTransaction.mockResolvedValueOnce('signed-xdr-result');

            const result = await provider.signEscrowTransaction('usr_123', 'raw-xdr');

            expect(walletService.signTransaction).toHaveBeenCalledWith('usr_123', 'raw-xdr');
            expect(result).toBe('signed-xdr-result');
        });
    });

    describe('sendPayment', () => {
        it('should send payment and return result', async () => {
            walletService.sendPayment.mockResolvedValueOnce({
                hash: 'tx_hash_123',
                status: 'completed',
            });

            const result = await provider.sendPayment('usr_123', 'GDEST', '50.00');

            expect(walletService.sendPayment).toHaveBeenCalledWith('usr_123', 'GDEST', '50.00');
            expect(result).toEqual({
                transactionHash: 'tx_hash_123',
                status: 'completed',
            });
        });
    });
});
