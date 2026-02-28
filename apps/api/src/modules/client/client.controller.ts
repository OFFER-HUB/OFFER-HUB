import { Controller, Get, Req, Inject } from '@nestjs/common';
import { ClientService, ClientStats, ClientActivity } from './client.service';

@Controller('client')
export class ClientController {
  constructor(@Inject(ClientService) private readonly clientService: ClientService) {}

  @Get('stats')
  async getStats(@Req() req: any): Promise<ClientStats> {
    const userId = req.user.userId;
    const stats = await this.clientService.getStats(userId);
    return stats;
  }

  @Get('activities')
  async getActivities(@Req() req: any): Promise<ClientActivity[]> {
    const userId = req.user.userId;
    const activities = await this.clientService.getActivities(userId);
    return activities;
  }
}
