import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';

interface SearchQuery {
  q?: string;
  category?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  verifiedOnly?: boolean;
  lat?: number;
  lng?: number;
  radius?: number;
  page?: number;
  limit?: number;
  userId?: string;
}

export interface SearchMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SearchResponse {
  data: any[];
  meta: SearchMeta;
  query?: string;
}

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async searchServices(query: SearchQuery): Promise<SearchResponse> {
    const page  = Math.max(1, query.page  || 1);
    const limit = Math.min(query.limit || 20, 50);
    const skip  = (page - 1) * limit;

    if (query.q?.trim()) {
      return this.fullTextSearch(query, page, limit, skip);
    }
    return this.browseServices(query, page, limit, skip);
  }

  // ── Full-text search path ────────────────────────────────────────────────────

  private async fullTextSearch(
    query: SearchQuery,
    page: number, limit: number, skip: number,
  ): Promise<SearchResponse> {
    const q            = query.q!.trim();
    const minRating    = query.minRating    ?? null;
    const verifiedOnly = query.verifiedOnly ?? false;
    const lat          = query.lat          ?? null;
    const lng          = query.lng          ?? null;
    const radius       = query.radius       ?? null;
    const minPrice     = query.minPrice     ?? null;
    const maxPrice     = query.maxPrice     ?? null;
    const categoryId   = query.categoryId   ?? null;
    const categorySlug = query.category     ?? null;

    // Conditional SQL fragments
    const distanceSelect = (lat !== null && lng !== null)
      ? Prisma.sql`, ST_Distance(up.location, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) / 1000.0 AS "distanceKm"`
      : Prisma.sql`, NULL::float AS "distanceKm"`;

    const ratingFilter    = minRating    ? Prisma.sql`AND up."avgRating" >= ${minRating}`         : Prisma.empty;
    const verifiedFilter  = verifiedOnly ? Prisma.sql`AND v.status = 'APPROVED'`                  : Prisma.empty;
    const minPriceFilter  = minPrice !== null ? Prisma.sql`AND sl."startingPrice" >= ${minPrice}` : Prisma.empty;
    const maxPriceFilter  = maxPrice !== null ? Prisma.sql`AND sl."startingPrice" <= ${maxPrice}` : Prisma.empty;
    const catIdFilter     = categoryId   ? Prisma.sql`AND sl."categoryId" = ${categoryId}`        : Prisma.empty;
    const catSlugFilter   = (!categoryId && categorySlug) ? Prisma.sql`AND c.slug = ${categorySlug}` : Prisma.empty;

    const distanceFilter = (lat !== null && lng !== null && radius !== null)
      ? Prisma.sql`AND (up.location IS NULL OR ST_DWithin(up.location, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${radius * 1000}))`
      : Prisma.empty;

    const [results, countRows] = await Promise.all([
      this.prisma.$queryRaw<any[]>`
        SELECT
          sl.id, sl.slug, sl.title, sl.description,
          sl."startingPrice", sl."minPrice", sl."maxPrice", sl."serviceRadius",
          sl."categoryId", sl."likesCount", sl."savesCount", sl."viewsCount",
          sl."trendingScore", sl."engagementScore", sl."createdAt",
          c.name  AS "categoryName",
          c.slug  AS "categorySlug",
          up."displayName" AS "providerName",
          up."avatarUrl"   AS "providerAvatar",
          up."avgRating",
          up."totalReviews",
          up."completedJobs",
          up."completionRate",
          up."responseRate",
          up.city,
          up.state,
          v.status AS "verificationStatus"
          ${distanceSelect}
        FROM service_listings sl
        JOIN users          u  ON sl."providerId" = u.id
        JOIN user_profiles  up ON up."userId"     = u.id
        JOIN categories     c  ON sl."categoryId" = c.id
        LEFT JOIN verifications v ON v."userId"   = u.id
        WHERE sl.status      = 'APPROVED'
          AND sl."isPublished" = true
          AND sl."deletedAt"   IS NULL
          AND u."isActive"     = true
          AND u."isSuspended"  = false
          AND (
            to_tsvector('english', sl.title || ' ' || sl.description || ' ' || c.name)
              @@ plainto_tsquery('english', ${q})
            OR sl.title          ILIKE ${'%' + q + '%'}
            OR up."displayName"  ILIKE ${'%' + q + '%'}
            OR c.name            ILIKE ${'%' + q + '%'}
          )
          ${ratingFilter}
          ${verifiedFilter}
          ${minPriceFilter}
          ${maxPriceFilter}
          ${catIdFilter}
          ${catSlugFilter}
          ${distanceFilter}
        ORDER BY
          ts_rank(
            to_tsvector('english', sl.title || ' ' || sl.description || ' ' || c.name),
            plainto_tsquery('english', ${q})
          ) DESC,
          COALESCE(up."avgRating", 0) DESC,
          sl."trendingScore" DESC
        LIMIT ${limit} OFFSET ${skip}
      `,
      this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) AS count
        FROM service_listings sl
        JOIN users         u  ON sl."providerId" = u.id
        JOIN user_profiles up ON up."userId"     = u.id
        JOIN categories    c  ON sl."categoryId" = c.id
        LEFT JOIN verifications v ON v."userId"  = u.id
        WHERE sl.status      = 'APPROVED'
          AND sl."isPublished" = true
          AND sl."deletedAt"   IS NULL
          AND u."isActive"     = true
          AND u."isSuspended"  = false
          AND (
            to_tsvector('english', sl.title || ' ' || sl.description || ' ' || c.name)
              @@ plainto_tsquery('english', ${q})
            OR sl.title          ILIKE ${'%' + q + '%'}
            OR up."displayName"  ILIKE ${'%' + q + '%'}
            OR c.name            ILIKE ${'%' + q + '%'}
          )
          ${ratingFilter}
          ${verifiedFilter}
          ${minPriceFilter}
          ${maxPriceFilter}
          ${catIdFilter}
          ${catSlugFilter}
          ${distanceFilter}
      `,
    ]);

    const total = Number(countRows[0]?.count ?? 0);
    const ids   = results.map(r => r.id);

    const [images, likedSet, savedSet] = await Promise.all([
      this.prisma.serviceImage.findMany({
        where:  { serviceId: { in: ids } },
        select: { serviceId: true, url: true, thumbnailUrl: true, isPrimary: true },
        orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
      }),
      query.userId
        ? this.prisma.serviceLike.findMany({ where: { userId: query.userId, serviceId: { in: ids } }, select: { serviceId: true } })
        : Promise.resolve([]),
      query.userId
        ? this.prisma.savedService.findMany({ where: { userId: query.userId, serviceId: { in: ids } }, select: { serviceId: true } })
        : Promise.resolve([]),
    ]);

    const imagesByService = new Map<string, any[]>();
    for (const img of images) {
      if (!imagesByService.has(img.serviceId)) imagesByService.set(img.serviceId, []);
      imagesByService.get(img.serviceId)!.push({ url: img.url, thumbnailUrl: img.thumbnailUrl, isPrimary: img.isPrimary });
    }

    const likedIds  = new Set(likedSet.map(l => l.serviceId));
    const savedIds  = new Set(savedSet.map(s => s.serviceId));

    const data = results.map(r => ({
      ...r,
      distanceKm:  r.distanceKm !== null ? parseFloat(parseFloat(r.distanceKm).toFixed(1)) : undefined,
      images:      imagesByService.get(r.id) ?? [],
      isLiked:     likedIds.has(r.id),
      isSaved:     savedIds.has(r.id),
    }));

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      query: q,
    };
  }

  // ── Browse path (no text query) ──────────────────────────────────────────────

  private async browseServices(
    query: SearchQuery,
    page: number, limit: number, skip: number,
  ): Promise<SearchResponse> {
    const lat          = query.lat          ?? null;
    const lng          = query.lng          ?? null;
    const radius       = query.radius       ?? null;
    const minRating    = query.minRating    ?? null;
    const verifiedOnly = query.verifiedOnly ?? false;
    const minPrice     = query.minPrice     ?? null;
    const maxPrice     = query.maxPrice     ?? null;
    const categoryId   = query.categoryId   ?? null;
    const categorySlug = query.category     ?? null;

    // When lat/lng provided, use geo browse with PostGIS ordering
    if (lat !== null && lng !== null) {
      return this.geoBrowse(query, lat, lng, radius ?? 50, page, limit, skip);
    }

    // Prisma-based browse when no geo context
    const where: Prisma.ServiceListingWhereInput = {
      status: 'APPROVED', isPublished: true, deletedAt: null,
      provider: { isActive: true, isSuspended: false },
    };

    if (categoryId)   where.categoryId = categoryId;
    if (categorySlug) where.category   = { slug: categorySlug };
    if (minPrice !== null || maxPrice !== null) {
      where.startingPrice = {};
      if (minPrice !== null) (where.startingPrice as any).gte = minPrice;
      if (maxPrice !== null) (where.startingPrice as any).lte = maxPrice;
    }
    if (minRating)    where.provider = { ...where.provider as any, profile: { avgRating: { gte: minRating } } };
    if (verifiedOnly) where.provider = { ...where.provider as any, verification: { status: 'APPROVED' } };

    const [services, total] = await Promise.all([
      this.prisma.serviceListing.findMany({
        where,
        include: {
          images:   { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
          category: { select: { name: true, slug: true } },
          provider: {
            select: {
              id: true,
              profile: {
                select: {
                  displayName: true, avatarUrl: true,
                  city: true, state: true,
                  avgRating: true, totalReviews: true,
                  completedJobs: true, completionRate: true, responseRate: true,
                },
              },
              verification: { select: { status: true } },
            },
          },
        },
        orderBy: [{ trendingScore: 'desc' }, { createdAt: 'desc' }],
        skip, take: limit,
      }),
      this.prisma.serviceListing.count({ where }),
    ]);

    const ids = services.map(s => s.id);
    const [likedSet, savedSet] = await Promise.all([
      query.userId
        ? this.prisma.serviceLike.findMany({ where: { userId: query.userId, serviceId: { in: ids } }, select: { serviceId: true } })
        : Promise.resolve([]),
      query.userId
        ? this.prisma.savedService.findMany({ where: { userId: query.userId, serviceId: { in: ids } }, select: { serviceId: true } })
        : Promise.resolve([]),
    ]);
    const likedIds = new Set(likedSet.map(l => l.serviceId));
    const savedIds = new Set(savedSet.map(s => s.serviceId));

    const data = services.map(s => ({
      id:             s.id,
      slug:           s.slug,
      title:          s.title,
      description:    s.description,
      startingPrice:  s.startingPrice,
      minPrice:       s.minPrice,
      maxPrice:       s.maxPrice,
      serviceRadius:  s.serviceRadius,
      categoryId:     s.categoryId,
      categoryName:   s.category.name,
      categorySlug:   s.category.slug,
      likesCount:     s.likesCount,
      savesCount:     s.savesCount,
      viewsCount:     s.viewsCount,
      trendingScore:  s.trendingScore,
      engagementScore: s.engagementScore,
      createdAt:      s.createdAt,
      images:         s.images.map(i => ({ url: i.url, thumbnailUrl: i.thumbnailUrl, isPrimary: i.isPrimary })),
      providerName:        s.provider.profile?.displayName ?? null,
      providerAvatar:      s.provider.profile?.avatarUrl   ?? null,
      avgRating:           s.provider.profile?.avgRating   ?? null,
      totalReviews:        s.provider.profile?.totalReviews ?? 0,
      completedJobs:       s.provider.profile?.completedJobs ?? 0,
      completionRate:      s.provider.profile?.completionRate ?? 0,
      responseRate:        s.provider.profile?.responseRate ?? 0,
      city:                s.provider.profile?.city  ?? null,
      state:               s.provider.profile?.state ?? null,
      verificationStatus:  (s.provider.verification as any)?.status ?? null,
      distanceKm:          undefined,
      isLiked:             likedIds.has(s.id),
      isSaved:             savedIds.has(s.id),
    }));

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── Geo browse (no query, but location provided) ─────────────────────────────

  private async geoBrowse(
    query: SearchQuery,
    lat: number, lng: number, radius: number,
    page: number, limit: number, skip: number,
  ): Promise<SearchResponse> {
    const minRating    = query.minRating    ?? null;
    const verifiedOnly = query.verifiedOnly ?? false;
    const minPrice     = query.minPrice     ?? null;
    const maxPrice     = query.maxPrice     ?? null;
    const categoryId   = query.categoryId   ?? null;
    const categorySlug = query.category     ?? null;

    const ratingFilter   = minRating    ? Prisma.sql`AND up."avgRating" >= ${minRating}` : Prisma.empty;
    const verifiedFilter = verifiedOnly ? Prisma.sql`AND v.status = 'APPROVED'`          : Prisma.empty;
    const minPriceFilter = minPrice !== null ? Prisma.sql`AND sl."startingPrice" >= ${minPrice}` : Prisma.empty;
    const maxPriceFilter = maxPrice !== null ? Prisma.sql`AND sl."startingPrice" <= ${maxPrice}` : Prisma.empty;
    const catIdFilter    = categoryId   ? Prisma.sql`AND sl."categoryId" = ${categoryId}` : Prisma.empty;
    const catSlugFilter  = (!categoryId && categorySlug) ? Prisma.sql`AND c.slug = ${categorySlug}` : Prisma.empty;

    const [results, countRows] = await Promise.all([
      this.prisma.$queryRaw<any[]>`
        SELECT
          sl.id, sl.slug, sl.title, sl.description,
          sl."startingPrice", sl."minPrice", sl."maxPrice", sl."serviceRadius",
          sl."categoryId", sl."likesCount", sl."savesCount", sl."viewsCount",
          sl."trendingScore", sl."engagementScore", sl."createdAt",
          c.name  AS "categoryName",
          c.slug  AS "categorySlug",
          up."displayName" AS "providerName",
          up."avatarUrl"   AS "providerAvatar",
          up."avgRating",
          up."totalReviews",
          up."completedJobs",
          up."completionRate",
          up."responseRate",
          up.city, up.state,
          v.status AS "verificationStatus",
          ST_Distance(up.location, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) / 1000.0 AS "distanceKm"
        FROM service_listings sl
        JOIN users         u  ON sl."providerId" = u.id
        JOIN user_profiles up ON up."userId"     = u.id
        JOIN categories    c  ON sl."categoryId" = c.id
        LEFT JOIN verifications v ON v."userId"  = u.id
        WHERE sl.status      = 'APPROVED'
          AND sl."isPublished" = true
          AND sl."deletedAt"   IS NULL
          AND u."isActive"     = true
          AND u."isSuspended"  = false
          AND up.location IS NOT NULL
          AND ST_DWithin(up.location, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${radius * 1000})
          ${ratingFilter}
          ${verifiedFilter}
          ${minPriceFilter}
          ${maxPriceFilter}
          ${catIdFilter}
          ${catSlugFilter}
        ORDER BY "distanceKm" ASC, COALESCE(up."avgRating", 0) DESC, sl."trendingScore" DESC
        LIMIT ${limit} OFFSET ${skip}
      `,
      this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) AS count
        FROM service_listings sl
        JOIN users         u  ON sl."providerId" = u.id
        JOIN user_profiles up ON up."userId"     = u.id
        JOIN categories    c  ON sl."categoryId" = c.id
        LEFT JOIN verifications v ON v."userId"  = u.id
        WHERE sl.status      = 'APPROVED'
          AND sl."isPublished" = true
          AND sl."deletedAt"   IS NULL
          AND u."isActive"     = true
          AND u."isSuspended"  = false
          AND up.location IS NOT NULL
          AND ST_DWithin(up.location, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${radius * 1000})
          ${ratingFilter}
          ${verifiedFilter}
          ${minPriceFilter}
          ${maxPriceFilter}
          ${catIdFilter}
          ${catSlugFilter}
      `,
    ]);

    const total = Number(countRows[0]?.count ?? 0);
    const ids   = results.map(r => r.id);

    const [images, likedSet, savedSet] = await Promise.all([
      this.prisma.serviceImage.findMany({
        where:  { serviceId: { in: ids } },
        select: { serviceId: true, url: true, thumbnailUrl: true, isPrimary: true },
        orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
      }),
      query.userId
        ? this.prisma.serviceLike.findMany({ where: { userId: query.userId, serviceId: { in: ids } }, select: { serviceId: true } })
        : Promise.resolve([]),
      query.userId
        ? this.prisma.savedService.findMany({ where: { userId: query.userId, serviceId: { in: ids } }, select: { serviceId: true } })
        : Promise.resolve([]),
    ]);

    const imagesByService = new Map<string, any[]>();
    for (const img of images) {
      if (!imagesByService.has(img.serviceId)) imagesByService.set(img.serviceId, []);
      imagesByService.get(img.serviceId)!.push({ url: img.url, thumbnailUrl: img.thumbnailUrl, isPrimary: img.isPrimary });
    }
    const likedIds = new Set(likedSet.map(l => l.serviceId));
    const savedIds = new Set(savedSet.map(s => s.serviceId));

    return {
      data: results.map(r => ({
        ...r,
        distanceKm: parseFloat(parseFloat(r.distanceKm).toFixed(1)),
        images:     imagesByService.get(r.id) ?? [],
        isLiked:    likedIds.has(r.id),
        isSaved:    savedIds.has(r.id),
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── Suggestions ──────────────────────────────────────────────────────────────

  async getSuggestions(q: string) {
    if (!q || q.length < 2) return [];
    const [services, categories, artisans] = await Promise.all([
      this.prisma.serviceListing.findMany({
        where:  { title: { contains: q, mode: 'insensitive' }, status: 'APPROVED', isPublished: true },
        select: { title: true, slug: true },
        take: 5,
      }),
      this.prisma.category.findMany({
        where:  { name: { contains: q, mode: 'insensitive' }, isActive: true, parentId: null },
        select: { name: true, slug: true },
        take: 3,
      }),
      this.prisma.userProfile.findMany({
        where: {
          displayName: { contains: q, mode: 'insensitive' },
          isProvider: true,
        },
        select: { displayName: true, avatarUrl: true },
        take: 3,
      }),
    ]);

    return [
      ...services.map(s  => ({ type: 'service'  as const, label: s.title,         slug: s.slug })),
      ...categories.map(c => ({ type: 'category' as const, label: c.name,          slug: c.slug })),
      ...artisans.map(a   => ({ type: 'artisan'  as const, label: a.displayName!,  slug: '',    avatar: a.avatarUrl })),
    ];
  }

  // ── Popular searches ─────────────────────────────────────────────────────────
  // Returns service categories with the most published listings

  async getPopularSearches() {
    const results = await this.prisma.category.findMany({
      where:    { isActive: true, parentId: null },
      orderBy:  { services: { _count: 'desc' } },
      take: 10,
      select:   { name: true, slug: true, _count: { select: { services: true } } },
    });
    return results.map(r => ({ label: r.name, slug: r.slug, count: r._count.services }));
  }
}
