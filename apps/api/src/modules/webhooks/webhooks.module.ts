import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { AirtmModule } from '../../providers/airtm';
import { TrustlessWorkModule } from '../../providers/trustless-work/trustless-work.module';

/**
 * Module for handling incoming webhooks from external providers.
 *
 * Endpoints:
 * - POST /webhooks/airtm - Airtm payin/payout events
 * - POST /webhooks/trustless-work - Escrow lifecycle events
 */
@Module({
    imports: [AirtmModule, TrustlessWorkModule],
    controllers: [WebhooksController],
})
export class WebhooksModule {}
