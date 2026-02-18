import { Controller, Get, Post, Param, Body, Inject, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { ResolutionService, DisputeWithRelations } from '../resolution/resolution.service';
import { AssignDisputeDto, ResolveDisputeDto } from '../resolution/dto';

/**
 * API response wrapper.
 */
interface ApiResponse<T> {
    success: boolean;
    data: T;
}

/**
 * Disputes Controller
 * Handles REST API endpoints for dispute management (CRUD operations).
 */
@Controller('disputes')
export class DisputesController {
    constructor(
        @Inject(ResolutionService) private readonly resolutionService: ResolutionService,
    ) {}

    /**
     * List disputes with optional filters.
     * GET /disputes?orderId=ord_...&status=OPEN&openedBy=BUYER
     */
    @Get()
    async listDisputes(
        @Query('orderId') orderId?: string,
        @Query('status') status?: string,
        @Query('openedBy') openedBy?: string,
    ): Promise<ApiResponse<DisputeWithRelations[]>> {
        const disputes = await this.resolutionService.listDisputes({ orderId, status, openedBy });
        return { success: true, data: disputes };
    }

    /**
     * Get dispute by ID.
     * GET /disputes/:id
     */
    @Get(':id')
    async getDispute(@Param('id') id: string): Promise<ApiResponse<DisputeWithRelations>> {
        const dispute = await this.resolutionService.getDispute(id);
        return { success: true, data: dispute };
    }

    /**
     * Assign dispute to support agent.
     * POST /disputes/:id/assign
     */
    @Post(':id/assign')
    @HttpCode(HttpStatus.OK)
    async assignDispute(
        @Param('id') id: string,
        @Body() dto: AssignDisputeDto,
    ): Promise<ApiResponse<DisputeWithRelations>> {
        const dispute = await this.resolutionService.assignDispute(id, dto);
        return { success: true, data: dispute };
    }

    /**
     * Resolve dispute with decision.
     * POST /disputes/:id/resolve
     */
    @Post(':id/resolve')
    @HttpCode(HttpStatus.OK)
    async resolveDispute(
        @Param('id') id: string,
        @Body() dto: ResolveDisputeDto,
    ): Promise<ApiResponse<DisputeWithRelations>> {
        const dispute = await this.resolutionService.resolveDispute(id, dto);
        return { success: true, data: dispute };
    }
}
