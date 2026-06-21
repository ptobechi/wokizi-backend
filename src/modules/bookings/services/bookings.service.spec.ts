import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException, ForbiddenException, NotFoundException,
} from '@nestjs/common';
import { BookingStatus, PaymentType, QuotationStatus } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BookingsService } from './bookings.service';
import { BookingsRepository } from '../repositories/bookings.repository';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { InvalidStateException } from '../../../common/exceptions/business.exception';

const CUSTOMER_ID = 'customer-uuid-1';
const PROVIDER_ID = 'provider-uuid-1';
const SERVICE_ID  = 'service-uuid-1';
const BOOKING_ID  = 'booking-uuid-1';
const QUOTE_ID    = 'quotation-uuid-1';
const CONVO_ID    = 'convo-uuid-1';

const mockQuotation = {
  id:          QUOTE_ID,
  customerId:  CUSTOMER_ID,
  providerId:  PROVIDER_ID,
  serviceId:   SERVICE_ID,
  status:      QuotationStatus.ACCEPTED,
  paymentType: PaymentType.LABOUR_ONLY,
  service:     { title: 'Plumbing Fix' },
  conversationId: CONVO_ID,
};

const mockBooking = {
  id:          BOOKING_ID,
  customerId:  CUSTOMER_ID,
  providerId:  PROVIDER_ID,
  serviceId:   SERVICE_ID,
  quotationId: QUOTE_ID,
  status:      BookingStatus.CONFIRMED,
  scheduledAt: null,
  completedAt: null,
  cancelledAt: null,
  startedAt:   null,
  cancelReason: null,
  createdAt:   new Date(),
  updatedAt:   new Date(),
};

