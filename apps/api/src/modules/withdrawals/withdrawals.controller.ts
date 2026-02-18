import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
    Inject,
} from '@nestjs/common';
import {
    WithdrawalsService,
    type CreateWithdrawalResponse,
    type WithdrawalResponse,
} from './withdrawals.service';
import { CreateWithdrawalDto } from './dto';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { Scopes } from '../../common/decorators/scopes.decorator';

/**
 * Controller for withdrawal (payout) operations.
 *
 * Endpoints:
 * - POST /withdrawals - Create a new withdrawal
 * - GET /withdrawals?userId= - List user's withdrawals
 * - GET /withdrawals/:id?userId= - Get a specific withdrawal
 * - POST /withdrawals/:id/commit?userId= - Commit a pending withdrawal
 * - POST /withdrawals/:id/refresh?userId= - Refresh withdrawal status from Airtm
 *
 * Note: userId is passed in the request body (POST) or as a query param (GET).
 * The Orchestrator is a server-to-server API — userId identifies the acting user.
 */
@Controller('withdrawals')
@UseGuards(ApiKeyGuard, ScopeGuard)
export class WithdrawalsController {
    constructor(@Inject(WithdrawalsService) private readonly withdrawalsService: WithdrawalsService) {}

    /**
     * Creates a new withdrawal for a user.
     * By default creates in two-step mode (requires commit).
     * Set commit=true for one-step withdrawal.
     */
    @Post()
    @Scopes('write')
    @HttpCode(HttpStatus.CREATED)
    async createWithdrawal(
        @Body() dto: CreateWithdrawalDto,
    ): Promise<CreateWithdrawalResponse> {
        return this.withdrawalsService.createWithdrawal(dto.userId, dto);
    }

    /**
     * Lists withdrawals for a user.
     */
    @Get()
    @Scopes('read')
    async listWithdrawals(
        @Query('userId') userId: string,
        @Query('limit') limit?: string,
        @Query('cursor') cursor?: string,
    ): Promise<{ data: WithdrawalResponse[]; hasMore: boolean; nextCursor?: string }> {
        return this.withdrawalsService.listWithdrawals(userId, {
            limit: limit ? parseInt(limit, 10) : undefined,
            cursor,
        });
    }

    /**
     * Gets a specific withdrawal by ID.
     */
    @Get(':id')
    @Scopes('read')
    async getWithdrawal(
        @Query('userId') userId: string,
        @Param('id') withdrawalId: string,
    ): Promise<WithdrawalResponse> {
        return this.withdrawalsService.getWithdrawal(withdrawalId, userId);
    }

    /**
     * Commits a withdrawal that was created without auto-commit.
     * Only works for withdrawals in WITHDRAWAL_CREATED status.
     */
    @Post(':id/commit')
    @Scopes('write')
    @HttpCode(HttpStatus.OK)
    async commitWithdrawal(
        @Query('userId') userId: string,
        @Param('id') withdrawalId: string,
    ): Promise<WithdrawalResponse> {
        return this.withdrawalsService.commitWithdrawal(withdrawalId, userId);
    }

    /**
     * Refreshes withdrawal status from Airtm.
     * Use when webhook may have been missed.
     */
    @Post(':id/refresh')
    @Scopes('read')
    @HttpCode(HttpStatus.OK)
    async refreshWithdrawal(
        @Query('userId') userId: string,
        @Param('id') withdrawalId: string,
    ): Promise<WithdrawalResponse> {
        return this.withdrawalsService.refreshWithdrawal(withdrawalId, userId);
    }
}
