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
  Inject,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { Offer, OfferAttachment, OfferCategory } from '@prisma/client';
import { OffersService, OfferWithAttachments } from './offers.service';
import { CreateOfferDto, UpdateOfferDto, UpdateOfferStatusDto } from './dto';
import { Public } from '../../common/decorators/public.decorator';

// Ensure uploads directory exists
const uploadsDir = join(process.cwd(), 'uploads', 'offers');
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

const storage = diskStorage({
  destination: uploadsDir,
  filename: (req, file, callback) => {
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    const ext = extname(file.originalname);
    callback(null, `${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req: any, file: Express.Multer.File, callback: any) => {
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ];
  if (allowedMimes.includes(file.mimetype)) {
    callback(null, true);
  } else {
    callback(new BadRequestException(`File type ${file.mimetype} is not allowed`), false);
  }
};

@Controller('offers')
export class OffersController {
  constructor(@Inject(OffersService) private readonly offersService: OffersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createOffer(@Req() req: any, @Body() dto: CreateOfferDto): Promise<Offer> {
    const userId = req.user.userId;
    const offer = await this.offersService.createOffer(userId, dto);
    return offer;
  }

  @Get()
  async listOffers(@Req() req: any): Promise<OfferWithAttachments[]> {
    const userId = req.user.userId;
    const offers = await this.offersService.listMyOffers(userId);
    return offers;
  }

  @Get(':id')
  async getOffer(@Param('id') id: string): Promise<OfferWithAttachments> {
    const offer = await this.offersService.getOfferById(id);
    return offer;
  }

  @Put(':id')
  async updateOffer(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateOfferDto,
  ): Promise<Offer> {
    const userId = req.user.userId;
    const offer = await this.offersService.updateOffer(id, userId, dto);
    return offer;
  }

  @Patch(':id/status')
  async updateOfferStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateOfferStatusDto,
  ): Promise<Offer> {
    const userId = req.user.userId;
    const offer = await this.offersService.updateOfferStatus(id, userId, dto);
    return offer;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOffer(@Req() req: any, @Param('id') id: string): Promise<void> {
    const userId = req.user.userId;
    await this.offersService.deleteOffer(id, userId);
  }

  @Post(':id/attachments')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage,
      fileFilter,
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    }),
  )
  async uploadAttachment(
    @Req() req: any,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<OfferAttachment> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const userId = req.user.userId;
    const attachment = await this.offersService.addAttachment(id, userId, {
      filename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url: `/uploads/offers/${file.filename}`,
    });

    return attachment;
  }

  @Delete('attachments/:attachmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAttachment(
    @Req() req: any,
    @Param('attachmentId') attachmentId: string,
  ): Promise<void> {
    const userId = req.user.userId;
    await this.offersService.deleteAttachment(attachmentId, userId);
  }

  // =====================
  // Public Marketplace Endpoints
  // =====================

  @Get('marketplace/offers')
  @Public()
  async getMarketplaceOffers(
    @Query('category') category?: OfferCategory,
    @Query('min_budget') minBudget?: string,
    @Query('max_budget') maxBudget?: string,
    @Query('search') search?: string,
    @Query('limit') limitStr?: string,
    @Query('cursor') cursor?: string,
  ): Promise<{ data: OfferWithAttachments[]; hasMore: boolean; nextCursor?: string }> {
    const limit = limitStr ? parseInt(limitStr, 10) : 20;
    return this.offersService.getPublicOffers({
      category,
      minBudget,
      maxBudget,
      search,
      limit,
      cursor,
    });
  }

  @Get('marketplace/offers/:id')
  @Public()
  async getMarketplaceOffer(@Param('id') id: string): Promise<OfferWithAttachments> {
    return this.offersService.getOfferById(id);
  }
}
