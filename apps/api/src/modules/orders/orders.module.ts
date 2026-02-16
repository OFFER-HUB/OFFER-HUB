import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { BalanceModule } from '../balance/balance.module';
import { TrustlessWorkModule } from '../../providers/trustless-work/trustless-work.module';
import { PaymentProviderModule } from '../../providers/payment/payment-provider.module';
import { EventsModule } from '../events/events.module';

/**
 * Orders Module
 * Handles order lifecycle management, funds reservation, and escrow orchestration
 */
@Module({
    imports: [
        BalanceModule, // For funds reservation/deduction
        TrustlessWorkModule, // For escrow creation/funding
        PaymentProviderModule, // For provider-agnostic payment checks
        EventsModule,
    ],
    controllers: [OrdersController],
    providers: [OrdersService],
    exports: [OrdersService],
})
export class OrdersModule { }
