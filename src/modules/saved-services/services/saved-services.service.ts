import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { PaginatedResponseDto } from '../../../common/dto/base-response.dto';

@Injectable()
export class SavedServicesService {
  constructor(private prisma: PrismaService) {}

  async toggle(userId: string, serviceId: string) {
    const service = await this.prisma.serviceListing.findUnique({ where: { id: serviceId } });
    if (!service) throw new NotFoundException('Service not found');

    const existing = await this.prisma.savedService.findUnique({ where: { userId_serviceId: { userId, serviceId } } });

    if (existing) {
      await this.prisma.$transaction([
        this.prisma.savedService.delete({ where: { userId_serviceId: { userId, serviceId } } }),
        this.prisma.serviceListing.update({ where: { id: serviceId }, data: { savesCount: { decrement: 1 } } }),
      ]);
      return { saved: false };
    }

    await this.prisma.$transaction([
      this.prisma.savedService.create({ data: { userId, serviceId } }),
      this.prisma.serviceListing.update({ where: { id: serviceId }, data: { savesCount: { increment: 1 } } }),
    ]);

    return { saved: true };
  }

  async getMySaved(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.savedService.findMany({
        where: { userId },
        include: {
          service: {
            include: {
              images: { take: 1 },
              provider: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
            },
          },
        },
        skip, take: limit, orderBy: { createdAt: 'desc' },
      }),
      this.prisma.savedService.count({ where: { userId } }),
    ]);
    return PaginatedResponseDto.of(data, total, page, limit);
  }
}
