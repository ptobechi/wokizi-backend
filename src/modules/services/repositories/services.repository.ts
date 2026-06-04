import { Injectable } from '@nestjs/common';
import { ServiceStatus } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { BaseRepository } from '../../../core/prisma/base.repository';

@Injectable()
export class ServicesRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  findById(id: string) {
    return this.prisma.serviceListing.findUnique({ where: { id, deletedAt: null } });
  }

  findBySlugPublic(slug: string) {
    return this.prisma.serviceListing.findUnique({
      where: { slug, status: 'APPROVED', isPublished: true, deletedAt: null },
      include: {
        provider: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true, city: true, state: true, avgRating: true, totalReviews: true, completedJobs: true, isProvider: true } },
            verification: { select: { status: true } },
          },
        },
        category: true,
        images: { orderBy: { sortOrder: 'asc' } },
        portfolioItems: { take: 6 },
        availability: { include: { slots: true } },
        _count: { select: { reviews: true, bookings: true, likes: true } },
      },
    });
  }

  findAllByProvider(providerId: string, skip: number, take: number) {
    return this.prisma.serviceListing.findMany({
      where: { providerId, deletedAt: null },
      include: {
        images: { take: 1 },
        category: { select: { name: true, slug: true } },
        _count: { select: { bookings: true, reviews: true } },
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });
  }

  countByProvider(providerId: string) {
    return this.prisma.serviceListing.count({ where: { providerId, deletedAt: null } });
  }

  create(data: any) {
    return this.prisma.serviceListing.create({ data, include: { images: true, category: true, availability: { include: { slots: true } } } });
  }

  update(id: string, data: any) {
    return this.prisma.serviceListing.update({ where: { id }, data, include: { images: true, category: true } });
  }

  softDelete(id: string) {
    return this.prisma.serviceListing.update({ where: { id }, data: { deletedAt: new Date(), isPublished: false } });
  }

  incrementViewCount(id: string) {
    return this.prisma.serviceListing.update({ where: { id }, data: { viewsCount: { increment: 1 } } });
  }
}
