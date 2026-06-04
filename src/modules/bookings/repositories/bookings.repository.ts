import { Injectable } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { BaseRepository } from '../../../core/prisma/base.repository';

@Injectable()
export class BookingsRepository extends BaseRepository {
  constructor(prisma: PrismaService) { super(prisma); }

  findById(id: string) {
    return this.prisma.booking.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true, city: true } } } },
        provider: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
        service: { select: { id: true, title: true, slug: true, startingPrice: true, images: { take: 1 } } },
        quotation: true, review: true, dispute: true,
      },
    });
  }

  findByQuotationId(quotationId: string) {
    return this.prisma.booking.findUnique({ where: { quotationId } });
  }

  create(data: any) {
    return this.prisma.booking.create({
      data,
      include: {
        customer: { select: { id: true, profile: { select: { displayName: true } } } },
        provider: { select: { id: true, profile: { select: { displayName: true } } } },
        service: { select: { title: true } },
        quotation: { select: { totalAmount: true } },
      },
    });
  }

  update(id: string, data: any) {
    return this.prisma.booking.update({ where: { id }, data });
  }

  findAllByUser(userId: string, role: 'customer' | 'provider', status: string | undefined, skip: number, take: number) {
    const where: any = role === 'customer' ? { customerId: userId } : { providerId: userId };
    if (status) where.status = status;
    return this.prisma.booking.findMany({
      where,
      include: {
        service: { select: { id: true, title: true, images: { take: 1 } } },
        quotation: { select: { totalAmount: true } },
        customer: { select: { profile: { select: { displayName: true, avatarUrl: true } } } },
        provider: { select: { profile: { select: { displayName: true, avatarUrl: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  countByUser(userId: string, role: 'customer' | 'provider', status?: string) {
    const where: any = role === 'customer' ? { customerId: userId } : { providerId: userId };
    if (status) where.status = status;
    return this.prisma.booking.count({ where });
  }
}
