import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';

@Injectable()
export class LikesService {
  constructor(private prisma: PrismaService) {}

  async toggle(userId: string, serviceId: string) {
    const service = await this.prisma.serviceListing.findUnique({ where: { id: serviceId } });
    if (!service) throw new NotFoundException('Service not found');

    const existing = await this.prisma.serviceLike.findUnique({ where: { userId_serviceId: { userId, serviceId } } });

    if (existing) {
      await this.prisma.$transaction([
        this.prisma.serviceLike.delete({ where: { userId_serviceId: { userId, serviceId } } }),
        this.prisma.serviceListing.update({ where: { id: serviceId }, data: { likesCount: { decrement: 1 } } }),
      ]);
      return { liked: false };
    }

    await this.prisma.$transaction([
      this.prisma.serviceLike.create({ data: { userId, serviceId } }),
      this.prisma.serviceListing.update({ where: { id: serviceId }, data: { likesCount: { increment: 1 } } }),
    ]);

    return { liked: true };
  }
}
