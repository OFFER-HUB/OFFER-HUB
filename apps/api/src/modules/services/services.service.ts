import { Injectable, Inject, Logger, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Service, Prisma, ServiceCategory, Order } from '@prisma/client';
import { CreateServiceDto, UpdateServiceDto, UpdateServiceStatusDto, HireServiceDto } from './dto';
import { ServiceNotFoundException } from './exceptions';

/**
 * ID prefix generator for services
 */
function generateServiceId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `svc_${timestamp}${randomPart}`;
}

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Create a new service
   */
  async createService(userId: string, dto: CreateServiceDto): Promise<Service> {
    this.logger.log(`Creating service for user ${userId}: ${dto.title}`);

    const service = await this.prisma.service.create({
      data: {
        id: generateServiceId(),
        userId,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        price: dto.price,
        deliveryDays: dto.deliveryDays,
        status: 'ACTIVE',
        totalOrders: 0,
        averageRating: null,
      },
    });

    this.logger.log(`Service created: ${service.id}`);
    return service;
  }

  /**
   * List services for a specific user (freelancer)
   */
  async listMyServices(userId: string): Promise<Service[]> {
    this.logger.log(`Listing services for user ${userId}`);

    const services = await this.prisma.service.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    this.logger.log(`Found ${services.length} services`);
    return services;
  }

  /**
   * Get public services with filters (marketplace)
   */
  async getPublicServices(options: {
    category?: ServiceCategory;
    minPrice?: string;
    maxPrice?: string;
    search?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ data: Service[]; hasMore: boolean; nextCursor?: string }> {
    const limit = Math.min(options.limit || 20, 100);

    this.logger.log(`Fetching public services with filters: ${JSON.stringify(options)}`);

    const where: Prisma.ServiceWhereInput = {
      status: 'ACTIVE', // Solo servicios activos
    };

    if (options.category) {
      where.category = options.category;
    }

    if (options.minPrice || options.maxPrice) {
      where.price = {};
      if (options.minPrice) {
        where.price.gte = options.minPrice;
      }
      if (options.maxPrice) {
        where.price.lte = options.maxPrice;
      }
    }

    if (options.search) {
      where.OR = [
        { title: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const services = await this.prisma.service.findMany({
      where,
      include: {
        user: {
          select: { id: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(options.cursor && {
        cursor: { id: options.cursor },
        skip: 1,
      }),
    });

    const hasMore = services.length > limit;
    const data = hasMore ? services.slice(0, limit) : services;
    const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

    this.logger.log(`Found ${data.length} public services (hasMore: ${hasMore})`);
    return { data, hasMore, nextCursor };
  }

  /**
   * Get a single service by ID
   */
  async getServiceById(serviceId: string): Promise<Service> {
    this.logger.log(`Fetching service ${serviceId}`);

    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        user: {
          select: { id: true, email: true },
        },
      },
    });

    if (!service) {
      throw new ServiceNotFoundException(serviceId);
    }

    return service;
  }

  /**
   * Update a service (only owner can update)
   */
  async updateService(serviceId: string, userId: string, dto: UpdateServiceDto): Promise<Service> {
    this.logger.log(`Updating service ${serviceId} by user ${userId}`);

    const service = await this.getServiceById(serviceId);

    // Verify ownership
    if (service.userId !== userId) {
      throw new ForbiddenException('You can only update your own services');
    }

    const updatedService = await this.prisma.service.update({
      where: { id: serviceId },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description && { description: dto.description }),
        ...(dto.category && { category: dto.category }),
        ...(dto.price && { price: dto.price }),
        ...(dto.deliveryDays && { deliveryDays: dto.deliveryDays }),
      },
    });

    this.logger.log(`Service updated: ${serviceId}`);
    return updatedService;
  }

  /**
   * Update service status (active/paused/archived)
   */
  async updateServiceStatus(serviceId: string, userId: string, dto: UpdateServiceStatusDto): Promise<Service> {
    this.logger.log(`Updating service ${serviceId} status to ${dto.status}`);

    const service = await this.getServiceById(serviceId);

    // Verify ownership
    if (service.userId !== userId) {
      throw new ForbiddenException('You can only update your own services');
    }

    const updatedService = await this.prisma.service.update({
      where: { id: serviceId },
      data: { status: dto.status },
    });

    this.logger.log(`Service status updated: ${serviceId} -> ${dto.status}`);
    return updatedService;
  }

  /**
   * Delete a service (only owner can delete)
   */
  async deleteService(serviceId: string, userId: string): Promise<void> {
    this.logger.log(`Deleting service ${serviceId} by user ${userId}`);

    const service = await this.getServiceById(serviceId);

    // Verify ownership
    if (service.userId !== userId) {
      throw new ForbiddenException('You can only delete your own services');
    }

    await this.prisma.service.delete({
      where: { id: serviceId },
    });

    this.logger.log(`Service deleted: ${serviceId}`);
  }

  /**
   * Get orders for a service
   */
  async getServiceOrders(serviceId: string): Promise<any[]> {
    this.logger.log(`Fetching orders for service ${serviceId}`);

    // Verify service exists
    await this.getServiceById(serviceId);

    const orders = await this.prisma.order.findMany({
      where: { serviceId },
      orderBy: { createdAt: 'desc' },
      include: {
        buyer: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    this.logger.log(`Found ${orders.length} orders for service ${serviceId}`);
    return orders;
  }

  /**
   * Hire a service (create order from service)
   */
  async hireService(serviceId: string, buyerId: string, dto: HireServiceDto): Promise<Order> {
    this.logger.log(`User ${buyerId} hiring service ${serviceId}`);

    // Get service with user info
    const service = await this.getServiceById(serviceId);

    // Validate service is active
    if (service.status !== 'ACTIVE') {
      throw new BadRequestException('Service is not available for hire');
    }

    // Prevent self-hire
    if (service.userId === buyerId) {
      throw new ForbiddenException('You cannot hire your own service');
    }

    function generateOrderId(): string {
      const timestamp = Date.now().toString(36);
      const randomPart = Math.random().toString(36).substring(2, 15);
      return `ord_${timestamp}${randomPart}`;
    }

    // Create order
    const order = await this.prisma.order.create({
      data: {
        id: generateOrderId(),
        buyerId,
        sellerId: service.userId,
        serviceId: service.id,
        source: 'SERVICE',
        amount: service.price,
        title: `Service: ${service.title}`,
        description: dto.requirements || service.description,
        status: 'ORDER_CREATED',
        metadata: {
          sourceType: 'service',
          serviceId: service.id,
          deliveryDays: service.deliveryDays,
          ...dto.metadata,
        } as Prisma.InputJsonValue,
      },
    });

    this.logger.log(`Order ${order.id} created from service ${serviceId}`);
    return order;
  }
}
