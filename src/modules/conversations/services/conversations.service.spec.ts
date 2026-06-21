import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConversationsService } from './conversations.service';
import { ConversationsRepository } from '../repositories/conversations.repository';
import { PrismaService } from '../../../core/prisma/prisma.service';

const USER_A    = 'user-a-uuid';
const USER_B    = 'user-b-uuid';
const SERVICE_ID = 'service-uuid-1';
const CONVO_ID  = 'convo-uuid-1';

const mockConversation = {
  id:           CONVO_ID,
  isArchived:   false,
  archivedAt:   null,
  closedReason: null,
  createdAt:    new Date(),
  participants: [
    { userId: USER_A },
    { userId: USER_B },
  ],
};

describe('ConversationsService', () => {
  let service: ConversationsService;
  let repo: any;
  let prisma: any;
  let eventEmitter: any;

  beforeEach(async () => {
    repo = {
      findExisting:          jest.fn(),
      create:                jest.fn(),
      findAllByUser:         jest.fn(),
      countByUser:           jest.fn(),
      findArchivedByUser:    jest.fn(),
      countArchivedByUser:   jest.fn(),
      findById:              jest.fn(),
      findParticipant:       jest.fn(),
      updateLastMessage:     jest.fn(),
      markParticipantRead:   jest.fn(),
      archive:               jest.fn(),
    };

    prisma = {
      user: {
        findUnique: jest.fn(),
      },
      userProfile: {
        findUnique: jest.fn().mockResolvedValue({ displayName: 'Emeka Builder' }),
      },
      serviceListing: {
        findUnique: jest.fn().mockResolvedValue({ title: 'Home Plumbing' }),
      },
    };

    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: ConversationsRepository, useValue: repo },
        { provide: PrismaService,           useValue: prisma },
        { provide: EventEmitter2,           useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a new conversation between two users', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: USER_B });
      repo.findExisting.mockResolvedValue(null);
      repo.create.mockResolvedValue(mockConversation);

      const result = await service.create(USER_A, { recipientId: USER_B, serviceId: SERVICE_ID });
      expect(result).toEqual(mockConversation);
      expect(repo.create).toHaveBeenCalledWith({ userA: USER_A, userB: USER_B, serviceId: SERVICE_ID });
    });

    it('returns existing conversation when one already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: USER_B });
      repo.findExisting.mockResolvedValue(mockConversation);

      const result = await service.create(USER_A, { recipientId: USER_B, serviceId: SERVICE_ID });
      expect(result).toEqual(mockConversation);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('notifies provider of NEW_SERVICE_REQUEST', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: USER_B });
      repo.findExisting.mockResolvedValue(null);
      repo.create.mockResolvedValue(mockConversation);

      await service.create(USER_A, { recipientId: USER_B, serviceId: SERVICE_ID });
      expect(eventEmitter.emit).toHaveBeenCalledWith('notification.send', expect.objectContaining({
        userId: USER_B, type: 'NEW_SERVICE_REQUEST',
      }));
    });

    it('notifies sender with SERVICE_REQUEST_SENT confirmation', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: USER_B });
      repo.findExisting.mockResolvedValue(null);
      repo.create.mockResolvedValue(mockConversation);

      await service.create(USER_A, { recipientId: USER_B, serviceId: SERVICE_ID });
      expect(eventEmitter.emit).toHaveBeenCalledWith('notification.send', expect.objectContaining({
        userId: USER_A, type: 'SERVICE_REQUEST_SENT',
      }));
    });

    it('throws BadRequestException when user tries to message themselves', async () => {
      await expect(service.create(USER_A, { recipientId: USER_A }))
        .rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when recipient does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.create(USER_A, { recipientId: 'ghost-user' }))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated conversations for a user', async () => {
      repo.findAllByUser.mockResolvedValue([mockConversation]);
      repo.countByUser.mockResolvedValue(1);

      const result = await service.findAll(USER_A);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('returns empty page when user has no conversations', async () => {
      repo.findAllByUser.mockResolvedValue([]);
      repo.countByUser.mockResolvedValue(0);

      const result = await service.findAll(USER_A);
      expect(result.data).toHaveLength(0);
    });
  });

  // ── findAllArchived ────────────────────────────────────────────────────────

  describe('findAllArchived', () => {
    it('returns paginated archived conversations', async () => {
      const archived = { ...mockConversation, isArchived: true };
      repo.findArchivedByUser.mockResolvedValue([archived]);
      repo.countArchivedByUser.mockResolvedValue(1);

      const result = await service.findAllArchived(USER_A);
      expect(result.data).toHaveLength(1);
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns conversation for a participant', async () => {
      repo.findParticipant.mockResolvedValue({ id: 'p-1' });
      repo.findById.mockResolvedValue(mockConversation);

      const result = await service.findById(CONVO_ID, USER_A);
      expect(result).toEqual(mockConversation);
    });

    it('throws NotFoundException when conversation not found', async () => {
      repo.findParticipant.mockResolvedValue({ id: 'p-1' });
      repo.findById.mockResolvedValue(null);

      await expect(service.findById(CONVO_ID, USER_A)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for non-participant', async () => {
      repo.findParticipant.mockResolvedValue(null);
      await expect(service.findById(CONVO_ID, 'outsider')).rejects.toThrow(ForbiddenException);
    });
  });

  // ── ensureParticipant ─────────────────────────────────────────────────────

  describe('ensureParticipant', () => {
    it('returns participant record when user is a participant', async () => {
      const p = { id: 'p-1', userId: USER_A };
      repo.findParticipant.mockResolvedValue(p);

      const result = await service.ensureParticipant(USER_A, CONVO_ID);
      expect(result).toEqual(p);
    });

    it('throws ForbiddenException when user is not a participant', async () => {
      repo.findParticipant.mockResolvedValue(null);
      await expect(service.ensureParticipant('outsider', CONVO_ID))
        .rejects.toThrow(ForbiddenException);
    });
  });

  // ── archive ───────────────────────────────────────────────────────────────

  describe('archive', () => {
    it('archives conversation for a participant', async () => {
      repo.findParticipant.mockResolvedValue({ id: 'p-1' });
      repo.archive.mockResolvedValue({ ...mockConversation, isArchived: true });

      const result = await service.archive(CONVO_ID, USER_A, 'COMPLETED');
      expect(result.isArchived).toBe(true);
    });

    it('throws ForbiddenException when non-participant tries to archive', async () => {
      repo.findParticipant.mockResolvedValue(null);
      await expect(service.archive(CONVO_ID, 'outsider')).rejects.toThrow(ForbiddenException);
    });
  });

  // ── updateLastMessage ─────────────────────────────────────────────────────

  describe('updateLastMessage', () => {
    it('delegates to repository', () => {
      repo.updateLastMessage.mockResolvedValue({});
      service.updateLastMessage(CONVO_ID, 'hello', USER_A);
      expect(repo.updateLastMessage).toHaveBeenCalledWith(CONVO_ID, 'hello', USER_A);
    });
  });

  // ── markRead ──────────────────────────────────────────────────────────────

  describe('markRead', () => {
    it('delegates to repository', () => {
      repo.markParticipantRead.mockResolvedValue({});
      service.markRead(CONVO_ID, USER_A);
      expect(repo.markParticipantRead).toHaveBeenCalledWith(CONVO_ID, USER_A);
    });
  });
});
