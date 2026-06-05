import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { ConversationsRepository } from '../repositories/conversations.repository';
import { PaginatedResponseDto } from '../../../common/dto/base-response.dto';

export class CreateConversationDto {
  @IsUUID() recipientId: string;
  @IsOptional() @IsUUID() serviceId?: string;
  @IsOptional() @IsString() initialMessage?: string;
}

@Injectable()
export class ConversationsService {
  constructor(
    private repo: ConversationsRepository,
    private prisma: PrismaService,
  ) {}

  async create(userId: string, dto: CreateConversationDto) {
    if (dto.recipientId === userId) throw new BadRequestException('Cannot start conversation with yourself');

    const recipient = await this.prisma.user.findUnique({ where: { id: dto.recipientId } });
    if (!recipient) throw new NotFoundException('Recipient not found');

    const existing = await this.repo.findExisting(userId, dto.recipientId, dto.serviceId);
    if (existing && existing.participants.length === 2) return existing;

    return this.repo.create({ userA: userId, userB: dto.recipientId, serviceId: dto.serviceId });
  }

  async findAll(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.repo.findAllByUser(userId, skip, limit),
      this.repo.countByUser(userId),
    ]);
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
}
