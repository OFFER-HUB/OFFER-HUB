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
          throw new Error(
            'AirTM PaymentProvider is not yet available in this version. ' +
            'Set PAYMENT_PROVIDER=crypto to use Stellar USDC wallets. ' +
            'AirTM support is planned for a future release.',
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
