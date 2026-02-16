import { BaseResource } from './base';
import type { WalletInfo, DepositInfo, WalletTransaction } from '../types';

/**
 * Wallet resource client
 * Handles wallet operations for crypto-native payment mode
 */
export class WalletResource extends BaseResource {
    /**
     * Get wallet info for a user
     * Returns the user's primary wallet with balance
     *
     * @param userId - User ID
     * @returns Promise resolving to wallet information
     *
     * @example
     * ```typescript
     * const wallet = await sdk.wallet.getInfo('usr_123');
     * console.log(wallet.publicKey);    // 'GABCD...'
     * console.log(wallet.balance.usdc); // '100.00'
     * ```
     */
    async getInfo(userId: string): Promise<WalletInfo> {
        const response = await this.client.get<{ data: WalletInfo }>(
            `users/${userId}/wallet`,
        );
        return response.data;
    }

    /**
     * Get deposit address and instructions for a user
     * Returns the Stellar address where the user can receive USDC
     *
     * @param userId - User ID
     * @returns Promise resolving to deposit information
     *
     * @example
     * ```typescript
     * const deposit = await sdk.wallet.getDepositAddress('usr_123');
     * console.log(deposit.address); // 'GABCD...'
     * console.log(deposit.asset.code); // 'USDC'
     * ```
     */
    async getDepositAddress(userId: string): Promise<DepositInfo> {
        const response = await this.client.get<{ data: DepositInfo }>(
            `users/${userId}/wallet/deposit`,
        );
        return response.data;
    }

    /**
     * Get transaction history for a user's wallet
     * Returns recent Stellar transactions
     *
     * @param userId - User ID
     * @param limit - Maximum number of transactions (default: 20, max: 100)
     * @returns Promise resolving to array of transactions
     *
     * @example
     * ```typescript
     * const txs = await sdk.wallet.getTransactions('usr_123', 10);
     * txs.forEach(tx => console.log(`${tx.type}: ${tx.amount} ${tx.asset}`));
     * ```
     */
    async getTransactions(userId: string, limit?: number): Promise<WalletTransaction[]> {
        const params = limit ? `?limit=${limit}` : '';
        const response = await this.client.get<{ data: WalletTransaction[] }>(
            `users/${userId}/wallet/transactions${params}`,
        );
        return response.data;
    }
}
