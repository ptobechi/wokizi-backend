import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { PaginatedResponseDto } from '../../../common/dto/base-response.dto';

interface SearchQuery {
  q?: string;
  category?: string;
  city?: string;
  state?: string;
  minPrice?: number;
  maxPrice?: number;
  lat?: number;
  lng?: number;
  radius?: number;
  page?: number;
  limit?: number;
}

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async searchServices(query: SearchQuery) {
    const { page = 1, limit = 20, q } = query;
    const skip = (page - 1) * limit;

    if (!q?.trim()) return this.browseServices(query);

    const results = await this.prisma.$queryRaw<any[]>`
      SELECT sl.id, sl.title, sl.slug, sl.description, sl."startingPrice",
        sl."likesCount", sl."trendingScore", c.name as "categoryName", c.slug as "categorySlug",
        up."displayName" as "providerName", up."avatarUrl" as "providerAvatar",
        up."avgRating", up."totalReviews", up.city, up.state,
        v.status as "verificationStatus",
        ts_rank(to_tsvector('english', sl.title || ' ' || sl.description), plainto_tsquery('english', ${q})) as rank
      FROM service_listings sl
      JOIN users u ON sl."providerId" = u.id
      JOIN user_profiles up ON up."userId" = u.id
      JOIN categories c ON sl."categoryId" = c.id
      LEFT JOIN verifications v ON v."userId" = u.id
      WHERE sl.status = 'APPROVED' AND sl."isPublished" = true AND sl."deletedAt" IS NULL
        AND u."isActive" = true
        AND (
          to_tsvector('english', sl.title || ' ' || sl.description) @@ plainto_tsquery('english', ${q})
          OR sl.title ILIKE ${`%${q}%`} OR up."displayName" ILIKE ${`%${q}%`} OR c.name ILIKE ${`%${q}%`}
        )
      ORDER BY rank DESC, sl."trendingScore" DESC
      LIMIT ${limit} OFFSET ${skip}
    `;

    const ids = results.map(r => r.id);
    const images = await this.prisma.serviceImage.findMany({
      where: { serviceId: { in: ids }, isPrimary: true },
      select: { serviceId: true, url: true, thumbnailUrl: true },
    });
    const imageMap = new Map(images.map(i => [i.serviceId, i]));

    return { data: results.map(r => ({ ...r, image: imageMap.get(r.id) || null })), query: q };
  }

  private async browseServices(query: SearchQuery) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;
    const where: any = { status: 'APPROVED', isPublished: true, deletedAt: null };
    if (query.category) where.category = { slug: query.category };
    if (query.minPrice !== undefined) where.startingPrice = { gte: query.minPrice };
    if (query.maxPrice !== undefined) where.startingPrice = { ...where.startingPrice, lte: query.maxPrice };

    const [data, total] = await Promise.all([
      this.prisma.serviceListing.findMany({
        where,
        include: {
          images: { where: { isPrimary: true }, take: 1 },
          category: { select: { name: true, slug: true } },
          provider: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true, city: true, avgRating: true } } } },
        },
        orderBy: [{ trendingScore: 'desc' }, { createdAt: 'desc' }],
        skip, take: limit,
      }),
      this.prisma.serviceListing.count({ where }),
    ]);

    return PaginatedResponseDto.of(data, total, page, limit);
  }

  async getSuggestions(q: string) {
    if (!q || q.length < 2) return [];
    const [services, categories] = await Promise.all([
      this.prisma.serviceListing.findMany({
        where: { title: { contains: q, mode: 'insensitive' }, status: 'APPROVED', isPublished: true },
        select: { title: true, slug: true }, take: 5,
      }),
      this.prisma.category.findMany({
        where: { name: { contains: q, mode: 'insensitive' }, isActive: true },
        select: { name: true, slug: true }, take: 3,
      }),
    ]);
    return [
      ...services.map(s => ({ type: 'service', label: s.title, slug: s.slug })),
      ...categories.map(c => ({ type: 'category', label: c.name, slug: c.slug })),
    ];
  }
}
