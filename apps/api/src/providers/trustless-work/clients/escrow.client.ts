import { Injectable, Inject, Logger } from '@nestjs/common';
import { TrustlessWorkConfig } from '../trustless-work.config';
import {
    TrustlessInitializeEscrowResponse,
    TrustlessSendTransactionResponse,
    TrustlessEscrowContract,
    TrustlessFundingResult,
    TrustlessReleaseResult,
} from '../types/trustless-work.types';
import { CreateEscrowDto } from '../dto/escrow.dto';
import { ERROR_CODES } from '@offerhub/shared';
import Big from 'big.js';

/**
 * Trustless Work Escrow Client
 * Handles all escrow contract operations with Trustless Work API
 */
@Injectable()
export class EscrowClient {
    private readonly logger = new Logger(EscrowClient.name);
    private readonly baseUrl: string;
    private readonly headers: Record<string, string>;

    constructor(@Inject(TrustlessWorkConfig) private readonly config: TrustlessWorkConfig) {
        this.baseUrl = config.apiUrl;
        this.headers = {
            'x-api-key': config.apiKey,
            'Content-Type': 'application/json',
        };
        this.logger.log(`Initialized Trustless Work escrow client: ${this.baseUrl}`);
    }

    /**
     * Create escrow contract (returns unsigned XDR for wallet signing)
     * Uses /deployer/single-release for single milestones or /deployer/multi-release for multiple
     *
     * IMPORTANT: This returns an unsigned XDR transaction that MUST be signed by the user's wallet
     * The signed XDR must then be submitted via sendTransaction()
     *
     * @param data Escrow creation data
     * @param signerAddress Stellar address of the wallet that will sign the transaction
     * @returns Unsigned XDR transaction and contract details
     */
    async createEscrow(
        data: CreateEscrowDto,
        signerAddress: string,
        platformAddress: string,
    ): Promise<TrustlessInitializeEscrowResponse> {
        try {
            this.logger.debug(`Creating escrow for order: ${data.order_id}`);

            // Validate milestone amounts if provided
            if (data.milestones && data.milestones.length > 0) {
                this.validateMilestoneAmounts(data.amount, data.milestones);
            }

            // Determine escrow type based on milestones
            const hasMilestones = data.milestones && data.milestones.length > 1;
            const escrowType = hasMilestones ? 'multi-release' : 'single-release';

            // TW API expects amount in USDC (not stroops) — TW converts internally
            const amount = parseFloat(data.amount);

            // Build milestones according to Trustless Work schema
            const milestones = hasMilestones
                ? data.milestones?.map((m) => ({
                      description: m.title || 'Milestone',
                      amount: parseFloat(m.amount),
                      receiver: data.seller_address,
                  }))
                : [
                      {
                          description:
                              (data.metadata as any)?.milestoneDescription ||
                              'Complete delivery of service',
                      },
                  ];

            // Build payload according to Trustless Work API schema
            const payload: any = {
                signer: signerAddress, // Wallet address that will sign the transaction
                engagementId: data.order_id,
                title: (data.metadata as any)?.title || `Escrow for order ${data.order_id}`,
                description:
                    (data.metadata as any)?.description ||
                    'Escrow contract created via OFFER-HUB Orchestrator',
                roles: {
                    approver: data.buyer_address, // Buyer approves work
                    serviceProvider: data.seller_address, // Seller provides service
                    platformAddress: platformAddress, // Platform receives fees (must have USDC trustline!)
                    releaseSigner: data.buyer_address, // Buyer releases funds
                    disputeResolver: platformAddress, // Platform resolves disputes (MUST differ from disputer)
                    receiver: data.seller_address, // Seller receives funds
                },
                amount: amount,
                platformFee: (data.metadata as any)?.platformFee || 5, // Platform fee percentage (must be > 0)
                milestones: milestones,
                trustline: {
                    address: this.config.stellarUsdcIssuer,
                    symbol: 'USDC',
                },
            };

            // Use correct Trustless Work endpoint
            const endpoint = `/deployer/${escrowType}`;
            const response = await this.post<TrustlessInitializeEscrowResponse>(
                endpoint,
                payload,
            );

            this.logger.log(
                `Escrow contract (${escrowType}) deployment initiated for order ${data.order_id}`,
            );

            if (!response.unsignedTransaction) {
                throw new Error('No unsigned transaction received from Trustless Work API');
            }

            return response;
        } catch (error: any) {
            this.logger.error(`Failed to create escrow for order ${data.order_id}:`, error);
            throw this.handleApiError(error);
        }
    }

