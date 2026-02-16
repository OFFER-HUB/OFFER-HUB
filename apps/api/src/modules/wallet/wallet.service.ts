import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import {
  Keypair,
  Horizon,
  TransactionBuilder,
  Networks,
  Operation,
  Asset,
  BASE_FEE,
} from '@stellar/stellar-sdk';
import { PrismaService } from '../database/prisma.service';
import { TrustlessWorkConfig } from '../../providers/trustless-work/trustless-work.config';
import { encrypt, decrypt } from '../../utils/crypto';
import { generateWalletId } from '@offerhub/shared';
import { fundTestAccount, setupTestTrustline } from './testnet.utils';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private readonly server: Horizon.Server;
  private readonly usdcAsset: Asset;
  private readonly networkPassphrase: string;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TrustlessWorkConfig) private readonly stellarConfig: TrustlessWorkConfig,
  ) {
    this.server = new Horizon.Server(stellarConfig.stellarHorizonUrl);
    this.usdcAsset = new Asset(
      stellarConfig.stellarUsdcAssetCode,
      stellarConfig.stellarUsdcIssuer,
    );
    this.networkPassphrase = stellarConfig.isTestnet()
      ? Networks.TESTNET
      : Networks.PUBLIC;
  }

  /**
   * Create an invisible wallet for a user.
   * Generates keypair, encrypts secret, funds on testnet, sets up USDC trustline.
   */
  async createWallet(userId: string): Promise<{
    publicKey: string;
    funded: boolean;
    trustlineReady: boolean;
  }> {
    // Check if user already has a wallet
    const existing = await this.prisma.wallet.findFirst({
      where: { userId, isActive: true },
    });
    if (existing) {
      this.logger.warn(`User ${userId} already has an active wallet`);
      return { publicKey: existing.publicKey, funded: true, trustlineReady: true };
    }

    // Generate Stellar keypair
    const keypair = Keypair.random();
    const publicKey = keypair.publicKey();
    const secretKey = keypair.secret();

    // Encrypt secret key
    const secretEncrypted = encrypt(secretKey);

    // Save to DB
    await this.prisma.wallet.create({
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

    this.logger.log(`Wallet created for user ${userId}: ${publicKey}`);

    // Fund on testnet + setup trustline
    let funded = false;
    let trustlineReady = false;

    if (this.stellarConfig.isTestnet()) {
      try {
        await fundTestAccount(publicKey);
        funded = true;

        await setupTestTrustline(
          keypair,
          this.stellarConfig.stellarHorizonUrl,
          this.stellarConfig.stellarUsdcAssetCode,
          this.stellarConfig.stellarUsdcIssuer,
        );
        trustlineReady = true;
      } catch (error) {
        this.logger.error(
          `Failed to fund/trustline for ${publicKey}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    return { publicKey, funded, trustlineReady };
  }

  /**
   * Get the decrypted Keypair for a user (for signing transactions).
   */
  async getKeypair(userId: string): Promise<Keypair> {
    const wallet = await this.getPrimaryWallet(userId);

    if (!wallet.secretEncrypted) {
      throw new Error(`Wallet ${wallet.id} has no encrypted secret (external wallet?)`);
    }

    const secret = decrypt(wallet.secretEncrypted);
    return Keypair.fromSecret(secret);
  }

  /**
   * Get USDC balance from Stellar Horizon.
   */
  async getBalance(userId: string): Promise<{ usdc: string; xlm: string }> {
    const wallet = await this.getPrimaryWallet(userId);

    try {
      const account = await this.server.loadAccount(wallet.publicKey);

      const usdcBal = account.balances.find(
        (b) =>
          'asset_code' in b &&
          b.asset_code === this.stellarConfig.stellarUsdcAssetCode &&
          'asset_issuer' in b &&
          b.asset_issuer === this.stellarConfig.stellarUsdcIssuer,
      );

      const xlmBal = account.balances.find((b) => b.asset_type === 'native');

      return {
        usdc: usdcBal?.balance ?? '0.0000000',
        xlm: xlmBal?.balance ?? '0.0000000',
      };
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return { usdc: '0.0000000', xlm: '0.0000000' };
      }
      throw error;
    }
  }

  /**
   * Get the public key for a user (no decryption needed).
   */
  async getPublicKey(userId: string): Promise<string> {
    const wallet = await this.getPrimaryWallet(userId);
    return wallet.publicKey;
  }

  /**
   * Sign a Stellar XDR transaction with the user's secret key.
   */
  async signTransaction(userId: string, xdr: string): Promise<string> {
    const keypair = await this.getKeypair(userId);
    const tx = TransactionBuilder.fromXDR(xdr, this.networkPassphrase);
    tx.sign(keypair);
    return tx.toXDR();
  }

  /**
   * Send a USDC payment from user to destination.
   */
  async sendPayment(
    userId: string,
    destination: string,
    amount: string,
  ): Promise<{ hash: string; status: string }> {
    const keypair = await this.getKeypair(userId);
    const account = await this.server.loadAccount(keypair.publicKey());

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        Operation.payment({
          destination,
          asset: this.usdcAsset,
          amount,
        }),
      )
      .setTimeout(30)
      .build();

    tx.sign(keypair);

    this.logger.log(`Sending ${amount} USDC from ${keypair.publicKey()} to ${destination}`);
    const result = await this.server.submitTransaction(tx);
    const hash = (result as { hash: string }).hash;

    this.logger.log(`Payment sent: ${hash}`);
    return { hash, status: 'completed' };
  }

  /**
   * Set up USDC trustline for a user's wallet.
   */
  async setupTrustline(userId: string): Promise<string> {
    const keypair = await this.getKeypair(userId);
    const account = await this.server.loadAccount(keypair.publicKey());

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        Operation.changeTrust({
          asset: this.usdcAsset,
        }),
      )
      .setTimeout(30)
      .build();

    tx.sign(keypair);

    const result = await this.server.submitTransaction(tx);
    const hash = (result as { hash: string }).hash;
    this.logger.log(`Trustline established for user ${userId}: ${hash}`);
    return hash;
  }

  /**
   * Get the user's primary active wallet or throw.
   */
  async getPrimaryWallet(userId: string) {
    const wallet = await this.prisma.wallet.findFirst({
      where: { userId, isActive: true, isPrimary: true },
    });

    if (!wallet) {
      throw new NotFoundException(`No active wallet found for user ${userId}`);
    }

    return wallet;
  }

  /**
   * Get transaction history from Stellar Horizon.
   */
  async getTransactions(userId: string, limit = 20) {
    const wallet = await this.getPrimaryWallet(userId);

    const payments = await this.server
      .payments()
      .forAccount(wallet.publicKey)
      .limit(limit)
      .order('desc')
      .call();

    return payments.records
      .filter((r: any) => r.type === 'payment' || r.type === 'create_account')
      .map((r: any) => ({
        id: r.id,
        type: r.type,
        from: r.from ?? r.funder ?? '',
        to: r.to ?? r.account ?? '',
        amount: r.amount ?? r.starting_balance ?? '0',
        asset: r.asset_code ? `${r.asset_code}:${r.asset_issuer}` : 'XLM',
        createdAt: r.created_at,
        hash: r.transaction_hash,
        successful: r.transaction_successful,
      }));
  }
}
