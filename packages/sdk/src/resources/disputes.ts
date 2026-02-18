import { BaseResource } from './base';
import type {
    OpenDisputeRequest,
    AssignDisputeRequest,
    ResolveDisputeRequest,
    ListDisputesParams,
    Dispute,
} from '../types';

/**
 * Disputes resource client
 * Handles dispute management operations
 */
export class DisputesResource extends BaseResource {
    /**
     * List disputes with optional filters
     *
     * @param params - Optional filters: orderId, status, openedBy
     * @returns Promise resolving to array of disputes
     *
     * @example
     * ```typescript
     * // All disputes
     * const disputes = await sdk.disputes.list();
     *
     * // Disputes for a specific order
     * const disputes = await sdk.disputes.list({ orderId: 'ord_abc123' });
     *
     * // Open disputes opened by buyer
     * const disputes = await sdk.disputes.list({ status: 'OPEN', openedBy: 'BUYER' });
     * ```
     */
    async list(params?: ListDisputesParams): Promise<Dispute[]> {
        const query = new URLSearchParams();
        if (params?.orderId) query.set('orderId', params.orderId);
        if (params?.status) query.set('status', params.status);
        if (params?.openedBy) query.set('openedBy', params.openedBy);

        const qs = query.toString();
        const response = await this.client.get<{ success: boolean; data: Dispute[] }>(
            `disputes${qs ? `?${qs}` : ''}`,
        );
        return response.data;
    }

    /**
     * Open a dispute for an order
     *
     * @param orderId - Order ID
     * @param data - Dispute opening data
     * @returns Promise resolving to the created dispute
     *
     * @example
     * ```typescript
     * const dispute = await sdk.disputes.open('ord_abc123', {
     *   openedBy: 'BUYER',
     *   reason: 'NOT_DELIVERED',
     * });
     * ```
     */
    async open(orderId: string, data: OpenDisputeRequest): Promise<Dispute> {
        const response = await this.client.post<{ success: boolean; data: Dispute }>(
            `orders/${orderId}/resolution/dispute`,
            data,
        );
        return response.data;
    }

    /**
     * Get dispute by ID
     *
     * @param disputeId - Dispute ID
     * @returns Promise resolving to the dispute
     *
     * @example
     * ```typescript
     * const dispute = await sdk.disputes.get('dsp_abc123');
     * ```
     */
    async get(disputeId: string): Promise<Dispute> {
        const response = await this.client.get<{ success: boolean; data: Dispute }>(
            `disputes/${disputeId}`,
        );
        return response.data;
    }

    /**
     * Assign dispute to support agent
     *
     * @param disputeId - Dispute ID
     * @param data - Assignment data (assignedTo: agent ID or name)
     * @returns Promise resolving to updated dispute
     *
     * @example
     * ```typescript
     * const dispute = await sdk.disputes.assign('dsp_abc123', {
     *   assignedTo: 'agent_support01'
     * });
     * ```
     */
    async assign(disputeId: string, data: AssignDisputeRequest): Promise<Dispute> {
        const response = await this.client.post<{ success: boolean; data: Dispute }>(
            `disputes/${disputeId}/assign`,
            data,
        );
        return response.data;
    }

    /**
     * Resolve dispute with decision
     *
     * @param disputeId - Dispute ID
     * @param data - Resolution data
     * @returns Promise resolving to resolved dispute
     *
     * @example
     * ```typescript
     * // Full release to seller
     * await sdk.disputes.resolve('dsp_abc123', {
     *   decision: 'FULL_RELEASE',
     *   note: 'Evidence shows work was completed',
     * });
     *
     * // Full refund to buyer
     * await sdk.disputes.resolve('dsp_abc123', {
     *   decision: 'FULL_REFUND',
     *   note: 'Work was not delivered',
     * });
     *
     * // Split decision
     * await sdk.disputes.resolve('dsp_abc123', {
     *   decision: 'SPLIT',
     *   releaseAmount: '60.00',
     *   refundAmount: '20.00',
     *   note: 'Partial work completed',
     * });
     * ```
     */
    async resolve(disputeId: string, data: ResolveDisputeRequest): Promise<Dispute> {
        const response = await this.client.post<{ success: boolean; data: Dispute }>(
            `disputes/${disputeId}/resolve`,
            data,
        );
        return response.data;
    }
}
