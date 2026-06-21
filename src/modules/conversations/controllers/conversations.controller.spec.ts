import { Test, TestingModule } from '@nestjs/testing';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from '../services/conversations.service';

const mockConversationsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findAllArchived: jest.fn(),
  findById: jest.fn(),
  archive: jest.fn(),
};

describe('ConversationsController', () => {
  let controller: ConversationsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversationsController],
      providers: [{ provide: ConversationsService, useValue: mockConversationsService }],
    }).compile();
    controller = module.get(ConversationsController);
  });

  describe('create', () => {
    it('creates or retrieves an existing conversation', async () => {
      const dto = { serviceListingId: 's1' };
      const conversation = { id: 'c1', status: 'OPEN' };
      mockConversationsService.create.mockResolvedValue(conversation);

      const result = await controller.create('customer-1', dto as any);

      expect(mockConversationsService.create).toHaveBeenCalledWith('customer-1', dto);
      expect(result).toEqual(conversation);
    });
  });

  describe('findAll', () => {
    it('returns paginated active conversations', async () => {
      const page = {
        data: [{ id: 'c1' }, { id: 'c2' }],
        meta: { total: 2, page: 1, limit: 20, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      };
      mockConversationsService.findAll.mockResolvedValue(page);

      const result = await controller.findAll('u1', 1, 20);

      expect(mockConversationsService.findAll).toHaveBeenCalledWith('u1', 1, 20);
      expect(result).toEqual(page);
    });
  });

  describe('findArchived', () => {
    it('returns paginated archived conversations', async () => {
      const page = {
        data: [{ id: 'c3', isArchived: true }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      };
      mockConversationsService.findAllArchived.mockResolvedValue(page);

      const result = await controller.findArchived('u1', 1, 20);

      expect(mockConversationsService.findAllArchived).toHaveBeenCalledWith('u1', 1, 20);
      expect(result).toEqual(page);
    });
  });

  describe('findOne', () => {
    it('returns a single conversation with messages', async () => {
      const conversation = { id: 'c1', status: 'OPEN', messages: [] };
      mockConversationsService.findById.mockResolvedValue(conversation);

      const result = await controller.findOne('u1', 'c1');

      expect(mockConversationsService.findById).toHaveBeenCalledWith('c1', 'u1');
      expect(result).toEqual(conversation);
    });
  });

  describe('archive', () => {
    it('archives a conversation', async () => {
      const archived = { id: 'c1', isArchived: true };
      mockConversationsService.archive.mockResolvedValue(archived);

      const result = await controller.archive('u1', 'c1');

      expect(mockConversationsService.archive).toHaveBeenCalledWith('c1', 'u1');
      expect(result).toEqual(archived);
    });
  });
});
