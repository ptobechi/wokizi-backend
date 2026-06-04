import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { BaseRepository } from '../../../core/prisma/base.repository';

@Injectable()
export class ProfilesRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  findByUserId(userId: string) {
    return this.prisma.userProfile.findUnique({ where: { userId } });
  }

  update(userId: string, data: Record<string, any>) {
    return this.prisma.userProfile.update({ where: { userId }, data });
  }

  async setLocation(userId: string, lat: number, lng: number) {
    await this.prisma.$executeRaw`
      UPDATE user_profiles
      SET location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
          latitude = ${lat}, longitude = ${lng}
      WHERE "userId" = ${userId}
    `;
  }

  updateMetrics(userId: string, data: {
    completedJobs: number;
    completionRate: number;
    avgRating: number;
    totalReviews: number;
  }) {
    return this.prisma.userProfile.update({
      where: { userId },
      data: { ...data, isProvider: true },
    });
  }
}
