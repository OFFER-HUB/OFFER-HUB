import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import {
  PaymentProvider,
  PaymentUserInfo,
  DepositInfo,
  PaymentResult,
} from './payment-provider.interface';
import { WalletService } from '../../modules/wallet/wallet.service';

/**
 * Crypto-native payment provider using invisible Stellar wallets.
 * Delegates all wallet operations to WalletService.
 */
@Injectable()
export class CryptoNativeProvider implements PaymentProvider {
  private readonly logger = new Logger(CryptoNativeProvider.name);

  constructor(
    @Inject(forwardRef(() => WalletService))
    private readonly walletService: WalletService,
  ) {}

  async initializeUser(userId: string): Promise<PaymentUserInfo> {
    this.logger.log(`Initializing crypto wallet for user ${userId}`);

    const result = await this.walletService.createWallet(userId);

    return {
      provider: 'crypto',
      publicAddress: result.publicKey,
      ready: result.funded && result.trustlineReady,
    };
  }

  async isUserReady(userId: string): Promise<boolean> {
    try {
      await this.walletService.getPrimaryWallet(userId);
      return true;
    } catch {
      return false;
    }
  }

  async getBalance(userId: string): Promise<string> {
    const balance = await this.walletService.getBalance(userId);
    return balance.usdc;
  }

  async getDepositInfo(userId: string): Promise<DepositInfo> {
    const publicKey = await this.walletService.getPublicKey(userId);

    return {
      provider: 'crypto',
      method: 'stellar_address',
      address: publicKey,
      instructions:
        'Send USDC to this Stellar address to deposit funds into your account.',
    };
  }

  async signEscrowTransaction(userId: string, xdr: string): Promise<string> {
    this.logger.log(`Signing escrow transaction for user ${userId}`);
    return this.walletService.signTransaction(userId, xdr);
  }

  async sendPayment(
    userId: string,
    destination: string,
    amount: string,
  ): Promise<PaymentResult> {
    this.logger.log(
      `Sending ${amount} USDC from user ${userId} to ${destination}`,
    );

    const result = await this.walletService.sendPayment(
      userId,
      destination,
      amount,
    );

    return {
      transactionHash: result.hash,
      status: 'completed',
    };
  }
}
