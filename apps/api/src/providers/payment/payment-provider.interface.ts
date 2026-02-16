/**
 * PaymentProvider interface (Strategy Pattern)
 *
 * Decouples business logic from the payment method.
 * Implementations:
 * - CryptoNativeProvider: Invisible Stellar wallets (default)
 * - AirtmProvider: AirTM fiat gateway (future)
 *
 * Marketplace operators choose via PAYMENT_PROVIDER env var.
 */

export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';

export interface PaymentUserInfo {
  provider: 'crypto' | 'airtm';
  /** Stellar public key (crypto) or AirTM user ID (airtm) */
  publicAddress?: string;
  providerUserId?: string;
  ready: boolean;
}

export interface DepositInfo {
  provider: 'crypto' | 'airtm';
  method: 'stellar_address' | 'redirect_uri';
  /** Stellar public key for deposits */
  address?: string;
  /** AirTM redirect URL for top-up */
  confirmationUri?: string;
  /** Human-readable instructions */
  instructions: string;
}

export interface PaymentResult {
  /** Stellar transaction hash (crypto) */
  transactionHash?: string;
  /** AirTM payout reference (airtm) */
  providerRef?: string;
  status: 'completed' | 'pending' | 'failed';
}

export interface PaymentProvider {
  /**
   * Initialize a user's payment capability.
   * - Crypto: creates invisible Stellar wallet
   * - AirTM: no-op (user links manually)
   */
  initializeUser(userId: string): Promise<PaymentUserInfo>;

  /**
   * Check if user is ready to transact.
   * - Crypto: has active wallet with USDC trustline
   * - AirTM: has linked + verified AirTM account
   */
  isUserReady(userId: string): Promise<boolean>;

  /**
   * Get user's available balance from the provider.
   * - Crypto: query Stellar Horizon for USDC balance
   * - AirTM: query AirTM API
   */
  getBalance(userId: string): Promise<string>;

  /**
   * Get deposit instructions for user.
   * - Crypto: return Stellar public address
   * - AirTM: return top-up confirmation URI
   */
  getDepositInfo(userId: string): Promise<DepositInfo>;

  /**
   * Sign an escrow transaction on behalf of the user.
   * - Crypto: decrypt key, sign XDR, return signed XDR
   * - AirTM: not applicable (throws)
   */
  signEscrowTransaction(userId: string, xdr: string): Promise<string>;

  /**
   * Send payment from user to an external address/account.
   * - Crypto: send USDC on Stellar
   * - AirTM: create payout via AirTM API
   */
  sendPayment(
    userId: string,
    destination: string,
    amount: string,
  ): Promise<PaymentResult>;
}
