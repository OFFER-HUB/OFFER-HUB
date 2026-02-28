import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
} from '@nestjs/common';
import { ServicesService } from './services.service';
import { CreateServiceDto, UpdateServiceDto, UpdateServiceStatusDto, HireServiceDto } from './dto';
import { Service, ServiceCategory, Order } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Services Controller
 * Handles REST API endpoints for service management.
 *
 * Note: All responses are automatically wrapped by the global ResponseInterceptor
 * with the format: { data: T, meta: { requestId, timestamp } }
 */
@Controller('services')
export class ServicesController {
  private readonly logger = new Logger(ServicesController.name);

  constructor(@Inject(ServicesService) private readonly servicesService: ServicesService) {}

  /**
   * Create a new service
   * POST /services
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createService(@Req() req: any, @Body() dto: CreateServiceDto): Promise<Service> {
    const userId = req.user.userId;
    const service = await this.servicesService.createService(userId, dto);
    return service;
  }

  /**
   * List my services (authenticated user)
   * GET /services
   */
  @Get()
  async listMyServices(@Req() req: any): Promise<Service[]> {
    const userId = req.user.userId;
    const services = await this.servicesService.listMyServices(userId);
    return services;
  }

  /**
   * Get a single service by ID
   * GET /services/:id
   */
  @Get(':id')
  async getService(@Param('id') id: string): Promise<Service> {
    const service = await this.servicesService.getServiceById(id);
    return service;
  }

  /**
   * Update a service
   * PUT /services/:id
   */
  @Put(':id')
  async updateService(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: UpdateServiceDto,
  ): Promise<Service> {
    const userId = req.user.userId;
    const service = await this.servicesService.updateService(id, userId, dto);
    return service;
  }

  /**
   * Update service status
   * PATCH /services/:id/status
   */
  @Patch(':id/status')
  async updateServiceStatus(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: UpdateServiceStatusDto,
  ): Promise<Service> {
    const userId = req.user.userId;
    const service = await this.servicesService.updateServiceStatus(id, userId, dto);
    return service;
  }

  /**
   * Delete a service
   * DELETE /services/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteService(@Param('id') id: string, @Req() req: any): Promise<void> {
    const userId = req.user.userId;
    await this.servicesService.deleteService(id, userId);
  }

  /**
   * Get orders for a service
   * GET /services/:id/orders
   */
  @Get(':id/orders')
  async getServiceOrders(@Param('id') id: string): Promise<any[]> {
    const orders = await this.servicesService.getServiceOrders(id);
    return orders;
  }

  /**
   * Hire a service (create order)
   * POST /services/:id/hire
   */
  @Post(':id/hire')
  @HttpCode(HttpStatus.CREATED)
  async hireService(
    @Param('id') serviceId: string,
    @Req() req: any,
    @Body() dto: HireServiceDto,
  ): Promise<Order> {
    const userId = req.user.userId;
    const order = await this.servicesService.hireService(serviceId, userId, dto);
    return order;
  }

  // =====================
  // Public Marketplace Endpoints
  // =====================

  /**
   * Browse public services (marketplace)
   * GET /services/marketplace/services
   */
  @Get('marketplace/services')
  @Public()
  async getMarketplaceServices(
    @Query('category') category?: ServiceCategory,
    @Query('min_price') minPrice?: string,
    @Query('max_price') maxPrice?: string,
    @Query('search') search?: string,
    @Query('limit') limitStr?: string,
    @Query('cursor') cursor?: string,
  ): Promise<{ data: Service[]; hasMore: boolean; nextCursor?: string }> {
    const limit = limitStr ? parseInt(limitStr, 10) : 20;
    return this.servicesService.getPublicServices({
      category,
      minPrice,
      maxPrice,
      search,
      limit,
      cursor,
    });
  }

  /**
   * Get a single public service (marketplace)
   * GET /services/marketplace/services/:id
   */
  @Get('marketplace/services/:id')
  @Public()
  async getMarketplaceService(@Param('id') id: string): Promise<Service> {
    return this.servicesService.getServiceById(id);
  }
}
