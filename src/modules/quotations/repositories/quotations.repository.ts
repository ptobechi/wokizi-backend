import { Injectable } from '@nestjs/common';
import { QuotationStatus } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { BaseRepository } from '../../../core/prisma/base.repository';

@Injectable()
export class QuotationsRepository extends BaseRepository {
  constructor(prisma: PrismaService) { super(prisma); }

  findById(id: string) {
    return this.prisma.quotation.findUnique({ where: { id } });
  }

  create(data: any) {
    return this.prisma.quotation.create({ data });
  }

  update(id: string, data: any) {
    return this.prisma.quotation.update({ where: { id }, data });
  }

  findByConversation(conversationId: string) {
    return this.prisma.quotation.findMany({
      where: { conversationId },
      include: {
        provider: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
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
        provider: { select: { id: true, profile: { select: { displayName: true } } } },
        customer: { select: { id: true, profile: { select: { displayName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }
}
