import {
    Controller,
    Post,
    Body,
    Headers,
    RawBodyRequest,
    Req,
    HttpCode,
    HttpStatus,
    Logger,
    Inject,
} from '@nestjs/common';
import { Request } from 'express';
import { AirtmWebhookService } from '../../providers/airtm';
import type { SvixWebhookHeaders } from '../../providers/airtm';
import { WebhookService } from '../../providers/trustless-work/services/webhook.service';
import type { TrustlessWebhookEvent } from '../../providers/trustless-work/types/trustless-work.types';

/**
 * Controller for receiving webhooks from external providers.
 * Handles Airtm and Trustless Work webhook events.
 */
@Controller('webhooks')
export class WebhooksController {
    private readonly logger = new Logger(WebhooksController.name);

    constructor(
        @Inject(AirtmWebhookService) private readonly airtmWebhookService: AirtmWebhookService,
        @Inject(WebhookService) private readonly trustlessWebhookService: WebhookService,
    ) {}

    /**
     * Receives webhooks from Airtm.
     *
     * Flow:
     * 1. Verify signature using Svix headers
     * 2. Return 200 OK immediately (before processing)
     * 3. Process event asynchronously
     *
     * @see https://docs.airtm.io/webhooks
     */
    @Post('airtm')
    @HttpCode(HttpStatus.OK)
    async handleAirtmWebhook(
        @Req() req: RawBodyRequest<Request>,
        @Headers('svix-id') svixId: string,
        @Headers('svix-timestamp') svixTimestamp: string,
        @Headers('svix-signature') svixSignature: string,
    ): Promise<{ status: string; processed?: boolean; duplicate?: boolean }> {
        this.logger.log(`Received Airtm webhook: svix-id=${svixId}`);

        // Get raw body for signature verification
        const rawBody = req.rawBody?.toString() || JSON.stringify(req.body);

        // Build Svix headers object
        const svixHeaders: SvixWebhookHeaders = {
            'svix-id': svixId,
            'svix-timestamp': svixTimestamp,
            'svix-signature': svixSignature,
        };

        // 1. Verify signature (throws 401 if invalid)
        const payload = this.airtmWebhookService.verifySignature(rawBody, svixHeaders);

        // 2. Process the event
        const result = await this.airtmWebhookService.processEvent(payload);

        if (result.duplicate) {
            this.logger.debug(`Duplicate webhook ignored: ${result.eventId}`);
            return { status: 'ok', duplicate: true };
        }

        if (!result.success) {
            this.logger.warn(`Webhook processing failed: ${result.error}`);
            // Still return 200 to prevent retries for business logic errors
            return { status: 'ok', processed: false };
        }

        this.logger.log(
            `Webhook processed: eventId=${result.eventId}, type=${result.eventType}, ` +
            `resource=${result.resourceId}, newStatus=${result.newStatus}`,
        );

        return { status: 'ok', processed: true };
    }

    /**
     * Receives webhooks from Trustless Work.
     * Verifies HMAC-SHA256 signature and processes escrow lifecycle events.
     *
     * Events handled:
     * - escrow.created → ESCROW_FUNDING
     * - escrow.funding_started → updates escrow status
     * - escrow.funded → IN_PROGRESS
     * - escrow.released → confirms release, credits seller
     * - escrow.refunded → confirms refund, credits buyer
     * - escrow.disputed → marks escrow as DISPUTED
     *
     * @see https://docs.trustlesswork.com/trustless-work/api-reference
     */
    @Post('trustless-work')
    @HttpCode(HttpStatus.OK)
    async handleTrustlessWorkWebhook(
        @Req() req: RawBodyRequest<Request>,
        @Headers('x-tw-signature') signature: string,
        @Body() body: TrustlessWebhookEvent,
    ): Promise<{ status: string; processed?: boolean }> {
        this.logger.log(
            `Received Trustless Work webhook: type=${body.type}, event_id=${body.event_id}`,
        );

        // Get raw body for signature verification
        const rawBody = req.rawBody?.toString() || JSON.stringify(req.body);

        // Verify HMAC-SHA256 signature (throws 401 if invalid)
        if (signature) {
            this.trustlessWebhookService.verifySignature(rawBody, signature);
        } else {
            this.logger.warn('Trustless Work webhook received without signature header');
        }

        // Process the event (handles deduplication internally)
        const result = await this.trustlessWebhookService.processWebhook(body);

        this.logger.log(
            `Trustless Work webhook processed: event_id=${body.event_id}, success=${result.success}`,
        );

        return { status: 'ok', processed: result.success };
    }
}
