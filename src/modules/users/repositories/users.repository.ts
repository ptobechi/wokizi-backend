import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { BaseRepository } from '../../../core/prisma/base.repository';

@Injectable()
export class UsersRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id, deletedAt: null },
      include: {
        profile: true,
        verification: { select: { status: true } },
        _count: { select: { services: true, followers: true, following: true } },
      },
    });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findPublicProfile(id: string) {
    return this.prisma.user.findUnique({
      where: { id, isActive: true, deletedAt: null },
      select: {
        id: true,
        createdAt: true,
        profile: {
          select: {
            displayName: true, firstName: true, lastName: true,
            bio: true, avatarUrl: true, city: true, state: true, country: true,
            isProvider: true, avgRating: true, totalReviews: true, completedJobs: true,
            completionRate: true, responseRate: true, travelRadius: true, followersCount: true,
          },
        },
        verification: { select: { status: true } },
        services: {
          where: { status: 'APPROVED', isPublished: true, deletedAt: null },
          select: { id: true, title: true, slug: true, startingPrice: true, images: { take: 1 } },
          take: 6,
        },
        _count: { select: { followers: true } },
      },
    });
  }

  deactivate(id: string) {
    return this.prisma.user.update({ where: { id }, data: { isActive: false } });
  }
}
