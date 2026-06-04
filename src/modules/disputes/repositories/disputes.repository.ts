import { Injectable } from '@nestjs/common';
import { DisputeStatus } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { BaseRepository } from '../../../core/prisma/base.repository';

@Injectable()
export class DisputesRepository extends BaseRepository {
  constructor(prisma: PrismaService) { super(prisma); }

  findById(id: string) {
    return this.prisma.dispute.findUnique({
      where: { id },
      include: {
        booking: { select: { id: true, customerId: true, providerId: true } },
        evidence: true,
        raisedBy: { select: { id: true, profile: { select: { displayName: true } } } },
        provider: { select: { id: true, profile: { select: { displayName: true } } } },
      },
    });
  }

  findByBookingId(bookingId: string) {
    return this.prisma.dispute.findUnique({ where: { bookingId } });
  }

  create(data: any) {
    return this.prisma.dispute.create({ data, include: { evidence: true } });
  }

  update(id: string, data: any) {
    return this.prisma.dispute.update({ where: { id }, data });
  }

  findAll(status: DisputeStatus | undefined, skip: number, take: number) {
    const where = status ? { status } : {};
    return this.prisma.dispute.findMany({
      where,
      include: {
        raisedBy: { select: { id: true, profile: { select: { displayName: true } } } },
        provider: { select: { id: true, profile: { select: { displayName: true } } } },
        booking: { select: { id: true, service: { select: { title: true } } } },
        _count: { select: { evidence: true } },
      },
      skip, take, orderBy: { createdAt: 'desc' },
    });
  }

  countAll(status?: DisputeStatus) {
    return this.prisma.dispute.count({ where: status ? { status } : {} });
  }
}