    /**
     * Send signed transaction to Stellar network via Trustless Work
     *
     * @param signedXdr XDR transaction signed by user's wallet
     * @returns Transaction submission result
     */
    async sendTransaction(signedXdr: string, maxRetries = 3): Promise<TrustlessSendTransactionResponse> {
        let lastError: any;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                this.logger.debug(`Submitting signed transaction to Stellar (attempt ${attempt}/${maxRetries})`);

                const response = await this.post<TrustlessSendTransactionResponse>(
                    '/helper/send-transaction',
                    {
                        signedXdr,
                    },
                );

                if (response.status === 'SUCCESS') {
                    this.logger.log(`Transaction submitted successfully: contractId=${response.contractId}`);
                } else {
                    this.logger.error('Transaction submission failed:', response.message);
                }

                return response;
            } catch (error: any) {
                lastError = error;
                const errorMsg = JSON.stringify(error.details ?? error.message ?? '');
                const isRetryable = errorMsg.includes('resultMetaXdr') ||
                    errorMsg.includes('not be complete yet');

                if (isRetryable && attempt < maxRetries) {
                    const delay = attempt * 3000; // 3s, 6s, 9s
                    this.logger.warn(`Transaction not ready, retrying in ${delay / 1000}s (attempt ${attempt}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                this.logger.error('Failed to send transaction:', error);
                throw this.handleApiError(error);
            }
        }

        throw this.handleApiError(lastError);
    }

    /**
     * Get escrow contract by ID
     */
    async getEscrow(contractId: string): Promise<TrustlessEscrowContract> {
        try {
            this.logger.debug(`Fetching escrow: ${contractId}`);

            const response = await this.get<TrustlessEscrowContract>(`/escrow/${contractId}`);

            return response;
        } catch (error: any) {
            this.logger.error(`Failed to fetch escrow ${contractId}:`, error);
            throw this.handleApiError(error);
        }
    }

    /**
     * Fund escrow contract
     * Uses /escrow/{type}/fund-escrow endpoint
     */
    async fundEscrow(contractId: string, amount: string, signer: string, escrowType: 'single-release' | 'multi-release' = 'single-release'): Promise<TrustlessFundingResult> {
        try {
            this.logger.debug(`Funding escrow: ${contractId} with ${amount} USDC (signer: ${signer})`);

            // TW fund-escrow expects amount in USDC (not stroops) — TW converts internally
            const payload = {
                contractId,
                amount: parseFloat(amount),
                signer,
            };

            const response = await this.post<TrustlessFundingResult>(
                `/escrow/${escrowType}/fund-escrow`,
                payload,
            );

            this.logger.log(
                `Escrow ${contractId} funded successfully. Tx: ${response.transaction_hash}`,
            );

            return response;
        } catch (error: any) {
            this.logger.error(`Failed to fund escrow ${contractId}:`, error);
            throw this.handleApiError(error);
        }
    }

    /**
     * Release escrow funds.
     * TW API expects: { contractId, releaseSigner }
     */
    async releaseEscrow(
        contractId: string,
        releaseSigner: string,
        escrowType: 'single-release' | 'multi-release' = 'single-release',
    ): Promise<TrustlessReleaseResult> {
        try {
            this.logger.debug(`Releasing escrow: ${contractId}, signer: ${releaseSigner}`);

            const payload = {
                contractId,
                releaseSigner,
            };

            const endpoint = `/escrow/${escrowType}/release-funds`;

            const response = await this.post<TrustlessReleaseResult>(endpoint, payload);

            this.logger.log(
                `Escrow ${contractId} release initiated. Tx: ${response.transaction_hash}`,
            );

            return response;
        } catch (error: any) {
            this.logger.error(`Failed to release escrow ${contractId}:`, error);
            throw this.handleApiError(error);
        }
    }

    /**
     * Change milestone status (marks escrow as completed in TW).
     * Must be called before release-funds.
     * TW API: POST /escrow/{type}/change-milestone-status
     */
    async changeMilestoneStatus(
        contractId: string,
        milestoneIndex: string,
        newStatus: string,
        serviceProvider: string,
        escrowType: 'single-release' | 'multi-release' = 'single-release',
    ): Promise<{ unsignedTransaction?: string }> {
        try {
            this.logger.debug(
                `Changing milestone ${milestoneIndex} status to "${newStatus}" for escrow: ${contractId}`,
            );

            const payload = {
                contractId,
                milestoneIndex,
                newStatus,
                serviceProvider,
            };

            const response = await this.post<{ unsignedTransaction?: string }>(
                `/escrow/${escrowType}/change-milestone-status`,
                payload,
            );

            this.logger.log(
                `Milestone ${milestoneIndex} status changed to "${newStatus}" for escrow ${contractId}`,
            );

            return response;
        } catch (error: any) {
            this.logger.error(
                `Failed to change milestone status for escrow ${contractId}:`,
                error,
            );
            throw this.handleApiError(error);
        }
    }

    /**
     * Approve a milestone (buyer confirms work is done).
     * Must be called after change-milestone-status and before release-funds.
     * TW API: POST /escrow/{type}/approve-milestone
     */
    async approveMilestone(
        contractId: string,
        milestoneIndex: string,
        approver: string,
        escrowType: 'single-release' | 'multi-release' = 'single-release',
    ): Promise<{ unsignedTransaction?: string }> {
        try {
            this.logger.debug(
                `Approving milestone ${milestoneIndex} for escrow: ${contractId}`,
            );

            const payload = {
                contractId,
                milestoneIndex,
                approver,
            };

            const response = await this.post<{ unsignedTransaction?: string }>(
                `/escrow/${escrowType}/approve-milestone`,
                payload,
            );

            this.logger.log(
                `Milestone ${milestoneIndex} approved for escrow ${contractId}`,
            );

            return response;
        } catch (error: any) {
            this.logger.error(
                `Failed to approve milestone for escrow ${contractId}:`,
                error,
            );
            throw this.handleApiError(error);
        }
    }

    /**
     * Dispute an escrow (step 1 of refund flow).
     * TW API: POST /escrow/{type}/dispute-escrow
     * Returns unsigned XDR that must be signed by the signer.
     */
    async disputeEscrow(
        contractId: string,
        signerAddress: string,
        escrowType: 'single-release' | 'multi-release' = 'single-release',
    ): Promise<{ unsignedTransaction?: string; transaction_hash?: string }> {
        try {
            this.logger.debug(`Disputing escrow: ${contractId} (signer: ${signerAddress})`);

            const payload = {
                contractId,
                signer: signerAddress,
            };

            const response = await this.post<{ unsignedTransaction?: string; transaction_hash?: string }>(
                `/escrow/${escrowType}/dispute-escrow`,
                payload,
            );

            this.logger.log(`Escrow ${contractId} dispute initiated`);
            return response;
        } catch (error: any) {
            this.logger.error(`Failed to dispute escrow ${contractId}:`, error);
            throw this.handleApiError(error);
        }
    }

    /**
     * Step 2 of refund: Resolve dispute with 100% to buyer.
     * Called after the dispute transaction has been signed and submitted.
     * TW API: POST /escrow/{type}/resolve-dispute
     */
    async resolveDisputeForRefund(
        contractId: string,
        disputeResolverAddress: string,
        buyerAddress: string,
        amount: string,
        escrowType: 'single-release' | 'multi-release' = 'single-release',
    ): Promise<{ unsignedTransaction?: string; transaction_hash?: string }> {
        try {
            this.logger.debug(`Step 2/2: Resolving dispute for refund on escrow ${contractId}`);

            // TW expects USDC amounts (not stroops) — consistent with deploy and fund
            const amountUsdc = parseFloat(amount);

            const payload = {
                contractId,
                disputeResolver: disputeResolverAddress,
                distributions: [
                    {
                        address: buyerAddress,
                        amount: amountUsdc,
                    },
                ],
            };

            const response = await this.post<{ unsignedTransaction?: string; transaction_hash?: string }>(
                `/escrow/${escrowType}/resolve-dispute`,
                payload,
            );

            this.logger.log(`Dispute resolved for refund on escrow ${contractId}`);
            return response;
        } catch (error: any) {
            this.logger.error(`Failed to resolve dispute for refund on escrow ${contractId}:`, error);
            throw this.handleApiError(error);
        }
    }

    /**
     * Resolve dispute with split decision (distributions to multiple parties).
     * Uses /escrow/{type}/resolve-dispute endpoint.
     * TW expects: { contractId, disputeResolver, distributions: [{address, amount}] }
     * Amounts must be in USDC (not stroops) — TW converts internally.
     *
     * @param contractId Escrow contract ID
     * @param disputeResolverAddress Platform wallet address (must match escrow's disputeResolver role)
     * @param distributions Array of {address, amount} for each party (buyer + seller)
     * @param escrowType single-release or multi-release
     */
    async resolveDisputeWithSplit(
        contractId: string,
        disputeResolverAddress: string,
        distributions: Array<{ address: string; amount: number }>,
        escrowType: 'single-release' | 'multi-release' = 'single-release',
    ): Promise<{ unsignedTransaction?: string; transaction_hash?: string }> {
        try {
            this.logger.debug(
                `Resolving dispute with split for escrow: ${contractId}, distributions: ${JSON.stringify(distributions)}`,
            );

            const payload = {
                contractId,
                disputeResolver: disputeResolverAddress,
                distributions,
            };

            const response = await this.post<{ unsignedTransaction?: string; transaction_hash?: string }>(
                `/escrow/${escrowType}/resolve-dispute`,
                payload,
            );

            this.logger.log(
                `Dispute resolved with split for escrow ${contractId}. Tx: ${response.transaction_hash}`,
            );

            return response;
        } catch (error: any) {
            this.logger.error(`Failed to resolve dispute for escrow ${contractId}:`, error);
            throw this.handleApiError(error);
        }
    }

    /**
     * Complete a milestone
     */
    async completeMilestone(contractId: string, milestoneRef: string): Promise<void> {
        try {
            this.logger.debug(`Completing milestone ${milestoneRef} for escrow: ${contractId}`);

            await this.post(`/escrow/${contractId}/milestones/${milestoneRef}/complete`, {});

            this.logger.log(`Milestone ${milestoneRef} completed for escrow ${contractId}`);
        } catch (error: any) {
            this.logger.error(
                `Failed to complete milestone ${milestoneRef} for escrow ${contractId}:`,
                error,
            );
            throw this.handleApiError(error);
        }
    }

    /**
     * Validate that milestone amounts sum to total escrow amount
     */
    private validateMilestoneAmounts(
        totalAmount: string,
        milestones: Array<{ amount: string }>,
    ): void {
        const total = new Big(totalAmount);
        let sum = new Big(0);

        for (const milestone of milestones) {
            sum = sum.plus(milestone.amount);
        }

        if (!sum.eq(total)) {
            throw new Error(
                `Milestone amounts (${sum.toFixed(2)}) do not sum to total escrow amount (${totalAmount})`,
            );
        }
    }

    /**
     * HTTP GET request
     */
    private async get<T>(path: string): Promise<T> {
        const url = `${this.baseUrl}${path}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeout);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: this.headers,
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (!response.ok) {
                throw await this.handleHttpError(response);
            }

            return await response.json();
        } catch (error: any) {
            clearTimeout(timeout);
            throw error;
        }
    }

