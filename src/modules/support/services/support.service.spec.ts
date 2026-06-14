import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SupportTicketStatus } from '@prisma/client';
import { SupportService } from './support.service';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { EventName } from '../../../common/enums';

const mockTicket = {
  id: 'ticket-uuid-1',
  userId: 'user-uuid-1',
  subject: 'Payment not received',
  message: 'I completed the job but payment has not arrived.',
  category: 'PAYMENT_ISSUE',
  status: SupportTicketStatus.OPEN,
  priority: 'NORMAL',
  adminNote: null,
  resolvedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('SupportService', () => {
  let service: SupportService;
  let prisma: any;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    prisma = {
      supportTicket: {
        create:    jest.fn(),
        findMany:  jest.fn(),
        count:     jest.fn(),
        findUnique: jest.fn(),
        update:    jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupportService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service      = module.get<SupportService>(SupportService);
    eventEmitter = module.get(EventEmitter2);
  });

  afterEach(() => jest.clearAllMocks());

  // ── createTicket ──────────────────────────────────────────────────────────

  describe('createTicket', () => {
    const dto = { subject: 'Payment not received', message: 'Help!', category: 'PAYMENT_ISSUE' as any };

    it('creates ticket and emits SUPPORT_TICKET_CREATED notification', async () => {
      prisma.supportTicket.create.mockResolvedValue(mockTicket);

      const result = await service.createTicket('user-uuid-1', dto);

      expect(prisma.supportTicket.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 'user-uuid-1' }) }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        EventName.NOTIFICATION_SEND,
        expect.objectContaining({
          userId: 'user-uuid-1',
          type: 'SUPPORT_TICKET_CREATED',
          ctx: { ticketSubject: dto.subject },
        }),
      );
      expect(result.id).toBe(mockTicket.id);
    });
  });

  // ── getMyTickets ──────────────────────────────────────────────────────────

  describe('getMyTickets', () => {
    it('returns paginated tickets for user', async () => {
      prisma.supportTicket.findMany.mockResolvedValue([mockTicket]);
      prisma.supportTicket.count.mockResolvedValue(1);

      const result = await service.getMyTickets('user-uuid-1', 1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(prisma.supportTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-uuid-1' } }),
      );
    });

    it('applies correct pagination skip', async () => {
      prisma.supportTicket.findMany.mockResolvedValue([]);
      prisma.supportTicket.count.mockResolvedValue(0);

      await service.getMyTickets('user-uuid-1', 3, 10);

      expect(prisma.supportTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });
  });

  // ── listAllTickets ────────────────────────────────────────────────────────

  describe('listAllTickets', () => {
    it('lists all tickets without status filter', async () => {
      prisma.supportTicket.findMany.mockResolvedValue([mockTicket]);
      prisma.supportTicket.count.mockResolvedValue(1);

      const result = await service.listAllTickets({});

      expect(prisma.supportTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
      expect(result.data).toHaveLength(1);
    });

    it('filters by status when provided', async () => {
      prisma.supportTicket.findMany.mockResolvedValue([]);
      prisma.supportTicket.count.mockResolvedValue(0);

      await service.listAllTickets({ status: SupportTicketStatus.OPEN });

      expect(prisma.supportTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: SupportTicketStatus.OPEN } }),
      );
    });
  });

  // ── updateTicket ──────────────────────────────────────────────────────────

  describe('updateTicket', () => {
    beforeEach(() => {
      prisma.supportTicket.findUnique.mockResolvedValue(mockTicket);
      prisma.supportTicket.update.mockResolvedValue({ ...mockTicket, status: SupportTicketStatus.IN_PROGRESS });
    });

    it('throws NotFoundException when ticket not found', async () => {
      prisma.supportTicket.findUnique.mockResolvedValue(null);
      await expect(service.updateTicket('bad-id', { status: SupportTicketStatus.IN_PROGRESS })).rejects.toThrow(NotFoundException);
    });

    it('updates status to IN_PROGRESS and emits SUPPORT_TICKET_UPDATED', async () => {
      await service.updateTicket('ticket-uuid-1', { status: SupportTicketStatus.IN_PROGRESS });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        EventName.NOTIFICATION_SEND,
        expect.objectContaining({ type: 'SUPPORT_TICKET_UPDATED' }),
      );
    });

    it('emits SUPPORT_TICKET_RESOLVED when status changes to RESOLVED', async () => {
      prisma.supportTicket.update.mockResolvedValue({ ...mockTicket, status: SupportTicketStatus.RESOLVED });

      await service.updateTicket('ticket-uuid-1', { status: SupportTicketStatus.RESOLVED });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        EventName.NOTIFICATION_SEND,
        expect.objectContaining({ type: 'SUPPORT_TICKET_RESOLVED' }),
      );
    });

    it('emits SUPPORT_TICKET_CLOSED when status changes to CLOSED', async () => {
      prisma.supportTicket.update.mockResolvedValue({ ...mockTicket, status: SupportTicketStatus.CLOSED });

      await service.updateTicket('ticket-uuid-1', { status: SupportTicketStatus.CLOSED });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        EventName.NOTIFICATION_SEND,
        expect.objectContaining({ type: 'SUPPORT_TICKET_CLOSED' }),
      );
    });

    it('sets resolvedAt timestamp when resolving previously unresolved ticket', async () => {
      await service.updateTicket('ticket-uuid-1', { status: SupportTicketStatus.RESOLVED });

      expect(prisma.supportTicket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ resolvedAt: expect.any(Date) }),
        }),
      );
    });

    it('does NOT reset resolvedAt when ticket was already resolved', async () => {
      const alreadyResolved = { ...mockTicket, resolvedAt: new Date('2026-01-01') };
      prisma.supportTicket.findUnique.mockResolvedValue(alreadyResolved);

      await service.updateTicket('ticket-uuid-1', { status: SupportTicketStatus.RESOLVED });

      const updateCall = prisma.supportTicket.update.mock.calls[0][0];
      expect(updateCall.data.resolvedAt).toBeUndefined();
    });

    it('does NOT emit notification when status is unchanged (only adminNote updated)', async () => {
      await service.updateTicket('ticket-uuid-1', { adminNote: 'Investigating now' });

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('updates only adminNote without changing status', async () => {
      await service.updateTicket('ticket-uuid-1', { adminNote: 'Looking into this' });

      expect(prisma.supportTicket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ adminNote: 'Looking into this' }),
        }),
      );
    });
  });

  // ── getTicketById ─────────────────────────────────────────────────────────

  describe('getTicketById', () => {
    it('returns ticket when user is the owner', async () => {
      prisma.supportTicket.findUnique.mockResolvedValue(mockTicket);

      const result = await service.getTicketById('ticket-uuid-1', 'user-uuid-1', false);

      expect(result.id).toBe(mockTicket.id);
    });

    it('returns ticket when caller is admin regardless of ownership', async () => {
      const otherUsersTicket = { ...mockTicket, userId: 'other-user' };
      prisma.supportTicket.findUnique.mockResolvedValue(otherUsersTicket);

      const result = await service.getTicketById('ticket-uuid-1', 'admin-user', true);

      expect(result.id).toBe(mockTicket.id);
    });

    it('throws NotFoundException for non-existent ticket', async () => {
      prisma.supportTicket.findUnique.mockResolvedValue(null);

      await expect(service.getTicketById('bad-id', 'user-uuid-1', false)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when non-admin accesses another user\'s ticket', async () => {
      const otherUsersTicket = { ...mockTicket, userId: 'other-user' };
      prisma.supportTicket.findUnique.mockResolvedValue(otherUsersTicket);

      await expect(service.getTicketById('ticket-uuid-1', 'user-uuid-1', false)).rejects.toThrow(ForbiddenException);
    });
  });
});
