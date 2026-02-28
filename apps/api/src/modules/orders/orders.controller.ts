import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Query,
    Inject,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import type { Milestone } from '@prisma/client';
import { OrderStatus } from '@offerhub/shared';
import { OrdersService, OrderWithRelations } from './orders.service';
import { CreateOrderDto, CancelOrderDto } from './dto';

/**
 * Orders Controller
 * Handles REST API endpoints for order lifecycle management.
 *
 * Note: All responses are automatically wrapped by the global ResponseInterceptor
 * with the format: { data: T, meta: { requestId, timestamp } }
 */
@Controller('orders')
export class OrdersController {
    constructor(@Inject(OrdersService) private readonly ordersService: OrdersService) {}

    /**
     * Create a new order.
     * POST /orders
     */
    @Post()
    @HttpCode(HttpStatus.CREATED)
    async createOrder(@Body() dto: CreateOrderDto): Promise<OrderWithRelations> {
        const order = await this.ordersService.createOrder(dto);
        return order;
    }

    /**
     * List orders with pagination.
     * GET /orders
     */
    @Get()
    async listOrders(
        @Query('buyer_id') buyerId?: string,
        @Query('seller_id') sellerId?: string,
        @Query('status') status?: string,
        @Query('limit') limit?: string,
        @Query('cursor') cursor?: string,
    ): Promise<{ data: OrderWithRelations[]; hasMore: boolean; nextCursor?: string }> {
        const orderStatus = status && Object.values(OrderStatus).includes(status as OrderStatus)
            ? (status as OrderStatus)
            : undefined;
        const result = await this.ordersService.listOrders({
            buyerId,
            sellerId,
            status: orderStatus,
            limit: limit ? parseInt(limit, 10) : undefined,
            cursor,
        });
        return result;
    }

    /**
     * Get order by ID.
     * GET /orders/:id
     */
    @Get(':id')
    async getOrder(@Param('id') id: string): Promise<OrderWithRelations> {
        const order = await this.ordersService.getOrder(id);
        return order;
    }

    /**
     * Reserve funds for an order.
     * POST /orders/:id/reserve
     */
    @Post(':id/reserve')
    async reserveFunds(@Param('id') id: string): Promise<OrderWithRelations> {
        const order = await this.ordersService.reserveFunds(id);
        return order;
    }

    /**
     * Cancel an order.
     * POST /orders/:id/cancel
     */
    @Post(':id/cancel')
    async cancelOrder(
        @Param('id') id: string,
        @Body() dto?: CancelOrderDto,
    ): Promise<OrderWithRelations> {
        const order = await this.ordersService.cancelOrder(id, dto?.reason);
        return order;
    }

    /**
     * Create escrow contract for an order.
     * POST /orders/:id/escrow
     */
    @Post(':id/escrow')
    async createEscrow(@Param('id') id: string): Promise<OrderWithRelations> {
        const order = await this.ordersService.createEscrow(id);
        return order;
    }

    /**
     * Fund escrow contract.
     * POST /orders/:id/escrow/fund
     */
    @Post(':id/escrow/fund')
    async fundEscrow(@Param('id') id: string): Promise<OrderWithRelations> {
        const order = await this.ordersService.fundEscrow(id);
        return order;
    }

    /**
     * Get milestones for an order.
     * GET /orders/:id/milestones
     */
    @Get(':id/milestones')
    async getMilestones(@Param('id') id: string): Promise<Milestone[]> {
        const milestones = await this.ordersService.getMilestones(id);
        return milestones;
    }

    /**
     * Complete a milestone.
     * POST /orders/:id/milestones/:ref/complete
     */
    @Post(':id/milestones/:ref/complete')
    async completeMilestone(
        @Param('id') id: string,
        @Param('ref') ref: string,
    ): Promise<Milestone> {
        const milestone = await this.ordersService.completeMilestone(id, ref);
        return milestone;
    }

    /**
     * Mark order as completed by seller.
     * POST /orders/:id/complete
     */
    @Post(':id/complete')
    async markAsCompleted(@Param('id') id: string): Promise<OrderWithRelations> {
        const order = await this.ordersService.markAsCompleted(id);
        return order;
    }
}
