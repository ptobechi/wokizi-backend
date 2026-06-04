import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { BaseRepository } from '../../../core/prisma/base.repository';

@Injectable()
export class FollowsRepository extends BaseRepository {
  constructor(prisma: PrismaService) { super(prisma); }

  findRelation(followerId: string, followingId: string) {
    return this.prisma.follow.findUnique({ where: { followerId_followingId: { followerId, followingId } } });
  }

  create(followerId: string, followingId: string) {
    return this.prisma.follow.create({ data: { followerId, followingId } });
  }

  delete(followerId: string, followingId: string) {
    return this.prisma.follow.delete({ where: { followerId_followingId: { followerId, followingId } } });
  }

  incrementFollowerCount(userId: string) {
    return this.prisma.userProfile.update({ where: { userId }, data: { followersCount: { increment: 1 } } });
  }

  decrementFollowerCount(userId: string) {
    return this.prisma.userProfile.update({ where: { userId }, data: { followersCount: { decrement: 1 } } });
  }

  incrementFollowingCount(userId: string) {
    return this.prisma.userProfile.update({ where: { userId }, data: { followingCount: { increment: 1 } } });
  }

  decrementFollowingCount(userId: string) {
    return this.prisma.userProfile.update({ where: { userId }, data: { followingCount: { decrement: 1 } } });
  }

  findFollowers(userId: string, skip: number, take: number) {
    return this.prisma.follow.findMany({
      where: { followingId: userId },
      include: { follower: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true, city: true, isProvider: true } } } } },
      skip, take, orderBy: { createdAt: 'desc' },
    });
  }

  findFollowing(userId: string, skip: number, take: number) {
    return this.prisma.follow.findMany({
      where: { followerId: userId },
      include: { following: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true, city: true, isProvider: true } } } } },
      skip, take, orderBy: { createdAt: 'desc' },
    });
  }

  countFollowers(userId: string) { return this.prisma.follow.count({ where: { followingId: userId } }); }
  countFollowing(userId: string) { return this.prisma.follow.count({ where: { followerId: userId } }); }
}
