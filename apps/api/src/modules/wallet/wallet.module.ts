import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { BlockchainMonitorService } from './blockchain-monitor.service';
import { DatabaseModule } from '../database/database.module';
import { TrustlessWorkModule } from '../../providers/trustless-work/trustless-work.module';
import { EventsModule } from '../events/events.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, TrustlessWorkModule, EventsModule, AuthModule],
  controllers: [WalletController],
  providers: [WalletService, BlockchainMonitorService],
  exports: [WalletService],
})
export class WalletModule {}
