import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getProviderAnalytics(providerId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [totalBookings, completedBookings, cancelledBookings, revenue, views, likes] = await Promise.all([
      this.prisma.booking.count({ where: { providerId, createdAt: { gte: since } } }),
      this.prisma.booking.count({ where: { providerId, status: 'COMPLETED', completedAt: { gte: since } } }),
      this.prisma.booking.count({ where: { providerId, status: 'CANCELLED', cancelledAt: { gte: since } } }),
      this.prisma.booking.findMany({ where: { providerId, status: 'COMPLETED', completedAt: { gte: since } }, include: { quotation: { select: { totalAmount: true } } } }),
      this.prisma.serviceListing.aggregate({ where: { providerId }, _sum: { viewsCount: true } }),
      this.prisma.serviceListing.aggregate({ where: { providerId }, _sum: { likesCount: true } }),
    ]);

    const totalRevenue = revenue.reduce((s, b) => s + (b.quotation?.totalAmount || 0), 0);

    return {
      period: `${days} days`,
      bookings: {
        total: totalBookings, completed: completedBookings, cancelled: cancelledBookings,
        completionRate: totalBookings > 0 ? ((completedBookings / totalBookings) * 100).toFixed(1) : 0,
      },
      revenue: { total: totalRevenue, currency: 'NGN' },
      engagement: { totalViews: views._sum.viewsCount || 0, totalLikes: likes._sum.likesCount || 0 },
    };
  }
}
