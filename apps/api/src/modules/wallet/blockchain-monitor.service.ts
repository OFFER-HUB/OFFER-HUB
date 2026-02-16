import { Injectable, Inject, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Horizon } from '@stellar/stellar-sdk';
import { PrismaService } from '../database/prisma.service';
import { TrustlessWorkConfig } from '../../providers/trustless-work/trustless-work.config';
import { EventBusService } from '../events/event-bus.service';
import { EVENT_CATALOG } from '../events/event-catalog';

interface StreamCloseFunction {
  (): void;
}

@Injectable()
export class BlockchainMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BlockchainMonitorService.name);
  private readonly server: Horizon.Server;
  private readonly streams = new Map<string, StreamCloseFunction>();
  private readonly processedTxHashes = new Set<string>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TrustlessWorkConfig) private readonly stellarConfig: TrustlessWorkConfig,
    @Inject(EventBusService) private readonly eventBus: EventBusService,
  ) {
    this.server = new Horizon.Server(stellarConfig.stellarHorizonUrl);
  }

  async onModuleInit() {
    if (process.env.NODE_ENV === 'test') {
      this.logger.debug('Skipping blockchain monitoring in test environment');
      return;
    }

    await this.startMonitoringAllWallets();
  }

  onModuleDestroy() {
    this.stopAllStreams();
  }

  /**
   * Start monitoring all active wallets for incoming payments.
   */
  async startMonitoringAllWallets(): Promise<void> {
    const wallets = await this.prisma.wallet.findMany({
      where: { isActive: true, type: 'INVISIBLE' },
      select: { userId: true, publicKey: true },
    });

    this.logger.log(`Starting blockchain monitor for ${wallets.length} wallets`);

    for (const wallet of wallets) {
      this.monitorWallet(wallet.userId, wallet.publicKey);
    }
  }

  /**
   * Start monitoring a single wallet for incoming USDC payments.
   */
  monitorWallet(userId: string, publicKey: string): void {
    if (this.streams.has(publicKey)) {
      return; // Already monitoring
    }

    this.logger.debug(`Monitoring wallet ${publicKey} for user ${userId}`);

    const closeStream = this.server
      .payments()
      .forAccount(publicKey)
      .cursor('now')
      .stream({
        onmessage: (payment: any) => {
          this.handlePayment(userId, publicKey, payment).catch((err) => {
            this.logger.error(
              `Error handling payment for ${publicKey}: ${err.message}`,
            );
          });
        },
        onerror: (error: any) => {
          this.logger.warn(
            `Stream error for ${publicKey}: ${error?.message ?? 'Unknown'}. Reconnecting...`,
          );
          // Horizon SDK handles reconnection automatically
        },
      }) as unknown as StreamCloseFunction;

    this.streams.set(publicKey, closeStream);
  }

  /**
   * Stop monitoring a wallet.
   */
  stopMonitoringWallet(publicKey: string): void {
    const close = this.streams.get(publicKey);
    if (close) {
      close();
      this.streams.delete(publicKey);
      this.logger.debug(`Stopped monitoring wallet ${publicKey}`);
    }
  }

  /**
   * Handle an incoming payment event from Stellar Horizon.
   */
  private async handlePayment(
    userId: string,
    publicKey: string,
    payment: any,
  ): Promise<void> {
    // Only process incoming USDC payments
    if (payment.type !== 'payment') return;
    if (payment.to !== publicKey) return;
    if (payment.asset_code !== this.stellarConfig.stellarUsdcAssetCode) return;
    if (payment.asset_issuer !== this.stellarConfig.stellarUsdcIssuer) return;

    const txHash = payment.transaction_hash;

    // Deduplicate
    if (this.processedTxHashes.has(txHash)) {
      this.logger.debug(`Skipping duplicate tx: ${txHash}`);
      return;
    }
    this.processedTxHashes.add(txHash);

    const amount = payment.amount;
    this.logger.log(
      `Deposit detected: ${amount} USDC to ${publicKey} (user: ${userId}, tx: ${txHash})`,
    );

    // Credit user's balance
    try {
      const balance = await this.prisma.balance.findFirst({
        where: { userId },
      });

      if (balance) {
        const newAvailable = (
          parseFloat(balance.available.toString()) + parseFloat(amount)
        ).toFixed(2);

        await this.prisma.balance.update({
          where: { id: balance.id },
          data: { available: newAvailable },
        });

        // Emit domain event
        this.eventBus.emit({
          eventType: EVENT_CATALOG.BALANCE_CREDITED,
          aggregateId: userId,
          aggregateType: 'User',
          payload: {
            userId,
            amount,
            source: 'stellar_deposit',
            transactionHash: txHash,
            newBalance: newAvailable,
          },
          metadata: {},
        });

        this.logger.log(
          `Balance credited: ${amount} USDC for user ${userId} (new balance: ${newAvailable})`,
        );
      } else {
        this.logger.warn(`No balance record found for user ${userId}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to credit balance for user ${userId}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private stopAllStreams(): void {
    this.logger.log(`Stopping ${this.streams.size} blockchain monitor streams`);
    for (const [key, close] of this.streams) {
      close();
      this.streams.delete(key);
    }
  }
}
