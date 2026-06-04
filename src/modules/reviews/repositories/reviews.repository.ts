import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { BaseRepository } from '../../../core/prisma/base.repository';

@Injectable()
export class ReviewsRepository extends BaseRepository {
  constructor(prisma: PrismaService) { super(prisma); }

  create(data: any) {
    return this.prisma.review.create({ data, include: { images: true } });
  }

  findByBookingId(bookingId: string) {
    return this.prisma.review.findUnique({ where: { bookingId } });
  }

  findByService(serviceId: string, skip: number, take: number) {
    return this.prisma.review.findMany({
      where: { serviceId, isPublic: true },
      include: { reviewer: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } }, images: true },
      orderBy: { createdAt: 'desc' }, skip, take,
    });
  }

  countByService(serviceId: string) {
    return this.prisma.review.count({ where: { serviceId, isPublic: true } });
  }

  findByProvider(providerId: string, skip: number, take: number) {
    return this.prisma.review.findMany({
      where: { providerId, isPublic: true },
      include: {
        reviewer: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
        service: { select: { title: true, slug: true } },
        images: true,
      },
      orderBy: { createdAt: 'desc' }, skip, take,
    });
  }

  countByProvider(providerId: string) {
    return this.prisma.review.count({ where: { providerId, isPublic: true } });
  }
}
