import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { BaseRepository } from '../../../core/prisma/base.repository';

@Injectable()
export class ConversationsRepository extends BaseRepository {
  constructor(prisma: PrismaService) { super(prisma); }

  findExisting(userA: string, userB: string, serviceId?: string | null) {
    return this.prisma.conversation.findFirst({
      where: {
        serviceId:  serviceId || null,
        isArchived: false,
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

  archive(id: string, reason?: string) {
    return this.prisma.conversation.update({
      where: { id },
      data: { isArchived: true, archivedAt: new Date(), ...(reason ? { closedReason: reason } : {}) },
    });
  }

  async findAllByUser(userId: string, skip: number, take: number) {
    const rows = await this.prisma.conversation.findMany({
      where: { participants: { some: { userId } }, isArchived: false },
      include: {
        participants: {
          where: { userId: { not: userId } },
          include: { user: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true, city: true } } } } },
        },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { messages: { where: { isRead: false, senderId: { not: userId } } } } },
      },
      orderBy: { lastMessageAt: 'desc' },
      skip,
      take,
    });

    return rows.map(({ messages, participants, ...rest }) => ({
      ...rest,
      participants: participants.map((p) => ({ id: p.user.id, profile: p.user.profile ?? null })),
      lastMessage: messages[0]
        ? { id: messages[0].id, content: messages[0].content, type: messages[0].type, createdAt: messages[0].createdAt, senderId: messages[0].senderId }
        : null,
    }));
  }

  async findById(id: string, forUserId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        participants: {
          include: { user: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true, city: true } } } } },
        },
        _count: { select: { messages: { where: { isRead: false, senderId: { not: forUserId } } } } },
      },
    });
    if (!conv) return null;

    let serviceOwnerId: string | null = null;
    if (conv.serviceId) {
      const svc = await this.prisma.serviceListing.findUnique({ where: { id: conv.serviceId }, select: { providerId: true } });
      serviceOwnerId = svc?.providerId ?? null;
    }

    return {
      ...conv,
      participants: conv.participants.map((p) => ({ id: p.user.id, profile: p.user.profile ?? null })),
      lastMessage: null as null,
      serviceOwnerId,
    };
  }

  countByUser(userId: string) {
    return this.prisma.conversation.count({ where: { participants: { some: { userId } }, isArchived: false } });
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
