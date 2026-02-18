import { Processor, WorkerHost, OnWorkerEvent, InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, Inject } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { Horizon } from '@stellar/stellar-sdk';
import { PrismaService } from '../../database/prisma.service';
import { TopUpsService } from '../../topups/topups.service';
import { WithdrawalsService } from '../../withdrawals/withdrawals.service';
import { EscrowClient } from '../../../providers/trustless-work/clients/escrow.client';
import { TrustlessWorkConfig } from '../../../providers/trustless-work/trustless-work.config';
import { EventBusService } from '../../events/event-bus.service';
import { EVENT_CATALOG } from '../../events/event-catalog';
import { QUEUE_NAMES, JOB_TYPES } from '../queue.constants';
import { QueueService } from '../queue.service';
import {
    TopUpStatus,
    WithdrawalStatus,
    EscrowStatus,
} from '@offerhub/shared';
import { deriveEscrowStatusFromContract } from '../../../providers/trustless-work/types/trustless-work.types';

/**
 * Metrics for reconciliation job execution
 */
interface JobMetrics {
    jobType: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    recordsProcessed: number;
    recordsSynced: number;
    errors: number;
    discrepancies: number;
}

/**
 * Configuration for reconciliation jobs
 */
export interface ReconciliationConfig {
    /** Maximum number of records to process per job run */
    batchSize: number;
    /** Delay between API calls in ms (rate limiting) */
    rateLimitDelay: number;
    /** Only process records older than this (ms) */
    staleThreshold: number;
}

const DEFAULT_CONFIG: ReconciliationConfig = {
    batchSize: 50,
    rateLimitDelay: 200, // 5 requests per second
    staleThreshold: 5 * 60 * 1000, // 5 minutes
};

/**
 * Reconciliation Processor
 *
 * Handles scheduled jobs to sync local state with external providers:
 * - SYNC_TOPUPS: Cross-check pending topups with Airtm
 * - SYNC_WITHDRAWALS: Cross-check pending withdrawals with Airtm
 * - SYNC_ESCROWS: Verify escrow states with Trustless Work
 */
@Processor(QUEUE_NAMES.RECONCILIATION, {
    concurrency: 1, // Only process one job at a time per worker
    lockDuration: 300000, // 5 minute lock
    stalledInterval: 30000, // Check for stalled jobs every 30s
})
@Injectable()
export class ReconciliationProcessor extends WorkerHost {
    private readonly logger = new Logger(ReconciliationProcessor.name);
    private activeJobs: Set<string> = new Set(); // Track active jobs locally

    private readonly horizonServer: Horizon.Server;

    constructor(
        @InjectQueue(QUEUE_NAMES.RECONCILIATION) private readonly reconciliationQueue: Queue,
        private readonly prisma: PrismaService,
        private readonly topUpsService: TopUpsService,
        private readonly withdrawalsService: WithdrawalsService,
        private readonly escrowClient: EscrowClient,
        private readonly queueService: QueueService,
        @Inject(TrustlessWorkConfig) private readonly stellarConfig: TrustlessWorkConfig,
        @Inject(EventBusService) private readonly eventBus: EventBusService,
    ) {
        super();
        this.horizonServer = new Horizon.Server(stellarConfig.stellarHorizonUrl);
    }

    /**
     * Check if a job of the same type is already running (distributed lock check)
     */
    private async isJobTypeActive(jobType: string, currentJobId: string): Promise<boolean> {
        const activeJobs = await this.reconciliationQueue.getJobs(['active']);
        return activeJobs.some(
            (job) => job.name === jobType && job.id !== currentJobId,
        );
    }

