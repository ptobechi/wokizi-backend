import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { FollowsRepository } from '../repositories/follows.repository';
import { PaginatedResponseDto } from '../../../common/dto/base-response.dto';
import { EventName } from '../../../common/enums';

@Injectable()
export class FollowsService {
  constructor(private repo: FollowsRepository, private prisma: PrismaService, private eventEmitter: EventEmitter2) {}

  async toggle(followerId: string, followingId: string) {
    if (followerId === followingId) throw new BadRequestException('Cannot follow yourself');
    const target = await this.prisma.user.findUnique({ where: { id: followingId } });
    if (!target) throw new NotFoundException('User not found');

    const existing = await this.repo.findRelation(followerId, followingId);
    if (existing) {
      await this.prisma.$transaction([
        this.repo.delete(followerId, followingId),
        this.repo.decrementFollowingCount(followerId),
        this.repo.decrementFollowerCount(followingId),
      ]);
      return { following: false };
    }

    await this.prisma.$transaction([
      this.repo.create(followerId, followingId),
      this.repo.incrementFollowingCount(followerId),
      this.repo.incrementFollowerCount(followingId),
    ]);

    this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
      userId: followingId, type: 'NEW_FOLLOWER', title: 'New Follower',
      body: 'Someone started following you', data: { followerId },
    });

    return { following: true };
  }

  async getFollowers(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([this.repo.findFollowers(userId, skip, limit), this.repo.countFollowers(userId)]);
    return PaginatedResponseDto.of(data, total, page, limit);
  }

  async getFollowing(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([this.repo.findFollowing(userId, skip, limit), this.repo.countFollowing(userId)]);
    return PaginatedResponseDto.of(data, total, page, limit);
  }

  async isFollowing(followerId: string, followingId: string) {
    const f = await this.repo.findRelation(followerId, followingId);
    return { following: !!f };
  }
}
