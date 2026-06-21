import { Test, TestingModule } from '@nestjs/testing';
import { QuotationsController } from './quotations.controller';
import { QuotationsService } from '../services/quotations.service';

const mockQuotationsService = {
  create: jest.fn(),
  revise: jest.fn(),
  respond: jest.fn(),
  getConversationQuotations: jest.fn(),
  getMyQuotations: jest.fn(),
};

describe('QuotationsController', () => {
  let controller: QuotationsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuotationsController],
      providers: [{ provide: QuotationsService, useValue: mockQuotationsService }],
    }).compile();
    controller = module.get(QuotationsController);
  });

  describe('create', () => {
    it('creates a quotation and returns it', async () => {
      const dto = { conversationId: 'c1', totalAmount: 50000 };
      const quotation = { id: 'q1', status: 'SENT', totalAmount: 50000 };
      mockQuotationsService.create.mockResolvedValue(quotation);

      const result = await controller.create('provider-1', dto as any);

      expect(mockQuotationsService.create).toHaveBeenCalledWith('provider-1', dto);
      expect(result).toEqual(quotation);
    });
  });

  describe('revise', () => {
    it('creates a revised quotation from an existing one', async () => {
      const dto = { conversationId: 'c1', totalAmount: 60000 };
      const revised = { id: 'q2', parentId: 'q1', revisionNumber: 2 };
      mockQuotationsService.revise.mockResolvedValue(revised);

      const result = await controller.revise('q1', 'provider-1', dto as any);

      expect(mockQuotationsService.revise).toHaveBeenCalledWith('q1', 'provider-1', dto);
      expect(result).toEqual(revised);
    });
  });

  describe('respond', () => {
    it('accepts a quotation', async () => {
      const dto = { action: 'ACCEPTED' };
      const updated = { id: 'q1', status: 'ACCEPTED' };
      mockQuotationsService.respond.mockResolvedValue(updated);

      const result = await controller.respond('q1', 'customer-1', dto as any);

      expect(mockQuotationsService.respond).toHaveBeenCalledWith('q1', 'customer-1', dto);
      expect(result).toEqual(updated);
    });

    it('rejects a quotation', async () => {
      const dto = { action: 'REJECTED', reason: 'Too expensive' };
      mockQuotationsService.respond.mockResolvedValue({ id: 'q1', status: 'REJECTED' });

      await controller.respond('q1', 'customer-1', dto as any);

      expect(mockQuotationsService.respond).toHaveBeenCalledWith('q1', 'customer-1', dto);
    });

    it('opens negotiation on a quotation', async () => {
      const dto = { action: 'NEGOTIATING', message: 'Can you lower the price?' };
      mockQuotationsService.respond.mockResolvedValue({ id: 'q1', status: 'NEGOTIATING' });

      await controller.respond('q1', 'customer-1', dto as any);

      expect(mockQuotationsService.respond).toHaveBeenCalledWith('q1', 'customer-1', dto);
    });
  });

  describe('getByConversation', () => {
    it('returns all quotations for a conversation', async () => {
      const quotations = [{ id: 'q1' }, { id: 'q2' }];
      mockQuotationsService.getConversationQuotations.mockResolvedValue(quotations);

      const result = await controller.getByConversation('c1', 'u1');

      expect(mockQuotationsService.getConversationQuotations).toHaveBeenCalledWith('c1', 'u1');
      expect(result).toEqual(quotations);
    });
  });

  describe('getMine', () => {
    it('returns paginated quotations for the current user', async () => {
      const page = { data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0, hasNextPage: false, hasPrevPage: false } };
      mockQuotationsService.getMyQuotations.mockResolvedValue(page);

      const result = await controller.getMine('u1', 'customer', 1, 10);

      expect(mockQuotationsService.getMyQuotations).toHaveBeenCalledWith('u1', 'customer', 1, 10);
      expect(result).toEqual(page);
    });

    it('defaults role to customer when not provided', async () => {
      mockQuotationsService.getMyQuotations.mockResolvedValue({ data: [], meta: {} });

      await controller.getMine('u1', undefined as any, 1, 10);

      expect(mockQuotationsService.getMyQuotations).toHaveBeenCalledWith('u1', 'customer', 1, 10);
    });
  });
});
