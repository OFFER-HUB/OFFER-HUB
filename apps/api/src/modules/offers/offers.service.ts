import { Injectable, Logger, Inject, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Offer, OfferStatus, OfferAttachment, Prisma, OfferCategory } from '@prisma/client';
import { CreateOfferDto, UpdateOfferDto, UpdateOfferStatusDto } from './dto';

function generateOfferId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `ofr_${timestamp}${randomPart}`;
}

function generateAttachmentId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `ofa_${timestamp}${randomPart}`;
}

export type OfferWithAttachments = Offer & { attachments: OfferAttachment[] };

@Injectable()
export class OffersService {
  private readonly logger = new Logger(OffersService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createOffer(userId: string, dto: CreateOfferDto): Promise<Offer> {
    this.logger.log(`Creating offer for user ${userId}: ${dto.title}`);

    const offer = await this.prisma.offer.create({
      data: {
        id: generateOfferId(),
        userId,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        budget: dto.budget,
        deadline: new Date(dto.deadline),
        status: OfferStatus.ACTIVE,
        applicantsCount: 0,
      },
    });

    this.logger.log(`Offer created: ${offer.id}`);
    return offer;
  }

  async listMyOffers(userId: string): Promise<OfferWithAttachments[]> {
    this.logger.log(`Listing offers for user ${userId}`);

    const offers = await this.prisma.offer.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { attachments: true },
    });

    this.logger.log(`Found ${offers.length} offers`);
    return offers;
  }

  async getPublicOffers(options: {
    category?: OfferCategory;
    minBudget?: string;
    maxBudget?: string;
    search?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ data: OfferWithAttachments[]; hasMore: boolean; nextCursor?: string }> {
    const limit = Math.min(options.limit || 20, 100);

    this.logger.log(`Fetching public offers with filters: ${JSON.stringify(options)}`);

    const where: Prisma.OfferWhereInput = {
      status: OfferStatus.ACTIVE, // Solo ofertas activas
    };

    if (options.category) {
      where.category = options.category;
    }

    if (options.minBudget || options.maxBudget) {
      where.budget = {};
      if (options.minBudget) {
        where.budget.gte = options.minBudget;
      }
      if (options.maxBudget) {
        where.budget.lte = options.maxBudget;
      }
    }

    if (options.search) {
      where.OR = [
        { title: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const offers = await this.prisma.offer.findMany({
      where,
      include: {
        attachments: true,
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

    const hasMore = offers.length > limit;
    const data = hasMore ? offers.slice(0, limit) : offers;
    const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

    this.logger.log(`Found ${data.length} public offers (hasMore: ${hasMore})`);
    return { data, hasMore, nextCursor };
  }

  async getOfferById(offerId: string): Promise<OfferWithAttachments> {
    this.logger.log(`Fetching offer ${offerId}`);

    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        attachments: true,
        user: {
          select: { id: true, email: true },
        },
      },
    });

    if (!offer) {
      throw new NotFoundException(`Offer ${offerId} not found`);
    }

    return offer;
  }

  async updateOffer(offerId: string, userId: string, dto: UpdateOfferDto): Promise<Offer> {
    this.logger.log(`Updating offer ${offerId} by user ${userId}`);

    const offer = await this.getOfferById(offerId);

    if (offer.userId !== userId) {
      throw new ForbiddenException('You can only update your own offers');
    }

    const updatedOffer = await this.prisma.offer.update({
      where: { id: offerId },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description && { description: dto.description }),
        ...(dto.category && { category: dto.category }),
        ...(dto.budget && { budget: dto.budget }),
        ...(dto.deadline && { deadline: new Date(dto.deadline) }),
      },
    });

    this.logger.log(`Offer updated: ${offerId}`);
    return updatedOffer;
  }

  async updateOfferStatus(offerId: string, userId: string, dto: UpdateOfferStatusDto): Promise<Offer> {
    this.logger.log(`Updating offer ${offerId} status to ${dto.status}`);

    const offer = await this.getOfferById(offerId);

    if (offer.userId !== userId) {
      throw new ForbiddenException('You can only update your own offers');
    }

    const updatedOffer = await this.prisma.offer.update({
      where: { id: offerId },
      data: { status: dto.status },
    });

    this.logger.log(`Offer status updated: ${offerId} -> ${dto.status}`);
    return updatedOffer;
  }

  async deleteOffer(offerId: string, userId: string): Promise<void> {
    this.logger.log(`Deleting offer ${offerId} by user ${userId}`);

    const offer = await this.getOfferById(offerId);

    if (offer.userId !== userId) {
      throw new ForbiddenException('You can only delete your own offers');
    }

    await this.prisma.offer.delete({
      where: { id: offerId },
    });

    this.logger.log(`Offer deleted: ${offerId}`);
  }

  async countActiveOffers(userId: string): Promise<number> {
    return this.prisma.offer.count({
      where: {
        userId,
        status: OfferStatus.ACTIVE,
      },
    });
  }

  async addAttachment(
    offerId: string,
    userId: string,
    file: { filename: string; mimeType: string; size: number; url: string },
  ): Promise<OfferAttachment> {
    this.logger.log(`Adding attachment to offer ${offerId}`);

    const offer = await this.getOfferById(offerId);

    if (offer.userId !== userId) {
      throw new ForbiddenException('You can only add attachments to your own offers');
    }

    const attachment = await this.prisma.offerAttachment.create({
      data: {
        id: generateAttachmentId(),
        offerId,
        filename: file.filename,
        mimeType: file.mimeType,
        size: file.size,
        url: file.url,
      },
    });

    this.logger.log(`Attachment added: ${attachment.id}`);
    return attachment;
  }

  async deleteAttachment(attachmentId: string, userId: string): Promise<void> {
    this.logger.log(`Deleting attachment ${attachmentId}`);

    const attachment = await this.prisma.offerAttachment.findUnique({
      where: { id: attachmentId },
      include: { offer: true },
    });

    if (!attachment) {
      throw new NotFoundException(`Attachment ${attachmentId} not found`);
    }

    if (attachment.offer.userId !== userId) {
      throw new ForbiddenException('You can only delete attachments from your own offers');
    }

    await this.prisma.offerAttachment.delete({
      where: { id: attachmentId },
    });

    this.logger.log(`Attachment deleted: ${attachmentId}`);
  }
}