    /**
     * Main job processor - routes to specific handlers based on job type
     * Includes distributed locking and metrics collection
     */
    async process(job: Job<Record<string, unknown>>): Promise<void> {
        const config = { ...DEFAULT_CONFIG, ...(job.data.config as Partial<ReconciliationConfig>) };
        const metrics: JobMetrics = {
            jobType: job.name,
            startTime: Date.now(),
            recordsProcessed: 0,
            recordsSynced: 0,
            errors: 0,
            discrepancies: 0,
        };

        this.logger.log({
            message: `Starting reconciliation job`,
            jobType: job.name,
            jobId: job.id,
            isManual: job.data.manual ?? false,
            config,
        });

        // Guard: skip if dependencies aren't injected yet (race condition on startup)
        if (!this.prisma) {
            this.logger.warn('Processor dependencies not yet initialized, skipping job');
            return;
        }

        // Distributed lock check - skip if another instance is processing same job type
        if (await this.isJobTypeActive(job.name, job.id ?? '')) {
            this.logger.warn({
                message: `Skipping job - another instance is already processing`,
                jobType: job.name,
                jobId: job.id,
            });
            return;
        }

        // Track locally
        this.activeJobs.add(job.name);

        const isCryptoMode = (process.env.PAYMENT_PROVIDER || 'crypto') === 'crypto';

        try {
            switch (job.name) {
                case JOB_TYPES.SYNC_TOPUPS:
                    if (isCryptoMode) {
                        this.logger.debug('Skipping TopUp sync in crypto mode (no AirTM)');
                        break;
                    }
                    await this.syncTopUps(config, metrics);
                    break;
                case JOB_TYPES.SYNC_WITHDRAWALS:
                    if (isCryptoMode) {
                        this.logger.debug('Skipping Withdrawal sync in crypto mode (no AirTM)');
                        break;
                    }
                    await this.syncWithdrawals(config, metrics);
                    break;
                case JOB_TYPES.SYNC_ESCROWS:
                    await this.syncEscrows(config, metrics);
                    break;
                case JOB_TYPES.CHECK_MISSED_DEPOSITS:
                    if (process.env.RECONCILIATION_ENABLED === 'false') {
                        this.logger.debug('[Reconciliation] Deposit reconciliation DISABLED via env var');
                        break;
                    }
                    await this.checkMissedDeposits(config, metrics);
                    break;
                default:
                    this.logger.warn(`Unknown reconciliation job type: ${job.name}`);
            }

            // Record success metrics
            metrics.endTime = Date.now();
            metrics.duration = metrics.endTime - metrics.startTime;

            this.logger.log({
                message: `Reconciliation job completed successfully`,
                ...metrics,
            });
        } catch (error) {
            // Record failure metrics
            metrics.endTime = Date.now();
            metrics.duration = metrics.endTime - metrics.startTime;

            this.logger.error({
                message: `Reconciliation job failed`,
                ...metrics,
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
            });

            throw error;
        } finally {
            this.activeJobs.delete(job.name);
        }
    }

