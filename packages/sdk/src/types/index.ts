/**
 * Common types for OfferHub SDK
 */

// ==================== Common Types ====================

export interface PaginationParams {
    limit?: number;
    cursor?: string;
}

export interface PaginatedResponse<T> {
    data: T[];
    hasMore: boolean;
    nextCursor?: string;
}

export interface ApiResponse<T> {
    success: boolean;
    data: T;
}

// ==================== User Types ====================

export enum UserType {
    BUYER = 'BUYER',
    SELLER = 'SELLER',
    BOTH = 'BOTH',
}

export interface CreateUserRequest {
    externalUserId: string;
    email?: string;
    type?: UserType;
}

export interface User {
    id: string;
    externalUserId: string;
    email?: string;
    type: UserType;
    airtmEmail?: string;
    airtmLinkedAt?: string;
    wallet?: WalletInfo;
    createdAt: string;
    updatedAt: string;
}

// ==================== Wallet Types ====================

export interface WalletInfo {
    publicKey: string;
    type: 'INVISIBLE' | 'EXTERNAL';
    provider: 'STELLAR';
    isActive: boolean;
    isPrimary: boolean;
    balance: WalletBalance;
    createdAt: string;
}

export interface WalletBalance {
    usdc: string;
    xlm: string;
}

export interface DepositInfo {
    provider: string;
    method: string;
    address: string;
    asset: {
        code: string;
        issuer: string;
    };
    network: string;
    instructions: string;
}

export interface WalletTransaction {
    id: string;
    type: string;
    from: string;
    to: string;
    amount: string;
    asset: string;
    createdAt: string;
    hash: string;
    successful: boolean;
}

export interface LinkAirtmRequest {
    email: string;
}

export interface LinkAirtmResponse {
    success: boolean;
    airtmEmail: string;
    linkedAt: string;
}

// ==================== Balance Types ====================

export interface Balance {
    available: string;
    reserved: string;
    currency: string;
    userId: string;
    updatedAt: string;
}

export interface CreditAvailableRequest {
    amount: string;
    description: string;
    reference?: string;
}

export interface DebitAvailableRequest {
    amount: string;
    description: string;
    reference?: string;
}

export interface ReserveRequest {
    amount: string;
    reference: string;
}

export interface ReleaseRequest {
    amount: string;
    reference: string;
    recipientId: string;
}

export interface CancelReservationRequest {
    amount: string;
    reference: string;
}

export interface DeductReservedRequest {
    amount: string;
    reference: string;
}

// ==================== Order Types ====================

export enum OrderStatus {
    ORDER_CREATED = 'ORDER_CREATED',
    FUNDS_RESERVED = 'FUNDS_RESERVED',
    ESCROW_CREATED = 'ESCROW_CREATED',
    ESCROW_FUNDED = 'ESCROW_FUNDED',
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
    RELEASED = 'RELEASED',
    REFUNDED = 'REFUNDED',
    DISPUTED = 'DISPUTED',
    CANCELLED = 'CANCELLED',
}

