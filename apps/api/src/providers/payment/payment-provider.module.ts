import { Module, Logger } from '@nestjs/common';
import { PAYMENT_PROVIDER } from './payment-provider.interface';
import { CryptoNativeProvider } from './crypto-native.provider';
import { DatabaseModule } from '../../modules/database/database.module';

const logger = new Logger('PaymentProviderModule');

@Module({
  imports: [DatabaseModule],
  providers: [
    CryptoNativeProvider,
    {
      provide: PAYMENT_PROVIDER,
      useFactory: (cryptoProvider: CryptoNativeProvider) => {
        const providerType = process.env.PAYMENT_PROVIDER || 'crypto';

        if (providerType === 'airtm') {
          // Future: return AirtmPaymentProvider instance
          logger.warn(
            'AirTM payment provider selected but not yet implemented. Falling back to crypto.',
          );
        }

        logger.log(`Payment provider: crypto-native (Stellar wallets)`);
        return cryptoProvider;
      },
      inject: [CryptoNativeProvider],
    },
  ],
  exports: [PAYMENT_PROVIDER],
})
export class PaymentProviderModule {}
