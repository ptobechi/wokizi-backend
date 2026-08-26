import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { BaseRepository } from '../../../core/prisma/base.repository';

const CUSTOMER_SELECT = {
  customer: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
};

const PROVIDER_SELECT = {
  provider: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
};

const SERVICE_SELECT = {
  service: { select: { id: true, title: true, startingPrice: true, minPrice: true } },
};

const IMAGES_SELECT = {
  images: { orderBy: { sortOrder: 'asc' as const } },
};

const FULL_INCLUDE = { ...CUSTOMER_SELECT, ...PROVIDER_SELECT, ...SERVICE_SELECT, ...IMAGES_SELECT };

@Injectable()
export class ServiceRequestsRepository extends BaseRepository {
  constructor(prisma: PrismaService) { super(prisma); }

  create(data: any) {
    return this.prisma.serviceRequest.create({ data, include: FULL_INCLUDE });
  }

  findById(id: string) {
    return this.prisma.serviceRequest.findUnique({ where: { id }, include: FULL_INCLUDE });
  }

  update(id: string, data: any) {
    return this.prisma.serviceRequest.update({ where: { id }, data, include: FULL_INCLUDE });
  }

  findActiveByConversation(conversationId: string) {
    return this.prisma.serviceRequest.findFirst({
      where: { conversationId, status: { in: ['PENDING', 'ACCEPTED'] as any } },
      include: FULL_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByProvider(providerId: string, status: string | undefined, skip: number, take: number) {
    const where = { providerId, ...(status ? { status: status as any } : {}) };
    const [data, total] = await Promise.all([
      this.prisma.serviceRequest.findMany({
        where, include: FULL_INCLUDE, orderBy: { createdAt: 'desc' }, skip, take,
      }),
      this.prisma.serviceRequest.count({ where }),
    ]);
    return { data, total };
  }

  async findByCustomer(customerId: string, status: string | undefined, skip: number, take: number) {
    const where = { customerId, ...(status ? { status: status as any } : {}) };
    const [data, total] = await Promise.all([
      this.prisma.serviceRequest.findMany({
        where, include: FULL_INCLUDE, orderBy: { createdAt: 'desc' }, skip, take,
      }),
      this.prisma.serviceRequest.count({ where }),
    ]);
    return { data, total };
  }

  // Distance from the provider's own registered location to each request's
  // job-site coordinates — reuses the same ST_Distance idiom as
  // LocationsService.findNearbyProviders rather than plain lat/lng math.
  async distancesForProvider(providerId: string, requestIds: string[]): Promise<Map<string, number | null>> {
    if (!requestIds.length) return new Map();
    const rows = await this.prisma.$queryRaw<{ id: string; distanceKm: number | null }[]>`
      SELECT sr.id,
        CASE WHEN up.location IS NOT NULL
          THEN ST_Distance(up.location, ST_SetSRID(ST_MakePoint(sr.longitude, sr.latitude), 4326)::geography) / 1000
          ELSE NULL
        END as "distanceKm"
      FROM service_requests sr
      LEFT JOIN user_profiles up ON up."userId" = ${providerId}
      WHERE sr.id = ANY(${requestIds})
    `;
    return new Map(rows.map(r => [r.id, r.distanceKm]));
  }
}
