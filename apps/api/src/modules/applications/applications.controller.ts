import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Inject,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApplicationsService, ApplicationWithRelations } from './applications.service';
import { CreateApplicationDto, UpdateApplicationStatusDto, ApplicationFiltersDto } from './dto';
import { Application } from '@prisma/client';

@Controller('applications')
export class ApplicationsController {
  constructor(@Inject(ApplicationsService) private readonly applicationsService: ApplicationsService) {}

  /**
   * POST /applications/offers/:offerId
   * Freelancer aplica a una oferta
   */
  @Post('offers/:offerId')
  @HttpCode(HttpStatus.CREATED)
  async applyToOffer(
    @Req() req: any,
    @Param('offerId') offerId: string,
    @Body() dto: CreateApplicationDto,
  ): Promise<Application> {
    const freelancerId = req.user.userId;
    return this.applicationsService.applyToOffer(freelancerId, offerId, dto);
  }

  /**
   * GET /applications/my
   * Freelancer obtiene sus aplicaciones
   */
  @Get('my')
  async getMyApplications(
    @Req() req: any,
    @Query() filters: ApplicationFiltersDto,
  ): Promise<ApplicationWithRelations[]> {
    const freelancerId = req.user.userId;
    return this.applicationsService.getMyApplications(freelancerId, filters);
  }

  /**
   * GET /applications/offers/:offerId
   * Cliente obtiene aplicantes de su oferta
   */
  @Get('offers/:offerId')
  async getOfferApplications(
    @Req() req: any,
    @Param('offerId') offerId: string,
    @Query() filters: ApplicationFiltersDto,
  ): Promise<ApplicationWithRelations[]> {
    const clientId = req.user.userId;
    return this.applicationsService.getOfferApplications(offerId, clientId, filters);
  }

  /**
   * PATCH /applications/:id/status
   * Cliente acepta/rechaza aplicación
   */
  @Patch(':id/status')
  async updateApplicationStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationStatusDto,
  ): Promise<Application> {
    const clientId = req.user.userId;
    return this.applicationsService.updateApplicationStatus(id, clientId, dto);
  }

  /**
   * DELETE /applications/:id
   * Freelancer retira su aplicación
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async withdrawApplication(
    @Req() req: any,
    @Param('id') id: string,
  ): Promise<void> {
    const freelancerId = req.user.userId;
    await this.applicationsService.withdrawApplication(id, freelancerId);
  }

  /**
   * GET /applications/:id
   * Obtener detalles de aplicación
   */
  @Get(':id')
  async getApplicationById(@Param('id') id: string): Promise<ApplicationWithRelations> {
    return this.applicationsService.getApplicationById(id);
  }
}
