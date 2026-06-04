import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { BaseRepository } from '../../../core/prisma/base.repository';

@Injectable()
export class MessagesRepository extends BaseRepository {
  constructor(prisma: PrismaService) { super(prisma); }

  create(data: any) {
    return this.prisma.message.create({
      data,
      include: {
        media: true,
        sender: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
      },
    });
  }

  findByConversation(conversationId: string, skip: number, take: number) {
    return this.prisma.message.findMany({
      where: { conversationId, deletedAt: null },
      include: {
        media: true,
        sender: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  countByConversation(conversationId: string) {
    return this.prisma.message.count({ where: { conversationId, deletedAt: null } });
  }

  markConversationRead(conversationId: string, notSenderId: string) {
    return this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: notSenderId }, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  softDelete(id: string) {
    return this.prisma.message.update({ where: { id }, data: { deletedAt: new Date(), content: null } });
  }

  markDelivered(id: string) {
    return this.prisma.message.update({ where: { id }, data: { isDelivered: true, deliveredAt: new Date() } });
  }

  countUnread(userId: string) {
    return this.prisma.message.count({
      where: {
        conversation: { participants: { some: { userId } } },
        senderId: { not: userId },
        isRead: false,
        deletedAt: null,
      },
    });
  }

  findParticipants(conversationId: string, excludeUserId: string) {
    return this.prisma.conversationParticipant.findMany({
      where: { conversationId, userId: { not: excludeUserId } },
    });
  }
}
