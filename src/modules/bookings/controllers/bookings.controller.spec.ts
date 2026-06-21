import { Test, TestingModule } from '@nestjs/testing';
import { BookingsController } from './bookings.controller';
import { BookingsService } from '../services/bookings.service';

const mockBookingsService = {
  create: jest.fn(),
  findMine: jest.fn(),
  findById: jest.fn(),
  updateStatus: jest.fn(),
  checkAvailability: jest.fn(),
};

describe('BookingsController', () => {
  let controller: BookingsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [{ provide: BookingsService, useValue: mockBookingsService }],
    }).compile();
    controller = module.get(BookingsController);
  });

  describe('create', () => {
    it('creates a booking and returns it', async () => {
      const dto = { quotationId: 'q1', conversationId: 'c1' };
      const booking = { id: 'b1', status: 'CONFIRMED' };
      mockBookingsService.create.mockResolvedValue(booking);

      const result = await controller.create('u1', dto as any);

      expect(mockBookingsService.create).toHaveBeenCalledWith('u1', dto);
      expect(result).toEqual(booking);
    });
  });

  describe('findMine', () => {
    it('returns paginated bookings for a customer', async () => {
      const page = { data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0, hasNextPage: false, hasPrevPage: false } };
      mockBookingsService.findMine.mockResolvedValue(page);

      const result = await controller.findMine('u1', 'customer', undefined, 1, 10);

      expect(mockBookingsService.findMine).toHaveBeenCalledWith('u1', 'customer', undefined, 1, 10);
      expect(result).toEqual(page);
    });

    it('defaults role to customer when not provided', async () => {
      mockBookingsService.findMine.mockResolvedValue({ data: [], meta: {} });

      await controller.findMine('u1', undefined as any, undefined, 1, 10);

      expect(mockBookingsService.findMine).toHaveBeenCalledWith('u1', 'customer', undefined, 1, 10);
    });
  });

  describe('findOne', () => {
    it('returns a single booking by id', async () => {
      const booking = { id: 'b1', status: 'CONFIRMED' };
      mockBookingsService.findById.mockResolvedValue(booking);

      const result = await controller.findOne('b1', 'u1');

      expect(mockBookingsService.findById).toHaveBeenCalledWith('b1', 'u1');
      expect(result).toEqual(booking);
    });
  });

  describe('updateStatus', () => {
    it('updates booking status via service', async () => {
      const dto = { status: 'IN_PROGRESS' };
      const updated = { id: 'b1', status: 'IN_PROGRESS' };
      mockBookingsService.updateStatus.mockResolvedValue(updated);

      const result = await controller.updateStatus('b1', 'u1', dto as any);

      expect(mockBookingsService.updateStatus).toHaveBeenCalledWith('b1', 'u1', dto);
      expect(result).toEqual(updated);
    });
  });

  describe('checkAvailability', () => {
    it('checks provider availability for a date', async () => {
      const response = { available: true, slot: { startTime: '09:00', endTime: '17:00' } };
      mockBookingsService.checkAvailability.mockResolvedValue(response);

      const result = await controller.checkAvailability('s1', '2026-06-20');

      expect(mockBookingsService.checkAvailability).toHaveBeenCalledWith('s1', '2026-06-20');
      expect(result).toEqual(response);
    });
  });
});
