import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';

@Injectable()
export class LocationsService {
  constructor(private prisma: PrismaService) {}

  findNearbyProviders(lat: number, lng: number, radiusKm = 10, limit = 20) {
    return this.prisma.$queryRaw<any[]>`
      SELECT u.id, up."displayName", up."avatarUrl", up."avgRating", up."totalReviews",
        up."completedJobs", up.city, up.state, v.status as "verificationStatus",
        ST_Distance(up.location, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) / 1000 as "distanceKm"
      FROM users u
      JOIN user_profiles up ON up."userId" = u.id
      LEFT JOIN verifications v ON v."userId" = u.id
      WHERE u."isActive" = true AND u."isSuspended" = false
        AND up.location IS NOT NULL AND up."isProvider" = true
        AND ST_DWithin(up.location, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${radiusKm * 1000})
      ORDER BY "distanceKm" ASC
      LIMIT ${limit}
    `;
  }

  async updateUserLocation(userId: string, lat: number, lng: number) {
    await this.prisma.$executeRaw`
      UPDATE user_profiles
      SET location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
          latitude = ${lat}, longitude = ${lng}
      WHERE "userId" = ${userId}
    `;
    return { updated: true };
  }
}
