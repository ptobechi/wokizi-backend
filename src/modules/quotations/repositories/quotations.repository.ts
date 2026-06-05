import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { BaseRepository } from '../../../core/prisma/base.repository';

const ITEM_SELECT = {
  items: { orderBy: { sortOrder: 'asc' as const } },
};

const PROVIDER_SELECT = {
  provider: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
};

// One-to-one relation — included to detect lock state on frontend
const BOOKING_SELECT = {
  booking: { select: { id: true, status: true } },
};

@Injectable()
export class QuotationsRepository extends BaseRepository {
  constructor(prisma: PrismaService) { super(prisma); }

  findById(id: string) {
    return this.prisma.quotation.findUnique({
      where: { id },
      include: { ...ITEM_SELECT, ...PROVIDER_SELECT, ...BOOKING_SELECT },
    });
  }

  create(data: any) {
    return this.prisma.quotation.create({
      data,
      include: { ...ITEM_SELECT, ...PROVIDER_SELECT, ...BOOKING_SELECT },
    });
  }

  update(id: string, data: any) {
    return this.prisma.quotation.update({
      where: { id },
      data,
      include: { ...ITEM_SELECT, ...PROVIDER_SELECT, ...BOOKING_SELECT },
    });
  }

  findByConversation(conversationId: string) {
    return this.prisma.quotation.findMany({
      where: { conversationId },
      include: {
        ...ITEM_SELECT,
        ...PROVIDER_SELECT,
        ...BOOKING_SELECT,
        revisions: { select: { id: true, revisionNumber: true, status: true, totalAmount: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findByUser(userId: string, role: 'provider' | 'customer', skip: number, take: number) {
    const where = role === 'provider' ? { providerId: userId } : { customerId: userId };
    return this.prisma.quotation.findMany({
      where,
      include: {
        ...ITEM_SELECT,
        provider: { select: { id: true, profile: { select: { displayName: true } } } },
        customer: { select: { id: true, profile: { select: { displayName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }
}
