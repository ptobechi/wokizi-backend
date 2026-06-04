import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { ProfilesRepository } from '../repositories/profiles.repository';
import { UpdateProfileDto } from '../dto/requests/update-profile.dto';

@Injectable()
export class ProfilesService {
  constructor(
    private repo: ProfilesRepository,
    private prisma: PrismaService,
  ) {}

  async update(userId: string, dto: UpdateProfileDto) {
    const profile = await this.repo.findByUserId(userId);
    if (!profile) throw new NotFoundException('Profile not found');

    const { latitude, longitude, ...rest } = dto;

    if (latitude !== undefined && longitude !== undefined) {
      await this.repo.setLocation(userId, latitude, longitude);
    }

    return this.repo.update(userId, rest);
  }

  async getStats(userId: string) {
    const [completedJobs, activeServices, reviews] = await Promise.all([
      this.prisma.booking.count({ where: { providerId: userId, status: 'COMPLETED' } }),
      this.prisma.serviceListing.count({ where: { providerId: userId, status: 'APPROVED' } }),
      this.prisma.review.aggregate({
        where: { providerId: userId },
        _avg: { rating: true },
        _count: { id: true },
      }),
    ]);

    return {
      completedJobs,
      activeServices,
      avgRating: reviews._avg.rating || 0,
      totalReviews: reviews._count.id,
    };
  }

  async updateProviderMetrics(userId: string) {
    const [completedBookings, totalBookings, reviews] = await Promise.all([
      this.prisma.booking.count({ where: { providerId: userId, status: 'COMPLETED' } }),
      this.prisma.booking.count({ where: { providerId: userId, status: { not: 'CANCELLED' } } }),
      this.prisma.review.aggregate({
        where: { providerId: userId },
        _avg: { rating: true },
        _count: { id: true },
      }),
    ]);

    const completionRate = totalBookings > 0 ? Math.round((completedBookings / totalBookings) * 1000) / 10 : 0;

    await this.repo.updateMetrics(userId, {
      completedJobs: completedBookings,
      completionRate,
      avgRating: Math.round((reviews._avg.rating || 0) * 10) / 10,
      totalReviews: reviews._count.id,
    });
  }
}
