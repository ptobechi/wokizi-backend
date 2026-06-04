import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { BaseRepository } from '../../../core/prisma/base.repository';

@Injectable()
export class ConversationsRepository extends BaseRepository {
  constructor(prisma: PrismaService) { super(prisma); }

  findExisting(userA: string, userB: string, serviceId?: string | null) {
    return this.prisma.conversation.findFirst({
      where: {
        serviceId: serviceId || null,
        participants: { every: { userId: { in: [userA, userB] } } },
      },
      include: { participants: true },
    });
  }

  create(data: { userA: string; userB: string; serviceId?: string }) {
    return this.prisma.conversation.create({
      data: {
        serviceId: data.serviceId,
        participants: { create: [{ userId: data.userA }, { userId: data.userB }] },
      },
      include: { participants: { include: { user: { select: { id: true, profile: true } } } } },
    });
  }

  findAllByUser(userId: string, skip: number, take: number) {
    return this.prisma.conversation.findMany({
      where: { participants: { some: { userId } } },
      include: {
        participants: {
          where: { userId: { not: userId } },
          include: { user: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } } },
        },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { messages: { where: { isRead: false, senderId: { not: userId } } } } },
      },
      orderBy: { lastMessageAt: 'desc' },
      skip,
      take,
    });
  }

  countByUser(userId: string) {
    return this.prisma.conversation.count({ where: { participants: { some: { userId } } } });
  }

  findParticipant(conversationId: string, userId: string) {
    return this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
  }

  updateLastMessage(conversationId: string, content: string, senderId: string) {
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        lastMessage: content.substring(0, 100),
        participants: { updateMany: { where: { userId: { not: senderId } }, data: { isRead: false } } },
      },
    });
  }

  markParticipantRead(conversationId: string, userId: string) {
    return this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { isRead: true, lastReadAt: new Date() },
    });
  }
}
