import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SupportTicketStatus } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { EventName } from '../../../common/enums';
import { CreateTicketDto } from '../dto/create-ticket.dto';
import { UpdateTicketDto } from '../dto/update-ticket.dto';

@Injectable()
export class SupportService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async createTicket(userId: string, dto: CreateTicketDto) {
    const ticket = await this.prisma.supportTicket.create({
      data: { userId, ...dto },
    });

    this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
      userId,
      type: 'SUPPORT_TICKET_CREATED',
      ctx:  { ticketSubject: dto.subject },
      linkData: { ticketId: ticket.id },
    });

    return ticket;
  }

  async getMyTickets(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.supportTicket.count({ where: { userId } }),
    ]);
    return { data, meta: { page, limit, total } };
  }

  // ── Admin ──────────────────────────────────────────────────────────────

  async listAllTickets(filters: { status?: SupportTicketStatus; page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (filters.status) where.status = filters.status;

    const [data, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        include: {
          user: { select: { id: true, phone: true, profile: { select: { displayName: true, avatarUrl: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return { data, meta: { page, limit, total } };
  }

  async updateTicket(ticketId: string, dto: UpdateTicketDto) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const resolvedAt =
      dto.status === SupportTicketStatus.RESOLVED && !ticket.resolvedAt ? new Date() : undefined;

    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        ...(dto.status    ? { status: dto.status }       : {}),
        ...(dto.adminNote ? { adminNote: dto.adminNote } : {}),
        ...(resolvedAt    ? { resolvedAt }               : {}),
      },
    });

    const notifMap: Partial<Record<SupportTicketStatus, string>> = {
      [SupportTicketStatus.IN_PROGRESS]:    'SUPPORT_TICKET_UPDATED',
      [SupportTicketStatus.AWAITING_USER]:  'SUPPORT_TICKET_UPDATED',
      [SupportTicketStatus.RESOLVED]:       'SUPPORT_TICKET_RESOLVED',
      [SupportTicketStatus.CLOSED]:         'SUPPORT_TICKET_CLOSED',
    };

    if (dto.status && notifMap[dto.status]) {
      this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
        userId:   ticket.userId,
        type:     notifMap[dto.status],
        ctx:      { ticketSubject: ticket.subject },
        linkData: { ticketId },
      });
    }

    return updated;
  }

  async getTicketById(ticketId: string, userId: string, isAdmin: boolean) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (!isAdmin && ticket.userId !== userId) throw new ForbiddenException();
    return ticket;
  }
}
