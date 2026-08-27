import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { ConversationsRepository } from '../repositories/conversations.repository';
import { PaginatedResponseDto } from '../../../common/dto/base-response.dto';
import { EventName } from '../../../common/enums';

export class CreateConversationDto {
  @IsUUID() recipientId: string;
  @IsOptional() @IsUUID() serviceId?: string;
  @IsOptional() @IsString() initialMessage?: string;
}

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    private repo: ConversationsRepository,
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(userId: string, dto: CreateConversationDto, options?: { skipNotifications?: boolean }) {
    if (dto.recipientId === userId) throw new BadRequestException('Cannot start conversation with yourself');

    const recipient = await this.prisma.user.findUnique({ where: { id: dto.recipientId } });
    if (!recipient) throw new NotFoundException('Recipient not found');

    const existing = await this.repo.findExisting(userId, dto.recipientId, dto.serviceId);
    if (existing && existing.participants.length === 2) return existing;

    const conversation = await this.repo.create({ userA: userId, userB: dto.recipientId, serviceId: dto.serviceId });

    // ServiceRequestsService creates a ServiceRequest row right after calling
    // this and fires its own NEW_SERVICE_REQUEST/SERVICE_REQUEST_SENT with the
    // real requestId attached — that row doesn't exist yet at this point, so
    // it opts out here rather than us firing a notification with no requestId.
    if (!options?.skipNotifications) {
      // Notify the recipient of the new service request
      const senderProfile = await this.prisma.userProfile.findUnique({
        where: { userId }, select: { displayName: true },
      });
      const senderName = senderProfile?.displayName ?? 'Someone';

      let serviceTitle = 'your service';
      if (dto.serviceId) {
        const svc = await this.prisma.serviceListing.findUnique({
          where: { id: dto.serviceId }, select: { title: true },
        });
        if (svc) serviceTitle = svc.title;
      }

      // Notify the provider
      this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
        userId:   dto.recipientId,
        type:     'NEW_SERVICE_REQUEST',
        ctx:      { userName: senderName, serviceName: serviceTitle },
        linkData: { conversationId: conversation.id, senderId: userId },
      });

      // Confirm to the client their request was sent
      const recipientProfile = await this.prisma.userProfile.findUnique({
        where: { userId: dto.recipientId }, select: { displayName: true },
      });
      this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
        userId:   userId,
        type:     'SERVICE_REQUEST_SENT',
        ctx:      { artisanName: recipientProfile?.displayName ?? 'the artisan' },
        linkData: { conversationId: conversation.id },
      });
    }

    return conversation;
  }

  async findAll(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.repo.findAllByUser(userId, skip, limit),
      this.repo.countByUser(userId),
    ]);
    return PaginatedResponseDto.of(data, total, page, limit);
  }

  async findAllArchived(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.repo.findArchivedByUser(userId, skip, limit),
      this.repo.countArchivedByUser(userId),
    ]);
    this.logger.debug(`[TRACE:ARCHIVED] userId=${userId} total=${total} returned=${data.length}`);
    return PaginatedResponseDto.of(data, total, page, limit);
  }

  async findById(conversationId: string, userId: string) {
    await this.ensureParticipant(userId, conversationId);
    const conv = await this.repo.findById(conversationId, userId);
    if (!conv) throw new NotFoundException('Conversation not found');
    return conv;
  }

  async ensureParticipant(userId: string, conversationId: string) {
    const p = await this.repo.findParticipant(conversationId, userId);
    if (!p) throw new ForbiddenException('Not a participant in this conversation');
    return p;
  }

  updateLastMessage(conversationId: string, content: string, senderId: string) {
    return this.repo.updateLastMessage(conversationId, content, senderId);
  }

  markRead(conversationId: string, userId: string) {
    return this.repo.markParticipantRead(conversationId, userId);
  }

  async archive(conversationId: string, userId: string, reason?: string) {
    await this.ensureParticipant(userId, conversationId);
    return this.repo.archive(conversationId, reason);
  }

  /** Called internally by booking lifecycle — skips participant check */
  archiveForBooking(conversationId: string, reason: string) {
    return this.repo.archive(conversationId, reason);
  }
}
