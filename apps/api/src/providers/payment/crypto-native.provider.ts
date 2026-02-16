import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentProvider,
  PaymentUserInfo,
  DepositInfo,
  PaymentResult,
} from './payment-provider.interface';
import { PrismaService } from '../../modules/database/prisma.service';

/**
 * Crypto-native payment provider using invisible Stellar wallets.
 *
 * This is a skeleton implementation for Phase 10.1.
 * Full wallet operations will be implemented in Phase 10.2 (WalletService).
 */
@Injectable()
export class CryptoNativeProvider implements PaymentProvider {
  private readonly logger = new Logger(CryptoNativeProvider.name);

  constructor(private readonly prisma: PrismaService) {}

  async initializeUser(userId: string): Promise<PaymentUserInfo> {
    // Phase 10.2: WalletService.createWallet(userId) will be called here
    this.logger.log(`Initializing crypto wallet for user ${userId}`);

    return {
      provider: 'crypto',
      ready: false, // Will be true once wallet is created in Phase 10.2
    };
  }

  async isUserReady(userId: string): Promise<boolean> {
    const wallet = await this.prisma.wallet.findFirst({
      where: { userId, isActive: true, isPrimary: true },
    });
    return !!wallet;
  }

  async getBalance(userId: string): Promise<string> {
    // Phase 10.2: Will query Stellar Horizon for USDC balance
    this.logger.log(`Getting balance for user ${userId}`);
    return '0.00';
  }

  async getDepositInfo(userId: string): Promise<DepositInfo> {
    const wallet = await this.prisma.wallet.findFirst({
      where: { userId, isActive: true, isPrimary: true },
    });

    if (!wallet) {
      throw new Error(`No active wallet found for user ${userId}`);
    }

    return {
      provider: 'crypto',
      method: 'stellar_address',
      address: wallet.publicKey,
      instructions:
        'Send USDC to this Stellar address to deposit funds into your account.',
    };
  }

  async signEscrowTransaction(userId: string, xdr: string): Promise<string> {
    // Phase 10.2: Will decrypt key, sign XDR, return signed XDR
    this.logger.log(`Signing escrow transaction for user ${userId}`);
    throw new Error('Not implemented yet — requires WalletService (Phase 10.2)');
  }

  async sendPayment(
    userId: string,
    destination: string,
    amount: string,
  ): Promise<PaymentResult> {
    // Phase 10.2: Will build + sign + submit USDC payment
    this.logger.log(
      `Sending ${amount} USDC from user ${userId} to ${destination}`,
    );
    throw new Error('Not implemented yet — requires WalletService (Phase 10.2)');
  }
}