    /**
     * Sync pending TopUps with Airtm
     *
     * Finds topups that are in non-terminal states and refreshes their status
     * from Airtm API.
     */
    private async syncTopUps(config: ReconciliationConfig, metrics: JobMetrics): Promise<void> {
        const staleDate = new Date(Date.now() - config.staleThreshold);

        // Find pending topups that haven't been updated recently
        const pendingTopUps = await this.prisma.topUp.findMany({
            where: {
                status: {
                    in: [
                        TopUpStatus.TOPUP_CREATED,
                        TopUpStatus.TOPUP_AWAITING_USER_CONFIRMATION,
                        TopUpStatus.TOPUP_PROCESSING,
                    ],
                },
                airtmPayinId: { not: null },
                updatedAt: { lt: staleDate },
            },
            orderBy: { updatedAt: 'asc' },
            take: config.batchSize,
        });

        metrics.recordsProcessed = pendingTopUps.length;
        this.logger.log({
            message: `Found pending topups to reconcile`,
            count: pendingTopUps.length,
            staleThreshold: config.staleThreshold,
        });

        for (const topup of pendingTopUps) {
            try {
                // Use the existing refresh method which handles all the logic
                await this.topUpsService.refreshTopUp(topup.id, topup.userId);
                metrics.recordsSynced++;

                // Rate limiting
                if (config.rateLimitDelay > 0) {
                    await this.delay(config.rateLimitDelay);
                }
            } catch (error) {
                metrics.errors++;
                this.logger.warn({
                    message: `Failed to sync topup`,
                    topupId: topup.id,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }

        this.logger.log({
            message: `TopUp reconciliation complete`,
            synced: metrics.recordsSynced,
            errors: metrics.errors,
        });
    }

    /**
     * Sync pending Withdrawals with Airtm
     *
     * Finds withdrawals that are in pending states and refreshes their status
     * from Airtm API.
     */
    private async syncWithdrawals(config: ReconciliationConfig, metrics: JobMetrics): Promise<void> {
        const staleDate = new Date(Date.now() - config.staleThreshold);

        // Find pending withdrawals that haven't been updated recently
        const pendingWithdrawals = await this.prisma.withdrawal.findMany({
            where: {
                status: {
                    in: [
                        WithdrawalStatus.WITHDRAWAL_CREATED,
                        WithdrawalStatus.WITHDRAWAL_COMMITTED,
                        WithdrawalStatus.WITHDRAWAL_PENDING,
                        WithdrawalStatus.WITHDRAWAL_PENDING_USER_ACTION,
                    ],
                },
                airtmPayoutId: { not: null },
                updatedAt: { lt: staleDate },
            },
            orderBy: { updatedAt: 'asc' },
            take: config.batchSize,
        });

        metrics.recordsProcessed = pendingWithdrawals.length;
        this.logger.log({
            message: `Found pending withdrawals to reconcile`,
            count: pendingWithdrawals.length,
            staleThreshold: config.staleThreshold,
        });

        for (const withdrawal of pendingWithdrawals) {
            try {
                // Use the existing refresh method which handles all the logic
                await this.withdrawalsService.refreshWithdrawal(withdrawal.id, withdrawal.userId);
                metrics.recordsSynced++;

                // Rate limiting
                if (config.rateLimitDelay > 0) {
                    await this.delay(config.rateLimitDelay);
                }
            } catch (error) {
                metrics.errors++;
                this.logger.warn({
                    message: `Failed to sync withdrawal`,
                    withdrawalId: withdrawal.id,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }

        this.logger.log({
            message: `Withdrawal reconciliation complete`,
            synced: metrics.recordsSynced,
            errors: metrics.errors,
        });
    }

    /**
     * Sync Escrow states with Trustless Work
     *
     * Finds escrows in non-terminal states and verifies their on-chain status.
     * Alerts on discrepancies.
     */
    private async syncEscrows(config: ReconciliationConfig, metrics: JobMetrics): Promise<void> {
        const staleDate = new Date(Date.now() - config.staleThreshold);

        // Find escrows in active states
        const activeEscrows = await this.prisma.escrow.findMany({
            where: {
                status: {
                    in: [
                        EscrowStatus.CREATING,
                        EscrowStatus.CREATED,
                        EscrowStatus.FUNDING,
                        EscrowStatus.FUNDED,
                        EscrowStatus.RELEASING,
                        EscrowStatus.REFUNDING,
                    ],
                },
                trustlessContractId: { not: null },
                updatedAt: { lt: staleDate },
            },
            include: {
                order: true,
            },
            orderBy: { updatedAt: 'asc' },
            take: config.batchSize,
        });

        metrics.recordsProcessed = activeEscrows.length;
        this.logger.log({
            message: `Found active escrows to reconcile`,
            count: activeEscrows.length,
            staleThreshold: config.staleThreshold,
        });

        for (const escrow of activeEscrows) {
            try {
                if (!escrow.trustlessContractId) continue;

                // Fetch current state from Trustless Work
                const contractState = await this.escrowClient.getEscrow(escrow.trustlessContractId);
                const providerStatus = deriveEscrowStatusFromContract(contractState);

                // Check for discrepancy
                if (escrow.status !== providerStatus) {
                    this.logger.warn({
                        message: `Escrow state mismatch detected`,
                        escrowId: escrow.id,
                        localStatus: escrow.status,
                        providerStatus,
                        contractId: escrow.trustlessContractId,
                    });

                    // Update local state to match provider (provider is source of truth for on-chain state)
                    await this.prisma.escrow.update({
                        where: { id: escrow.id },
                        data: {
                            status: providerStatus,
                            ...(providerStatus === EscrowStatus.FUNDED && !escrow.fundedAt
                                ? { fundedAt: new Date() }
                                : {}),
                            ...(providerStatus === EscrowStatus.RELEASED && !escrow.releasedAt
                                ? { releasedAt: new Date() }
                                : {}),
                            ...(providerStatus === EscrowStatus.REFUNDED && !escrow.refundedAt
                                ? { refundedAt: new Date() }
                                : {}),
                        },
                    });

                    // Also update the order status if needed
                    if (escrow.order && providerStatus === EscrowStatus.FUNDED) {
                        await this.prisma.order.update({
                            where: { id: escrow.orderId },
                            data: { status: 'IN_PROGRESS' },
                        });
                    }

                    metrics.discrepancies++;
                    this.logger.log({
                        message: `Escrow synced`,
                        escrowId: escrow.id,
                        from: escrow.status,
                        to: providerStatus,
                    });
                }

                metrics.recordsSynced++;

                // Rate limiting
                if (config.rateLimitDelay > 0) {
                    await this.delay(config.rateLimitDelay);
                }
            } catch (error) {
                metrics.errors++;
                this.logger.warn({
                    message: `Failed to sync escrow`,
                    escrowId: escrow.id,
                    contractId: escrow.trustlessContractId,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }

        this.logger.log({
            message: `Escrow reconciliation complete`,
            checked: metrics.recordsSynced,
            discrepancies: metrics.discrepancies,
            errors: metrics.errors,
        });

        // Alert if there were discrepancies
        if (metrics.discrepancies > 0) {
            this.logger.warn({
                message: `ALERT: Escrow discrepancies detected and auto-corrected`,
                count: metrics.discrepancies,
            });
        }
    }

    /**
     * Check for missed Stellar USDC deposits during server downtime.
     *
     * Queries Horizon for recent payments on all active wallets and credits any
     * that were not captured by the real-time SSE stream (BlockchainMonitorService).
     * Deduplication is handled via the ProcessedTransaction table.
     */
    async checkMissedDeposits(config: ReconciliationConfig, metrics: JobMetrics): Promise<void> {
        const lookbackHours = (config as any).lookbackHours ?? 24;
        const lookbackDate = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
        const batchSize = config.batchSize ?? 100;

        const wallets = await this.prisma.wallet.findMany({
            where: { isActive: true, type: 'INVISIBLE' },
            select: { userId: true, publicKey: true },
            take: batchSize,
        });

        metrics.recordsProcessed = wallets.length;
        let depositsFound = 0;

        for (const wallet of wallets) {
            try {
                // Fetch recent payments from Horizon (newest first, limit 50)
                const paymentsPage = await this.horizonServer
                    .payments()
                    .forAccount(wallet.publicKey)
                    .order('desc')
                    .limit(50)
                    .call();

                for (const record of paymentsPage.records) {
                    const payment = record as any;

                    // Only incoming USDC payments
                    if (payment.type !== 'payment') continue;
                    if (payment.to !== wallet.publicKey) continue;
                    if (payment.asset_code !== this.stellarConfig.stellarUsdcAssetCode) continue;
                    if (payment.asset_issuer !== this.stellarConfig.stellarUsdcIssuer) continue;

                    // Only within lookback window
                    const paymentDate = new Date(payment.created_at);
                    if (paymentDate < lookbackDate) break; // results are ordered desc

                    const txHash = payment.transaction_hash;
                    const amount = payment.amount;

                    // Skip if already processed (real-time or previous reconciliation)
                    const alreadyProcessed = await this.prisma.processedTransaction.findUnique({
                        where: { transactionHash: txHash },
                    });
                    if (alreadyProcessed) continue;

                    // Credit the missed deposit
                    const balance = await this.prisma.balance.findFirst({
                        where: { userId: wallet.userId },
                    });
                    if (!balance) {
                        this.logger.warn(`No balance record for user ${wallet.userId}, skipping tx ${txHash}`);
                        continue;
                    }

                    const newAvailable = (
                        parseFloat(balance.available.toString()) + parseFloat(amount)
                    ).toFixed(2);

                    await this.prisma.$transaction([
                        this.prisma.balance.update({
                            where: { id: balance.id },
                            data: { available: newAvailable },
                        }),
                        this.prisma.processedTransaction.create({
                            data: {
                                transactionHash: txHash,
                                userId: wallet.userId,
                                amount,
                                source: 'stellar_deposit_reconciled',
                            },
                        }),
                    ]);

                    this.eventBus.emit({
                        eventType: EVENT_CATALOG.BALANCE_CREDITED,
                        aggregateId: wallet.userId,
                        aggregateType: 'User',
                        payload: {
                            userId: wallet.userId,
                            amount,
                            source: 'stellar_deposit_reconciled',
                            transactionHash: txHash,
                            newBalance: newAvailable,
                        },
                        metadata: {},
                    });

                    depositsFound++;
                    metrics.recordsSynced++;
                    this.logger.log(
                        `[Reconciliation] Missed deposit credited: ${amount} USDC to user ${wallet.userId} (tx: ${txHash})`,
                    );
                }
            } catch (error) {
                const msg = error instanceof Error ? error.message : 'Unknown';
                // Horizon returns 404 for unfunded accounts — expected, not a real error
                if (msg.includes('404')) continue;
                metrics.errors++;
                this.logger.warn(`[Reconciliation] Failed to check wallet ${wallet.publicKey}: ${msg}`);
            }
        }

        this.logger.log(
            `[Reconciliation] Checked ${wallets.length} wallets, found ${depositsFound} missed deposit(s)`,
        );
    }

    /**
     * Helper to add delay between API calls (rate limiting)
     */
    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Event handler for failed jobs - move to DLQ after max retries
     */
    @OnWorkerEvent('failed')
    async onFailed(job: Job, error: Error): Promise<void> {
        this.logger.error(`Reconciliation job ${job.id} failed: ${error.message}`);

        // Move to DLQ if max attempts reached
        if (job.attemptsMade >= (job.opts.attempts || 3)) {
            await this.queueService.moveToDlq(QUEUE_NAMES.RECONCILIATION, job, error);
        }
    }

    /**
     * Event handler for completed jobs
     */
    @OnWorkerEvent('completed')
    onCompleted(job: Job): void {
        this.logger.log(`Reconciliation job ${job.name} (${job.id}) completed successfully`);
    }
}
