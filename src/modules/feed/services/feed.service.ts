import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { FEED_WEIGHTS } from '../../../common/constants';

interface FeedQuery {
  lat?: number;
  lng?: number;
  radius?: number;
  categoryId?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class FeedService {
  constructor(private prisma: PrismaService) {}

  async getFeed(userId: string | undefined, query: FeedQuery) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 50);
    const offset = (page - 1) * limit;
    const radius = query.radius || 50;

    if (query.lat && query.lng) {
      return this.getGeoFeed(userId, query.lat, query.lng, radius, query.categoryId, page, limit, offset);
    }
    return this.getDefaultFeed(userId, query.categoryId, page, limit, offset);
  }

  private async getGeoFeed(
    userId: string | undefined,
    lat: number, lng: number, radius: number,
    categoryId: string | undefined,
    page: number, limit: number, offset: number,
  ) {
    const services = await this.prisma.$queryRaw<any[]>`
      SELECT
        sl.id, sl.title, sl.slug, sl.description, sl."startingPrice",
        sl."likesCount", sl."trendingScore", sl."engagementScore", sl."createdAt",
        up."displayName" as "providerName", up."avatarUrl" as "providerAvatar",
        up."avgRating", up."totalReviews", up."completedJobs", up."completionRate",
        up."responseRate", up."travelRadius", v.status as "verificationStatus",
        ST_Distance(up.location, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) / 1000 as "distanceKm",
        (
          ${FEED_WEIGHTS.DISTANCE} * GREATEST(0, 1 - ST_Distance(up.location, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) / 1000 / ${radius})
          + ${FEED_WEIGHTS.RATING} * (COALESCE(up."avgRating", 0) / 5.0)
          + ${FEED_WEIGHTS.COMPLETION_RATE} * (COALESCE(up."completionRate", 0) / 100.0)
          + ${FEED_WEIGHTS.RESPONSE_RATE} * (COALESCE(up."responseRate", 0) / 100.0)
          + ${FEED_WEIGHTS.TRENDING} * LEAST(1, COALESCE(sl."trendingScore", 0) / 100.0)
          + ${FEED_WEIGHTS.ENGAGEMENT} * LEAST(1, COALESCE(sl."engagementScore", 0) / 100.0)
          + ${FEED_WEIGHTS.VERIFICATION} * CASE WHEN v.status = 'APPROVED' THEN 1.0 ELSE 0.0 END
          + ${FEED_WEIGHTS.RECENCY} * GREATEST(0, 1 - EXTRACT(EPOCH FROM NOW() - sl."createdAt") / 2592000)
        ) as "rankScore"
      FROM service_listings sl
      JOIN users u ON sl."providerId" = u.id
      JOIN user_profiles up ON up."userId" = u.id
      LEFT JOIN verifications v ON v."userId" = u.id
      WHERE sl.status = 'APPROVED' AND sl."isPublished" = true AND sl."deletedAt" IS NULL
        AND u."isActive" = true AND u."isSuspended" = false AND up.location IS NOT NULL
        AND ST_DWithin(up.location, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${radius * 1000})
      ORDER BY "rankScore" DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const ids = services.map((s) => s.id);
    const images = await this.prisma.serviceImage.findMany({
      where: { serviceId: { in: ids }, isPrimary: true },
      select: { serviceId: true, url: true, thumbnailUrl: true },
    });
    const imageMap = new Map(images.map((i) => [i.serviceId, i]));

    let likedSet = new Set<string>();
    let savedSet = new Set<string>();
    if (userId) {
      const [likes, saves] = await Promise.all([
        this.prisma.serviceLike.findMany({ where: { userId, serviceId: { in: ids } }, select: { serviceId: true } }),
        this.prisma.savedService.findMany({ where: { userId, serviceId: { in: ids } }, select: { serviceId: true } }),
      ]);
      likedSet = new Set(likes.map((l) => l.serviceId));
      savedSet = new Set(saves.map((s) => s.serviceId));
    }

    return {
      data: services.map((s) => ({
        ...s,
        distanceKm: parseFloat(parseFloat(s.distanceKm).toFixed(1)),
        rankScore: parseFloat(parseFloat(s.rankScore).toFixed(4)),
        image: imageMap.get(s.id) || null,
        isLiked: likedSet.has(s.id),
        isSaved: savedSet.has(s.id),
      })),
      meta: { page, limit },
    };
  }

  private async getDefaultFeed(
    userId: string | undefined,
    categoryId: string | undefined,
    page: number, limit: number, offset: number,
  ) {
    const where: any = {
      status: 'APPROVED', isPublished: true, deletedAt: null,
      provider: { isActive: true, isSuspended: false },
    };
    if (categoryId) where.categoryId = categoryId;

    const [services, total] = await Promise.all([
      this.prisma.serviceListing.findMany({
        where,
        include: {
          images: { where: { isPrimary: true }, take: 1 },
          provider: {
            select: {
              id: true,
              profile: { select: { displayName: true, avatarUrl: true, city: true, avgRating: true, totalReviews: true, completedJobs: true } },
              verification: { select: { status: true } },
            },
          },
          _count: { select: { likes: true, reviews: true } },
        },
        orderBy: [{ trendingScore: 'desc' }, { engagementScore: 'desc' }, { createdAt: 'desc' }],
        skip: offset,
        take: limit,
      }),
      this.prisma.serviceListing.count({ where }),
    ]);

    let likedSet = new Set<string>();
    let savedSet = new Set<string>();
    if (userId) {
      const ids = services.map((s) => s.id);
      const [likes, saves] = await Promise.all([
        this.prisma.serviceLike.findMany({ where: { userId, serviceId: { in: ids } }, select: { serviceId: true } }),
        this.prisma.savedService.findMany({ where: { userId, serviceId: { in: ids } }, select: { serviceId: true } }),
      ]);
      likedSet = new Set(likes.map((l) => l.serviceId));
      savedSet = new Set(saves.map((s) => s.serviceId));
    }

    return {
      data: services.map((s) => ({ ...s, isLiked: likedSet.has(s.id), isSaved: savedSet.has(s.id) })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async updateTrendingScores() {
    await this.prisma.$executeRaw`
      UPDATE service_listings
      SET
        "trendingScore" = (
          (COALESCE("likesCount", 0) * 3 + COALESCE("savesCount", 0) * 2
          + COALESCE("viewsCount", 0) * 0.1 + COALESCE("sharesCount", 0) * 5)
          / GREATEST(1, EXTRACT(EPOCH FROM NOW() - "createdAt") / 86400)
        ),
        "engagementScore" = (
          (COALESCE("likesCount", 0) + COALESCE("savesCount", 0) + COALESCE("sharesCount", 0))
          / GREATEST(1, COALESCE("viewsCount", 0))::float * 100
        )
      WHERE status = 'APPROVED' AND "isPublished" = true
    `;
  }
}
