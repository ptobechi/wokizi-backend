import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { BaseRepository } from '../../../core/prisma/base.repository';

@Injectable()
export class CategoriesRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  findAll() {
    return this.prisma.category.findMany({
      where: { isActive: true, parentId: null },
      include: {
        children: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        _count: { select: { services: { where: { status: 'APPROVED' } } } },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  findBySlug(slug: string) {
    return this.prisma.category.findUnique({
      where: { slug },
      include: {
        children: { where: { isActive: true } },
        _count: { select: { services: { where: { status: 'APPROVED' } } } },
      },
    });
  }

  findById(id: string) {
    return this.prisma.category.findUnique({ where: { id } });
  }

  findByName(name: string) {
    return this.prisma.category.findUnique({ where: { name } });
  }

  findBySlugUnique(slug: string) {
    return this.prisma.category.findUnique({ where: { slug } });
  }

  create(data: { name: string; slug: string; description?: string; iconUrl?: string; parentId?: string; sortOrder?: number }) {
    return this.prisma.category.create({ data, include: { children: true } });
  }

  update(id: string, data: Record<string, any>) {
    return this.prisma.category.update({ where: { id }, data });
  }

  deactivate(id: string) {
    return this.prisma.category.update({ where: { id }, data: { isActive: false } });
  }
}