    /**
     * HTTP POST request
     */
    private async post<T>(path: string, body: any): Promise<T> {
        const url = `${this.baseUrl}${path}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeout);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(body),
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (!response.ok) {
                throw await this.handleHttpError(response);
            }

            return await response.json();
        } catch (error: any) {
            clearTimeout(timeout);
            throw error;
        }
    }

    /**
     * Handle HTTP error responses
     */
    private async handleHttpError(response: Response): Promise<Error> {
        const body = await response.json().catch(() => ({}));

        this.logger.error(`Trustless Work API ${response.status} response body: ${JSON.stringify(body)}`);

        let code: string = ERROR_CODES.PROVIDER_ERROR;
        let message = `Trustless Work API error: ${response.status}`;

        if (response.status === 404) {
            code = ERROR_CODES.ESCROW_NOT_FOUND;
            message = 'Escrow contract not found';
        } else if (response.status === 409) {
            code = ERROR_CODES.ESCROW_ALREADY_FUNDED;
            message = body.message ?? 'Escrow contract already funded';
        } else if (response.status === 422) {
            code = ERROR_CODES.ESCROW_INSUFFICIENT_FUNDS;
            message = body.message ?? 'Invalid escrow operation';
        } else if (response.status === 503) {
            code = ERROR_CODES.PROVIDER_UNAVAILABLE;
            message = 'Trustless Work temporarily unavailable';
        }

        const error = new Error(message);
        (error as any).code = code;
        (error as any).statusCode = response.status;
        (error as any).details = body;

        return error;
    }

    /**
     * Handle general API errors
     */
    private handleApiError(error: any): Error {
        if (error.name === 'AbortError') {
            const timeoutError = new Error('Trustless Work API timeout');
            (timeoutError as any).code = ERROR_CODES.PROVIDER_TIMEOUT;
            return timeoutError;
        }

        if (error.code && typeof error.code === 'string') {
            return error;
        }

        const providerError = new Error(`Trustless Work API error: ${error.message}`);
        (providerError as any).code = ERROR_CODES.PROVIDER_ERROR;
        return providerError;
    }
}
