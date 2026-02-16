import { Module, Logger, forwardRef } from '@nestjs/common';
import { PAYMENT_PROVIDER } from './payment-provider.interface';
import { CryptoNativeProvider } from './crypto-native.provider';
import { WalletModule } from '../../modules/wallet/wallet.module';

const logger = new Logger('PaymentProviderModule');

@Module({
  imports: [forwardRef(() => WalletModule)],
  providers: [
    CryptoNativeProvider,
    {
      provide: PAYMENT_PROVIDER,
      useFactory: (cryptoProvider: CryptoNativeProvider) => {
        const providerType = process.env.PAYMENT_PROVIDER || 'crypto';

        if (providerType === 'airtm') {
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
