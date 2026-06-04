import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { BaseRepository } from '../../../core/prisma/base.repository';

@Injectable()
export class PortfoliosRepository extends BaseRepository {
  constructor(prisma: PrismaService) { super(prisma); }

  getOrCreate(userId: string) {
    return this.prisma.portfolio.upsert({
      where: { userId },
      update: {},
      create: { userId },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  findItemById(id: string) {
    return this.prisma.portfolioItem.findUnique({ where: { id } });
  }

  createItem(portfolioId: string, data: any) {
    return this.prisma.portfolioItem.create({ data: { ...data, portfolioId } });
  }

  deleteItem(id: string) {
    return this.prisma.portfolioItem.delete({ where: { id } });
  }

  findItems(userId: string, serviceId?: string) {
    return this.prisma.portfolioItem.findMany({
      where: { portfolio: { userId }, ...(serviceId ? { serviceId } : {}) },
      orderBy: { sortOrder: 'asc' },
    });
  }

  findPublic(userId: string) {
    return this.prisma.portfolioItem.findMany({
      where: { portfolio: { userId } },
      orderBy: { sortOrder: 'asc' },
    });
  }
}
