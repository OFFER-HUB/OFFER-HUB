import { Injectable, Logger, Inject, ForbiddenException, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Application, ApplicationStatus, OfferStatus, Prisma } from '@prisma/client';
import { CreateApplicationDto, UpdateApplicationStatusDto, ApplicationFiltersDto } from './dto';

function generateApplicationId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `app_${timestamp}${randomPart}`;
}

export type ApplicationWithRelations = Application & {
  freelancer: {
    id: string;
    email: string;
  };
  offer: {
    id: string;
    title: string;
    budget: string;
    userId: string;
    description: string;
  };
  order?: {
    id: string;
  };
};

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Freelancer: Aplicar a una oferta
   */
  async applyToOffer(
    freelancerId: string,
    offerId: string,
    dto: CreateApplicationDto,
  ): Promise<Application> {
    this.logger.log(`Freelancer ${freelancerId} applying to offer ${offerId}`);

    // Verificar que la oferta existe y está activa
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
    });

    if (!offer) {
      throw new NotFoundException(`Offer ${offerId} not found`);
    }

    if (offer.status !== OfferStatus.ACTIVE) {
      throw new BadRequestException('Cannot apply to inactive offers');
    }

    // Verificar que el freelancer no sea el dueño de la oferta
    if (offer.userId === freelancerId) {
      throw new ForbiddenException('Cannot apply to your own offer');
    }

    // Verificar que no haya aplicado previamente
    const existingApplication = await this.prisma.application.findUnique({
      where: {
        offerId_freelancerId: {
          offerId,
          freelancerId,
        },
      },
    });

    if (existingApplication) {
      throw new ConflictException('You have already applied to this offer');
    }

    // Crear aplicación e incrementar contador en transacción
    const [application] = await this.prisma.$transaction([
      this.prisma.application.create({
        data: {
          id: generateApplicationId(),
          offerId,
          freelancerId,
          coverLetter: dto.coverLetter,
          proposedRate: dto.proposedRate,
          status: ApplicationStatus.PENDING,
        },
      }),
      this.prisma.offer.update({
        where: { id: offerId },
        data: {
          applicantsCount: {
            increment: 1,
          },
        },
      }),
    ]);

    this.logger.log(`Application created: ${application.id}`);
    return application;
  }

  /**
   * Freelancer: Obtener sus propias aplicaciones
   */
  async getMyApplications(
    freelancerId: string,
    filters?: ApplicationFiltersDto,
  ): Promise<ApplicationWithRelations[]> {
    this.logger.log(`Fetching applications for freelancer ${freelancerId}`);

    const where: any = { freelancerId };

    if (filters?.status) {
      where.status = filters.status;
    }

    const applications = await this.prisma.application.findMany({
      where,
      include: {
        freelancer: {
          select: { id: true, email: true },
        },
        offer: {
          select: { id: true, title: true, budget: true, userId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 50,
      ...(filters?.cursor && {
        cursor: { id: filters.cursor },
        skip: 1,
      }),
    });

    this.logger.log(`Found ${applications.length} applications`);
    return applications;
  }

  /**
   * Cliente: Obtener aplicantes de una oferta específica
   */
  async getOfferApplications(
    offerId: string,
    clientId: string,
    filters?: ApplicationFiltersDto,
  ): Promise<ApplicationWithRelations[]> {
    this.logger.log(`Fetching applications for offer ${offerId}`);

    // Verificar ownership de la oferta
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
    });

    if (!offer) {
      throw new NotFoundException(`Offer ${offerId} not found`);
    }

    if (offer.userId !== clientId) {
      throw new ForbiddenException('You can only view applications for your own offers');
    }

    const where: any = { offerId };

    if (filters?.status) {
      where.status = filters.status;
    }

    const applications = await this.prisma.application.findMany({
      where,
      include: {
        freelancer: {
          select: { id: true, email: true },
        },
        offer: {
          select: { id: true, title: true, budget: true, userId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 50,
      ...(filters?.cursor && {
        cursor: { id: filters.cursor },
        skip: 1,
      }),
    });

    this.logger.log(`Found ${applications.length} applications for offer ${offerId}`);
    return applications;
  }

  /**
   * Cliente: Aceptar/Rechazar aplicación
   */
  async updateApplicationStatus(
    applicationId: string,
    clientId: string,
    dto: UpdateApplicationStatusDto,
  ): Promise<Application> {
    this.logger.log(`Updating application ${applicationId} status to ${dto.status}`);

    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        offer: true,
        freelancer: {
          select: { id: true, email: true }
        }
      },
    });

    if (!application) {
      throw new NotFoundException(`Application ${applicationId} not found`);
    }

    // Verificar que el usuario sea el dueño de la oferta
    if (application.offer.userId !== clientId) {
      throw new ForbiddenException('You can only manage applications for your own offers');
    }

    // Solo se pueden aceptar/rechazar aplicaciones PENDING
    if (application.status !== ApplicationStatus.PENDING) {
      throw new BadRequestException(`Cannot update application with status ${application.status}`);
    }

    // If ACCEPTING application → Create order atomically
    if (dto.status === ApplicationStatus.ACCEPTED) {
      return this.acceptApplicationAndCreateOrder(application, clientId);
    }

    // If REJECTING → Simple update
    if (dto.status === ApplicationStatus.REJECTED) {
      return this.rejectApplication(application, clientId);
    }

    throw new BadRequestException('Invalid status');
  }

  /**
   * Private: Accept application and create order atomically
   */
  private async acceptApplicationAndCreateOrder(
    application: any,
    clientId: string,
  ): Promise<Application> {
    this.logger.log(`Accepting application ${application.id} and creating order`);

    function generateOrderId(): string {
      const timestamp = Date.now().toString(36);
      const randomPart = Math.random().toString(36).substring(2, 15);
      return `ord_${timestamp}${randomPart}`;
    }

    function formatAmount(amount: string | number): string {
      const num = typeof amount === 'string' ? parseFloat(amount) : amount;
      return num.toFixed(2);
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        // 1. Create Order
        const order = await tx.order.create({
          data: {
            id: generateOrderId(),
            buyerId: application.offer.userId,
            sellerId: application.freelancerId,
            amount: formatAmount(application.proposedRate || application.offer.budget),
            source: 'APPLICATION',
            title: `Order for: ${application.offer.title}`,
            description: application.offer.description,
            status: 'ORDER_CREATED',
            metadata: {
              applicationId: application.id,
              offerId: application.offer.id,
              proposedRate: application.proposedRate,
              coverLetter: application.coverLetter,
            } as Prisma.InputJsonValue,
          },
        });

        // 2. Update Application with orderId
        const updatedApplication = await tx.application.update({
          where: { id: application.id },
          data: {
            status: 'ACCEPTED',
            orderId: order.id,
          },
          include: {
            offer: {
              select: { id: true, title: true, budget: true, userId: true, description: true },
            },
            freelancer: {
              select: { id: true, email: true },
            },
            order: {
              select: { id: true },
            },
          },
        });

        // 3. Mark Offer as COMPLETED (no longer accepting applications)
        await tx.offer.update({
          where: { id: application.offer.id },
          data: { status: 'COMPLETED' },
        });

        // 4. Auto-reject other pending applications for this offer
        await tx.application.updateMany({
          where: {
            offerId: application.offer.id,
            id: { not: application.id },
            status: 'PENDING',
          },
          data: { status: 'REJECTED' },
        });

        this.logger.log(`Order ${order.id} created from application ${application.id}`);
        return updatedApplication;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15000,
      }
    );

    return result;
  }

  /**
   * Private: Reject application
   */
  private async rejectApplication(
    application: any,
    clientId: string,
  ): Promise<Application> {
    this.logger.log(`Rejecting application ${application.id}`);

    const updated = await this.prisma.application.update({
      where: { id: application.id },
      data: { status: 'REJECTED' },
      include: {
        offer: {
          select: { id: true, title: true, budget: true, userId: true, description: true },
        },
        freelancer: {
          select: { id: true, email: true },
        },
      },
    });

    this.logger.log(`Application ${application.id} rejected`);
    return updated;
  }

  /**
   * Freelancer: Retirar aplicación
   */
  async withdrawApplication(
    applicationId: string,
    freelancerId: string,
  ): Promise<void> {
    this.logger.log(`Freelancer ${freelancerId} withdrawing application ${applicationId}`);

    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      throw new NotFoundException(`Application ${applicationId} not found`);
    }

    if (application.freelancerId !== freelancerId) {
      throw new ForbiddenException('You can only withdraw your own applications');
    }

    if (application.status !== ApplicationStatus.PENDING) {
      throw new BadRequestException('Can only withdraw pending applications');
    }

    await this.prisma.$transaction([
      this.prisma.application.update({
        where: { id: applicationId },
        data: { status: ApplicationStatus.WITHDRAWN },
      }),
      this.prisma.offer.update({
        where: { id: application.offerId },
        data: {
          applicantsCount: {
            decrement: 1,
          },
        },
      }),
    ]);

    this.logger.log(`Application ${applicationId} withdrawn`);
  }

  /**
   * Obtener una aplicación específica
   */
  async getApplicationById(applicationId: string): Promise<ApplicationWithRelations> {
    this.logger.log(`Fetching application ${applicationId}`);

    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        freelancer: {
          select: { id: true, email: true },
        },
        offer: {
          select: { id: true, title: true, budget: true, userId: true },
        },
      },
    });

    if (!application) {
      throw new NotFoundException(`Application ${applicationId} not found`);
    }

    return application;
  }
}
