import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { SupportController } from './support.controller';
import { SupportService } from '../services/support.service';

const mockSupportService = {
  createTicket: jest.fn(),
  getMyTickets: jest.fn(),
  getTicketById: jest.fn(),
  listAllTickets: jest.fn(),
  updateTicket: jest.fn(),
};

describe('SupportController', () => {
  let controller: SupportController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SupportController],
      providers: [{ provide: SupportService, useValue: mockSupportService }],
    }).compile();
    controller = module.get(SupportController);
  });

  describe('create', () => {
    it('creates a support ticket for the user', async () => {
      const dto = { category: 'PAYMENT', subject: 'Payment not credited', description: 'I paid but wallet not updated' };
      const ticket = { id: 't1', status: 'OPEN' };
      mockSupportService.createTicket.mockResolvedValue(ticket);

      const result = await controller.create('u1', dto as any);

      expect(mockSupportService.createTicket).toHaveBeenCalledWith('u1', dto);
      expect(result).toEqual(ticket);
    });
  });

  describe('getMyTickets', () => {
    it('returns paginated tickets for the current user', async () => {
      const page = {
        data: [{ id: 't1', status: 'OPEN' }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      };
      mockSupportService.getMyTickets.mockResolvedValue(page);

      const result = await controller.getMyTickets('u1', '1', '20');

      expect(mockSupportService.getMyTickets).toHaveBeenCalledWith('u1', 1, 20);
      expect(result).toEqual(page);
    });

    it('defaults to page 1, limit 20 when params are absent', async () => {
      mockSupportService.getMyTickets.mockResolvedValue({ data: [], meta: {} });

      await controller.getMyTickets('u1', undefined, undefined);

      expect(mockSupportService.getMyTickets).toHaveBeenCalledWith('u1', 1, 20);
    });
  });

  describe('getOne', () => {
    it('returns a ticket to its owner (non-admin path)', async () => {
      const ticket = { id: 't1', subject: 'Payment issue' };
      mockSupportService.getTicketById.mockResolvedValue(ticket);

      const result = await controller.getOne('t1', 'u1', UserRole.USER);

      expect(mockSupportService.getTicketById).toHaveBeenCalledWith('t1', 'u1', false);
      expect(result).toEqual(ticket);
    });

    it('passes isAdmin=true for admin role', async () => {
      mockSupportService.getTicketById.mockResolvedValue({ id: 't1' });

      await controller.getOne('t1', 'admin-1', UserRole.ADMIN);

      expect(mockSupportService.getTicketById).toHaveBeenCalledWith('t1', 'admin-1', true);
    });
  });

  describe('adminList', () => {
    it('returns all tickets for admin with optional status filter', async () => {
      const page = { data: [{ id: 't1', status: 'OPEN' }], meta: { total: 1 } };
      mockSupportService.listAllTickets.mockResolvedValue(page);

      const result = await controller.adminList('OPEN', '1', '20');

      expect(mockSupportService.listAllTickets).toHaveBeenCalledWith({ status: 'OPEN', page: 1, limit: 20 });
      expect(result).toEqual(page);
    });
  });

  describe('adminUpdate', () => {
    it('updates ticket status and notes', async () => {
      const dto = { status: 'RESOLVED', adminNote: 'Wallet credited manually' };
      const updated = { id: 't1', status: 'RESOLVED' };
      mockSupportService.updateTicket.mockResolvedValue(updated);

      const result = await controller.adminUpdate('t1', dto as any);

      expect(mockSupportService.updateTicket).toHaveBeenCalledWith('t1', dto);
      expect(result).toEqual(updated);
    });
  });
});
