# Payment Provider Interface (Strategy Pattern)

**Status:** Planned
**Date:** 2026-02-16

---

## Overview

The Provider Interface decouples the Orchestrator's business logic from the payment method. Marketplace operators choose their provider via `PAYMENT_PROVIDER` env var.

## Interface Definition

```typescript
// apps/api/src/providers/payment/payment-provider.interface.ts

export interface PaymentProvider {
  /**
   * Initialize a user's payment capability.
   * - Crypto: Creates invisible Stellar wallet
   * - AirTM: Links AirTM account (requires separate step)
   */
  initializeUser(userId: string): Promise<PaymentUserInfo>;

  /**
   * Check if user is ready to transact.
   * - Crypto: Has wallet with USDC trustline
   * - AirTM: Has linked + verified AirTM account
   */
  isUserReady(userId: string): Promise<boolean>;

  /**
   * Get user's available balance.
   * - Crypto: Query Stellar blockchain for USDC balance
   * - AirTM: Query AirTM API for balance
   */
  getBalance(userId: string): Promise<string>;

  /**
   * Get deposit instructions for user.
   * - Crypto: Return Stellar public address
   * - AirTM: Return top-up confirmation URI
   */
  getDepositInfo(userId: string): Promise<DepositInfo>;

  /**
   * Sign and submit an escrow funding transaction.
   * - Crypto: Decrypt key, sign XDR, submit
   * - AirTM: Not applicable (funds come from DB balance)
   */
  signEscrowTransaction(userId: string, xdr: string): Promise<string>;

  /**
   * Send payment from user to an external address/account.
   * - Crypto: Send USDC on Stellar
   * - AirTM: Create payout via AirTM API
   */
  sendPayment(userId: string, destination: string, amount: string): Promise<PaymentResult>;
}

export interface PaymentUserInfo {
  provider: 'crypto' | 'airtm';
  publicAddress?: string;    // Stellar public key (crypto)
  providerUserId?: string;   // AirTM user ID (airtm)
  ready: boolean;
}

export interface DepositInfo {
  provider: 'crypto' | 'airtm';
  method: 'stellar_address' | 'redirect_uri';
  address?: string;          // Stellar public key
  confirmationUri?: string;  // AirTM redirect URL
  instructions: string;      // Human-readable instructions
}

export interface PaymentResult {
  transactionHash?: string;  // Stellar tx hash (crypto)
  providerRef?: string;      // AirTM payout ref (airtm)
  status: 'completed' | 'pending' | 'failed';
}
```

## Implementation: CryptoNativeProvider

```typescript
// apps/api/src/providers/payment/crypto-native.provider.ts

@Injectable()
export class CryptoNativeProvider implements PaymentProvider {
  constructor(
    private walletService: WalletService,
    private prisma: PrismaService,
  ) {}

  async initializeUser(userId: string): Promise<PaymentUserInfo> {
    const publicKey = await this.walletService.createWallet(userId);
    return {
      provider: 'crypto',
      publicAddress: publicKey,
      ready: true,
    };
  }

  async isUserReady(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { stellarPublicKey: true },
    });
    return !!user?.stellarPublicKey;
  }

  async getBalance(userId: string): Promise<string> {
    return this.walletService.getBalance(userId);
  }

  async getDepositInfo(userId: string): Promise<DepositInfo> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { stellarPublicKey: true },
    });
    return {
      provider: 'crypto',
      method: 'stellar_address',
      address: user.stellarPublicKey,
      instructions: 'Send USDC to this Stellar address to deposit funds.',
    };
  }

  async signEscrowTransaction(userId: string, xdr: string): Promise<string> {
    return this.walletService.signTransaction(userId, xdr);
  }

  async sendPayment(userId: string, destination: string, amount: string): Promise<PaymentResult> {
    const txHash = await this.walletService.sendPayment(userId, destination, amount);
    return {
      transactionHash: txHash,
      status: 'completed',
    };
  }
}
```

## Module Registration

```typescript
// apps/api/src/providers/payment/payment-provider.module.ts

@Module({
  providers: [
    {
      provide: 'PAYMENT_PROVIDER',
      useFactory: (
        config: ConfigService,
        walletService: WalletService,
        prisma: PrismaService,
      ) => {
        const provider = config.get('PAYMENT_PROVIDER', 'crypto');
        if (provider === 'crypto') {
          return new CryptoNativeProvider(walletService, prisma);
        }
        // Future: return new AirtmPaymentProvider(...);
        throw new Error(`Unknown payment provider: ${provider}`);
      },
      inject: [ConfigService, WalletService, PrismaService],
    },
  ],
  exports: ['PAYMENT_PROVIDER'],
})
export class PaymentProviderModule {}
```

## Usage in Services

```typescript
// In any service that needs payment operations:

@Injectable()
export class OrdersService {
  constructor(
    @Inject('PAYMENT_PROVIDER')
    private paymentProvider: PaymentProvider,
  ) {}

  async createEscrow(orderId: string) {
    // Instead of checking buyer.airtmUserId:
    const isReady = await this.paymentProvider.isUserReady(order.buyerId);
    if (!isReady) throw new BadRequestException('User payment not initialized');

    // Sign escrow transaction:
    const signedXdr = await this.paymentProvider.signEscrowTransaction(
      order.buyerId,
      unsignedXdr,
    );
    // ...
  }
}
```

## Future: AirtmPaymentProvider

When AirTM access is available, implement the same interface:

```typescript
@Injectable()
export class AirtmPaymentProvider implements PaymentProvider {
  // Wraps existing AirTM clients (airtm-payin, airtm-payout, airtm-user)
  // Maps to the same interface
  // No changes needed in business logic services
}
```

Switch with: `PAYMENT_PROVIDER=airtm` in `.env`.