export interface Milestone {
    id: string;
    orderId: string;
    ref: string;
    description: string;
    amount?: string;
    status: string;
    completedAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface MilestoneInput {
    ref: string;
    description: string;
    amount?: string;
}

export interface CreateOrderRequest {
    client_order_ref?: string;
    buyer_id: string;
    seller_id: string;
    amount: string;
    currency?: string;
    title: string;
    description?: string;
    milestones?: MilestoneInput[];
    metadata?: Record<string, any>;
}

export interface Order {
    id: string;
    clientOrderRef?: string;
    buyerId: string;
    sellerId: string;
    amount: string;
    currency: string;
    status: OrderStatus;
    title: string;
    description?: string;
    metadata?: Record<string, any>;
    escrow?: Escrow;
    dispute?: Dispute;
    milestones?: Milestone[];
    createdAt: string;
    updatedAt: string;
}

export interface CancelOrderRequest {
    reason?: string;
}

export interface ListOrdersParams extends PaginationParams {
    buyer_id?: string;
    seller_id?: string;
    status?: OrderStatus;
}

// ==================== Escrow Types ====================

export enum EscrowStatus {
    CREATING = 'CREATING',
    CREATED = 'CREATED',
    FUNDING = 'FUNDING',
    FUNDED = 'FUNDED',
    RELEASING = 'RELEASING',
    RELEASED = 'RELEASED',
    REFUNDING = 'REFUNDING',
    REFUNDED = 'REFUNDED',
    DISPUTED = 'DISPUTED',
}

export interface Escrow {
    id: string;
    orderId: string;
    contractId?: string;
    amount: string;
    currency: string;
    status: EscrowStatus;
    txHash?: string;
    createdAt: string;
    updatedAt: string;
}

// ==================== TopUp Types ====================

export enum TopUpStatus {
    TOPUP_CREATED = 'TOPUP_CREATED',
    TOPUP_AWAITING_USER_CONFIRMATION = 'TOPUP_AWAITING_USER_CONFIRMATION',
    TOPUP_PROCESSING = 'TOPUP_PROCESSING',
    TOPUP_SUCCEEDED = 'TOPUP_SUCCEEDED',
    TOPUP_FAILED = 'TOPUP_FAILED',
    TOPUP_CANCELLED = 'TOPUP_CANCELLED',
}

export interface CreateTopUpRequest {
    amount: string;
    currency?: string;
    description?: string;
}

export interface TopUp {
    id: string;
    userId: string;
    amount: string;
    currency: string;
    status: TopUpStatus;
    airtmPayinId?: string;
    confirmationUri?: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
}

// ==================== Withdrawal Types ====================

export enum WithdrawalStatus {
    WITHDRAWAL_CREATED = 'WITHDRAWAL_CREATED',
    WITHDRAWAL_PROCESSING = 'WITHDRAWAL_PROCESSING',
    WITHDRAWAL_SUCCEEDED = 'WITHDRAWAL_SUCCEEDED',
    WITHDRAWAL_FAILED = 'WITHDRAWAL_FAILED',
}

export interface CreateWithdrawalRequest {
    amount: string;
    currency?: string;
    description?: string;
    commit?: boolean;
}

export interface Withdrawal {
    id: string;
    userId: string;
    amount: string;
    currency: string;
    status: WithdrawalStatus;
    airtmPayoutId?: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
}

// ==================== Dispute Types ====================

export enum DisputeStatus {
    OPEN = 'OPEN',
    UNDER_REVIEW = 'UNDER_REVIEW',
    RESOLVED = 'RESOLVED',
}

export enum DisputeOpenedBy {
    BUYER = 'BUYER',
    SELLER = 'SELLER',
}

export enum DisputeReason {
    NOT_DELIVERED = 'NOT_DELIVERED',
    QUALITY_ISSUE = 'QUALITY_ISSUE',
    OTHER = 'OTHER',
}

export enum ResolutionDecision {
    FULL_RELEASE = 'FULL_RELEASE',
    FULL_REFUND = 'FULL_REFUND',
    SPLIT = 'SPLIT',
}

export interface OpenDisputeRequest {
    openedBy: DisputeOpenedBy;
    reason: DisputeReason;
    evidence?: string[];
}

export interface AssignDisputeRequest {
    assignedTo: string;
}

export interface ResolveDisputeRequest {
    decision: ResolutionDecision;
    releaseAmount?: string;
    refundAmount?: string;
    note?: string;
}

export interface ListDisputesParams {
    orderId?: string;
    status?: DisputeStatus;
    openedBy?: DisputeOpenedBy;
}

export interface Dispute {
    id: string;
    orderId: string;
    openedBy: DisputeOpenedBy;
    reason: DisputeReason;
    evidence?: string[];
    status: DisputeStatus;
    resolutionDecision?: ResolutionDecision;
    decisionNote?: string;
    createdAt: string;
    updatedAt: string;
    order?: Order;
}

// ==================== Resolution Types ====================

export interface RequestReleaseRequest {
    reason?: string;
}

export interface RequestRefundRequest {
    reason: string;
}