describe('BookingsService', () => {
  let service: BookingsService;
  let repo: any;
  let prisma: any;
  let eventEmitter: any;

  beforeEach(async () => {
    repo = {
      findById:          jest.fn(),
      findByQuotationId: jest.fn(),
      create:            jest.fn(),
      update:            jest.fn(),
      findAllByUser:     jest.fn(),
      countByUser:       jest.fn(),
    };

    prisma = {
      quotation: {
        findUnique: jest.fn(),
        update:     jest.fn(),
      },
      escrowReservation: {
        findFirst:  jest.fn(),
        findUnique: jest.fn(),
      },
      availability: {
        findUnique: jest.fn(),
      },
      conversation: {
        update: jest.fn(),
      },
      message: {
        create: jest.fn(),
      },
    };

    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: BookingsRepository, useValue: repo },
        { provide: PrismaService,      useValue: prisma },
        { provide: EventEmitter2,      useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a CONFIRMED booking from an ACCEPTED quotation', async () => {
      prisma.quotation.findUnique.mockResolvedValue(mockQuotation);
      repo.findByQuotationId.mockResolvedValue(null);
      prisma.availability.findUnique.mockResolvedValue(null);
      repo.create.mockResolvedValue(mockBooking);

      const result = await service.create(CUSTOMER_ID, { quotationId: QUOTE_ID });
      expect(result.status).toBe(BookingStatus.CONFIRMED);
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
        status:     BookingStatus.CONFIRMED,
        customerId: CUSTOMER_ID,
        providerId: PROVIDER_ID,
      }));
    });

    it('emits BOOKING_CONFIRMED notification to provider', async () => {
      prisma.quotation.findUnique.mockResolvedValue(mockQuotation);
      repo.findByQuotationId.mockResolvedValue(null);
      repo.create.mockResolvedValue(mockBooking);

      await service.create(CUSTOMER_ID, { quotationId: QUOTE_ID });
      expect(eventEmitter.emit).toHaveBeenCalledWith('notification.send', expect.objectContaining({
        userId: PROVIDER_ID, type: 'BOOKING_CONFIRMED',
      }));
    });

    it('throws NotFoundException when quotation not found', async () => {
      prisma.quotation.findUnique.mockResolvedValue(null);
      await expect(service.create(CUSTOMER_ID, { quotationId: 'bad-id' }))
        .rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when quotation belongs to another user', async () => {
      prisma.quotation.findUnique.mockResolvedValue({ ...mockQuotation, customerId: 'other-user' });
      await expect(service.create(CUSTOMER_ID, { quotationId: QUOTE_ID }))
        .rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when quotation is not ACCEPTED', async () => {
      prisma.quotation.findUnique.mockResolvedValue({ ...mockQuotation, status: QuotationStatus.PENDING });
      await expect(service.create(CUSTOMER_ID, { quotationId: QUOTE_ID }))
        .rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when booking already exists for quotation', async () => {
      prisma.quotation.findUnique.mockResolvedValue(mockQuotation);
      repo.findByQuotationId.mockResolvedValue(mockBooking);
      await expect(service.create(CUSTOMER_ID, { quotationId: QUOTE_ID }))
        .rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when MATERIALS_REQUIRED and no escrow', async () => {
      prisma.quotation.findUnique.mockResolvedValue({
        ...mockQuotation, paymentType: PaymentType.MATERIALS_REQUIRED,
      });
      repo.findByQuotationId.mockResolvedValue(null);
      prisma.escrowReservation.findFirst.mockResolvedValue(null);

      await expect(service.create(CUSTOMER_ID, { quotationId: QUOTE_ID }))
        .rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when FULL_PROJECT and no escrow', async () => {
      prisma.quotation.findUnique.mockResolvedValue({
        ...mockQuotation, paymentType: PaymentType.FULL_PROJECT,
      });
      repo.findByQuotationId.mockResolvedValue(null);
      prisma.escrowReservation.findFirst.mockResolvedValue(null);

      await expect(service.create(CUSTOMER_ID, { quotationId: QUOTE_ID }))
        .rejects.toThrow(BadRequestException);
    });

    it('allows MATERIALS_REQUIRED booking when escrow exists', async () => {
      prisma.quotation.findUnique.mockResolvedValue({
        ...mockQuotation, paymentType: PaymentType.MATERIALS_REQUIRED,
      });
      repo.findByQuotationId.mockResolvedValue(null);
      prisma.escrowReservation.findFirst.mockResolvedValue({ id: 'escrow-1', status: 'COMPLETED' });
      repo.create.mockResolvedValue(mockBooking);

      const result = await service.create(CUSTOMER_ID, { quotationId: QUOTE_ID });
      expect(result).toEqual(mockBooking);
    });

    it('blocks booking when provider is on vacation', async () => {
      prisma.quotation.findUnique.mockResolvedValue(mockQuotation);
      repo.findByQuotationId.mockResolvedValue(null);
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      prisma.availability.findUnique.mockResolvedValue({
        isVacationMode: true,
        vacationStart: new Date(Date.now() - 86400000),
        vacationEnd:   new Date(Date.now() + 86400000 * 7),
        slots:    [],
        holidays: [],
      });

      await expect(service.create(CUSTOMER_ID, { quotationId: QUOTE_ID, scheduledAt: futureDate }))
        .rejects.toThrow(BadRequestException);
    });

    it('blocks booking when provider unavailable on that day', async () => {
      prisma.quotation.findUnique.mockResolvedValue(mockQuotation);
      repo.findByQuotationId.mockResolvedValue(null);
      const saturday = '2026-06-20T10:00:00.000Z'; // Saturday = dayOfWeek 6
      prisma.availability.findUnique.mockResolvedValue({
        isVacationMode: false,
        slots:    [{ dayOfWeek: 1, isAvailable: true, startTime: '09:00', endTime: '17:00' }],
        holidays: [],
      });

      await expect(service.create(CUSTOMER_ID, { quotationId: QUOTE_ID, scheduledAt: saturday }))
        .rejects.toThrow(BadRequestException);
    });
  });

  // ── updateStatus ──────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('provider transitions CONFIRMED → IN_PROGRESS', async () => {
      repo.findById.mockResolvedValue({ ...mockBooking, status: 'CONFIRMED' });
      const updated = { ...mockBooking, status: BookingStatus.IN_PROGRESS };
      repo.update.mockResolvedValue(updated);
      prisma.quotation.findUnique.mockResolvedValue({ conversationId: null });

      const result = await service.updateStatus(BOOKING_ID, PROVIDER_ID, { status: 'IN_PROGRESS', notes: '' });
      expect(result.status).toBe(BookingStatus.IN_PROGRESS);
    });

    it('provider transitions IN_PROGRESS → COMPLETED and emits escrow release', async () => {
      repo.findById.mockResolvedValue({ ...mockBooking, status: 'IN_PROGRESS' });
      const updated = { ...mockBooking, status: BookingStatus.COMPLETED };
      repo.update.mockResolvedValue(updated);
      prisma.quotation.findUnique.mockResolvedValue({ conversationId: CONVO_ID });
      prisma.conversation.update.mockResolvedValue({});
      prisma.message.create.mockResolvedValue({ id: 'msg-1' });

      await service.updateStatus(BOOKING_ID, PROVIDER_ID, { status: 'COMPLETED' });
      expect(eventEmitter.emit).toHaveBeenCalledWith('escrow.released', expect.any(Object));
    });

    it('archives conversation on COMPLETED', async () => {
      repo.findById.mockResolvedValue({ ...mockBooking, status: 'IN_PROGRESS' });
      repo.update.mockResolvedValue({ ...mockBooking, status: 'COMPLETED' });
      prisma.quotation.findUnique.mockResolvedValue({ conversationId: CONVO_ID });
      prisma.conversation.update.mockResolvedValue({});
      prisma.message.create.mockResolvedValue({ id: 'msg-1' });

      await service.updateStatus(BOOKING_ID, PROVIDER_ID, { status: 'COMPLETED' });
      expect(prisma.conversation.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: CONVO_ID },
        data:  expect.objectContaining({ isArchived: true, closedReason: 'COMPLETED' }),
      }));
    });

    it('archives conversation on CANCELLED', async () => {
      repo.findById.mockResolvedValue({ ...mockBooking, status: 'CONFIRMED' });
      repo.update.mockResolvedValue({ ...mockBooking, status: 'CANCELLED' });
      prisma.quotation.findUnique.mockResolvedValue({ conversationId: CONVO_ID });
      prisma.conversation.update.mockResolvedValue({});
      prisma.message.create.mockResolvedValue({ id: 'msg-1' });

      await service.updateStatus(BOOKING_ID, CUSTOMER_ID, {
        status: 'CANCELLED', cancelReason: 'Change of plans',
      });
      expect(prisma.conversation.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: CONVO_ID },
        data:  expect.objectContaining({ isArchived: true, closedReason: 'CANCELLED' }),
      }));
    });

    it('emits escrow refund on CANCELLED', async () => {
      repo.findById.mockResolvedValue({ ...mockBooking, status: 'CONFIRMED' });
      repo.update.mockResolvedValue({ ...mockBooking, status: 'CANCELLED' });
      prisma.quotation.findUnique.mockResolvedValue({ conversationId: null });

      await service.updateStatus(BOOKING_ID, CUSTOMER_ID, {
        status: 'CANCELLED', cancelReason: 'Not needed',
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith('escrow.refunded', expect.any(Object));
    });

    it('throws NotFoundException when booking not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.updateStatus('bad', PROVIDER_ID, { status: 'IN_PROGRESS' }))
        .rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for unrelated user', async () => {
      repo.findById.mockResolvedValue(mockBooking);
      await expect(service.updateStatus(BOOKING_ID, 'stranger-id', { status: 'IN_PROGRESS' }))
        .rejects.toThrow(ForbiddenException);
    });

    it('throws InvalidStateException for disallowed transitions', async () => {
      repo.findById.mockResolvedValue({ ...mockBooking, status: 'COMPLETED' });
      await expect(service.updateStatus(BOOKING_ID, CUSTOMER_ID, { status: 'IN_PROGRESS' }))
        .rejects.toThrow(InvalidStateException);
    });

    it('throws ForbiddenException when customer tries to mark COMPLETED', async () => {
      repo.findById.mockResolvedValue({ ...mockBooking, status: 'IN_PROGRESS' });
      await expect(service.updateStatus(BOOKING_ID, CUSTOMER_ID, { status: 'COMPLETED' }))
        .rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when customer tries to start IN_PROGRESS', async () => {
      repo.findById.mockResolvedValue({ ...mockBooking, status: 'CONFIRMED' });
      await expect(service.updateStatus(BOOKING_ID, CUSTOMER_ID, { status: 'IN_PROGRESS' }))
        .rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when cancelling without a reason', async () => {
      repo.findById.mockResolvedValue({ ...mockBooking, status: 'CONFIRMED' });
      await expect(service.updateStatus(BOOKING_ID, CUSTOMER_ID, { status: 'CANCELLED' }))
        .rejects.toThrow(BadRequestException);
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns booking for customer', async () => {
      repo.findById.mockResolvedValue(mockBooking);
      const result = await service.findById(BOOKING_ID, CUSTOMER_ID);
      expect(result).toEqual(mockBooking);
    });

    it('returns booking for provider', async () => {
      repo.findById.mockResolvedValue(mockBooking);
      const result = await service.findById(BOOKING_ID, PROVIDER_ID);
      expect(result).toEqual(mockBooking);
    });

    it('throws NotFoundException when booking missing', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findById('bad', CUSTOMER_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for unrelated user', async () => {
      repo.findById.mockResolvedValue(mockBooking);
      await expect(service.findById(BOOKING_ID, 'stranger')).rejects.toThrow(ForbiddenException);
    });
  });

  // ── findMine ──────────────────────────────────────────────────────────────

  describe('findMine', () => {
    it('returns paginated bookings for customer role', async () => {
      repo.findAllByUser.mockResolvedValue([mockBooking]);
      repo.countByUser.mockResolvedValue(1);

      const result = await service.findMine(CUSTOMER_ID, 'customer');
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('returns paginated bookings for provider role', async () => {
      repo.findAllByUser.mockResolvedValue([mockBooking]);
      repo.countByUser.mockResolvedValue(1);

      const result = await service.findMine(PROVIDER_ID, 'provider');
      expect(result.data).toHaveLength(1);
    });
  });

  // ── checkAvailability ─────────────────────────────────────────────────────

  describe('checkAvailability', () => {
    it('returns available:true when no availability configured', async () => {
      prisma.availability.findUnique.mockResolvedValue(null);
      const result = await service.checkAvailability(SERVICE_ID, '2026-06-15T10:00:00Z');
      expect(result.available).toBe(true);
    });

    it('returns unavailable during vacation', async () => {
      prisma.availability.findUnique.mockResolvedValue({
        isVacationMode: true,
        vacationStart:  new Date('2026-06-01'),
        vacationEnd:    new Date('2026-06-30'),
        slots:    [],
        holidays: [],
      });
      const result = await service.checkAvailability(SERVICE_ID, '2026-06-15T10:00:00Z');
      expect(result.available).toBe(false);
      expect(result.reason).toContain('vacation');
    });

    it('returns unavailable on a holiday', async () => {
      const holidayDate = new Date('2026-06-15');
      prisma.availability.findUnique.mockResolvedValue({
        isVacationMode: false,
        vacationStart: null,
        vacationEnd:   null,
        slots:    [],
        holidays: [{ date: holidayDate, reason: 'Public Holiday' }],
      });
      const result = await service.checkAvailability(SERVICE_ID, '2026-06-15T10:00:00Z');
      expect(result.available).toBe(false);
    });

    it('returns available when slot matches day of week', async () => {
      const monday = '2026-06-15T10:00:00Z'; // Monday = dayOfWeek 1
      prisma.availability.findUnique.mockResolvedValue({
        isVacationMode: false,
        vacationStart: null,
        vacationEnd:   null,
        slots:    [{ dayOfWeek: 1, isAvailable: true, startTime: '09:00', endTime: '17:00' }],
        holidays: [],
      });
      const result = await service.checkAvailability(SERVICE_ID, monday);
      expect(result.available).toBe(true);
    });
  });
});
