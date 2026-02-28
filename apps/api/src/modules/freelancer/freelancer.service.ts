import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { BalanceService } from '../balance/balance.service';
import { OrderStatus } from '@prisma/client';

export interface FreelancerStats {
  activeServices: number;
  totalEarnings: string;
  stellarBalance: string;
  balanceSynced: boolean;
  pendingProposals: number;
  unreadMessages: number;
}

export interface FreelancerActivity {
  id: string;
  type: 'order_created' | 'order_completed' | 'payment_received' | 'withdrawal_completed' | 'topup_completed';
  title: string;
  description: string;
  createdAt: string;
  time: string;
}

@Injectable()
export class FreelancerService {
  private readonly logger = new Logger(FreelancerService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(forwardRef(() => BalanceService)) private readonly balanceService: BalanceService,
  ) {
    this.logger.debug(`FreelancerService initialized. PrismaService is: ${!!this.prisma}`);
  }

  /**
   * Get freelancer dashboard statistics
   * Automatically reconciles balance with Stellar blockchain
   */
  async getStats(userId: string): Promise<FreelancerStats> {
    // Count active services created by this freelancer
    const activeServices = await this.prisma.service.count({
      where: {
        userId,
        status: 'ACTIVE',
      },
    });

    // Reconcile balance with Stellar to ensure accuracy
    let totalEarnings = '0.00';
    let stellarBalance = '0.00';
    let balanceSynced = false;

    try {
      const reconcileResult = await this.balanceService.reconcileWithProvider(userId);
      totalEarnings = reconcileResult.newBalance;
      stellarBalance = reconcileResult.providerBalance;
      balanceSynced = reconcileResult.reconciled;

      if (reconcileResult.adjustment !== '0.00') {
        this.logger.log(
          `Balance reconciled for freelancer ${userId}: adjustment of ${reconcileResult.adjustment}`,
        );
      }
    } catch (error) {
      this.logger.warn(`Failed to reconcile balance for user ${userId}: ${error}`);
      // Fallback to DB balance if reconciliation fails
      const balance = await this.prisma.balance.findUnique({
        where: { userId },
      });
      totalEarnings = balance?.available || '0.00';
      stellarBalance = 'unknown';
      balanceSynced = false;
    }

    // For now, proposals and messages are 0 (no models yet)
    const pendingProposals = 0;
    const unreadMessages = 0;

    return {
      activeServices,
      totalEarnings: `$${parseFloat(totalEarnings).toFixed(2)}`,
      stellarBalance: stellarBalance !== 'unknown' ? `$${parseFloat(stellarBalance).toFixed(2)}` : 'Unknown',
      balanceSynced,
      pendingProposals,
      unreadMessages,
    };
  }

  /**
   * Get recent freelancer activities
   */
  async getActivities(userId: string, limit = 20): Promise<FreelancerActivity[]> {
    const activities: FreelancerActivity[] = [];

    // Get recent orders as seller
    const recentOrders = await this.prisma.order.findMany({
      where: { sellerId: userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    for (const order of recentOrders) {
      const isCompleted = order.status === OrderStatus.RELEASED || order.status === OrderStatus.CLOSED;

      activities.push({
        id: order.id,
        type: isCompleted ? 'order_completed' : 'order_created',
        title: isCompleted ? 'Order completed' : 'New order received',
        description: order.title,
        createdAt: order.createdAt.toISOString(),
        time: this.getRelativeTime(order.createdAt),
      });
    }

    // Get recent withdrawals
    const recentWithdrawals = await this.prisma.withdrawal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    for (const withdrawal of recentWithdrawals) {
      activities.push({
        id: withdrawal.id,
        type: 'withdrawal_completed',
        title: 'Withdrawal processed',
        description: `Withdrawn ${withdrawal.currency} ${withdrawal.amount}`,
        createdAt: withdrawal.createdAt.toISOString(),
        time: this.getRelativeTime(withdrawal.createdAt),
      });
    }

    // Get recent top-ups
    const recentTopups = await this.prisma.topUp.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    for (const topup of recentTopups) {
      activities.push({
        id: topup.id,
        type: 'topup_completed',
        title: 'Balance top-up',
        description: `Added ${topup.currency} ${topup.amount} to balance`,
        createdAt: topup.createdAt.toISOString(),
        time: this.getRelativeTime(topup.createdAt),
      });
    }

    // Sort all activities by date and limit
    activities.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return activities.slice(0, limit);
  }

  /**
   * Convert date to relative time string
   */
  private getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    const diffWeeks = Math.floor(diffMs / 604800000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''} ago`;

    return `${Math.floor(diffWeeks / 4)} month${Math.floor(diffWeeks / 4) > 1 ? 's' : ''} ago`;
  }
}
