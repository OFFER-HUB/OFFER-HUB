import { Controller, Get, Req, Inject } from '@nestjs/common';
import { FreelancerService, FreelancerStats, FreelancerActivity } from './freelancer.service';

/**
 * Freelancer Controller
 * Handles REST API endpoints for freelancer dashboard data.
 *
 * Note: All responses are automatically wrapped by the global ResponseInterceptor
 * with the format: { data: T, meta: { requestId, timestamp } }
 */
@Controller('freelancer')
export class FreelancerController {
  constructor(@Inject(FreelancerService) private readonly freelancerService: FreelancerService) {}

  @Get('stats')
  async getStats(@Req() req: any): Promise<FreelancerStats> {
    const userId = req.user.userId;
    const stats = await this.freelancerService.getStats(userId);
    return stats;
  }

  @Get('activities')
  async getActivities(@Req() req: any): Promise<FreelancerActivity[]> {
    const userId = req.user.userId;
    const activities = await this.freelancerService.getActivities(userId);
    return activities;
  }
}
