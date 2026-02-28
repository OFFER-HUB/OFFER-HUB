import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { OrderStatus, OfferStatus } from '@prisma/client';

export interface ClientStats {
  activeOrders: number;
  activeOffers: number;
  servicesPurchased: number;
  budgetSpent: string;
}

export interface ClientActivity {
  id: string;
  type: 'order_created' | 'order_completed' | 'topup_completed';
  title: string;
  description: string;
  createdAt: string;
  time: string;
}

@Injectable()
export class ClientService {
  private readonly logger = new Logger(ClientService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getStats(userId: string): Promise<ClientStats> {
    const activeOrders = await this.prisma.order.count({
      where: {
        buyerId: userId,
        status: {
          notIn: [OrderStatus.RELEASED, OrderStatus.CLOSED, OrderStatus.REFUNDED, OrderStatus.DISPUTED],
        },
      },
    });

    const activeOffers = await this.prisma.offer.count({
      where: {
        userId,
        status: OfferStatus.ACTIVE,
      },
    });

    const servicesPurchasedResult = await this.prisma.order.findMany({
      where: { buyerId: userId },
      distinct: ['serviceId'],
      select: { serviceId: true },
    });
    const servicesPurchased = servicesPurchasedResult.filter((o) => o.serviceId !== null).length;

    const orders = await this.prisma.order.findMany({
      where: { buyerId: userId },
      select: { amount: true },
    });

    const totalSpent = orders.reduce((sum, order) => {
      return sum + parseFloat(order.amount);
    }, 0);

    return {
      activeOrders,
      activeOffers,
      servicesPurchased,
      budgetSpent: `$${totalSpent.toFixed(2)}`,
    };
  }

  async getActivities(userId: string, limit = 20): Promise<ClientActivity[]> {
    const activities: ClientActivity[] = [];

    const recentOrders = await this.prisma.order.findMany({
      where: { buyerId: userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        service: {
          select: { title: true },
        },
      },
    });

    for (const order of recentOrders) {
      const isCompleted = order.status === OrderStatus.RELEASED || order.status === OrderStatus.CLOSED;

      activities.push({
        id: order.id,
        type: isCompleted ? 'order_completed' : 'order_created',
        title: isCompleted ? 'Order completed' : 'New order placed',
        description: order.service?.title || order.title,
        createdAt: order.createdAt.toISOString(),
        time: this.getRelativeTime(order.createdAt),
      });
    }

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

    activities.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return activities.slice(0, limit);
  }

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
