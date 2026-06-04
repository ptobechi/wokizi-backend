import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MessageType } from '@prisma/client';
import { MessagesRepository } from '../repositories/messages.repository';
import { ConversationsService } from '../../conversations/services/conversations.service';
import { SendMessageDto } from '../dto/requests/send-message.dto';
import { PaginatedResponseDto } from '../../../common/dto/base-response.dto';
import { EventName } from '../../../common/enums';

@Injectable()
export class MessagesService {
  constructor(
    private repo: MessagesRepository,
    private conversationsService: ConversationsService,
    private eventEmitter: EventEmitter2,
  ) {}

  async send(userId: string, conversationId: string, dto: SendMessageDto) {
    await this.conversationsService.ensureParticipant(userId, conversationId);

    if (!dto.content && (!dto.media || !dto.media.length)) {
      throw new BadRequestException('Message must have content or media');
    }

    const message = await this.repo.create({
      conversationId,
      senderId: userId,
      content: dto.content,
      type: dto.type,
      media: dto.media?.length ? { create: dto.media } : undefined,
    });

    await this.conversationsService.updateLastMessage(
      conversationId,
      dto.content || `[${dto.type}]`,
      userId,
    );

    this.eventEmitter.emit(EventName.CHAT_MESSAGE, { message, conversationId });

    const recipients = await this.repo.findParticipants(conversationId, userId);
    for (const p of recipients) {
      this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
        userId: p.userId,
        type: 'NEW_MESSAGE',
        title: 'New Message',
        body: dto.content?.substring(0, 100) || 'New attachment',
        data: { conversationId, messageId: message.id },
      });
    }

    return message;
  }

  async findByConversation(userId: string, conversationId: string, page = 1, limit = 30) {
    await this.conversationsService.ensureParticipant(userId, conversationId);

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.repo.findByConversation(conversationId, skip, limit),
      this.repo.countByConversation(conversationId),
    ]);

    await this.repo.markConversationRead(conversationId, userId);
    await this.conversationsService.markRead(conversationId, userId);

    return PaginatedResponseDto.of(data.reverse(), total, page, limit);
  }

  async delete(userId: string, messageId: string) {
    const msg = await this.repo.softDelete(messageId);
    if (!msg) throw new NotFoundException('Message not found');
    return msg;
  }

  async markDelivered(messageId: string) {
    return this.repo.markDelivered(messageId);
  }

  async getUnreadCount(userId: string) {
    const count = await this.repo.countUnread(userId);
    return { unreadCount: count };
  }
}
