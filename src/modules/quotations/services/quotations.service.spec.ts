import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PaymentType, QuotationItemType, QuotationStatus } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QuotationsService } from './quotations.service';
import { QuotationsRepository } from '../repositories/quotations.repository';
import { PrismaService } from '../../../core/prisma/prisma.service';

const PROVIDER_ID = 'provider-uuid-1';
const CUSTOMER_ID = 'customer-uuid-1';
const CONVO_ID    = 'convo-uuid-1';
const SERVICE_ID  = 'service-uuid-1';
const QUOTE_ID    = 'quote-uuid-1';

const mockQuotation = {
  id:                QUOTE_ID,
  conversationId:    CONVO_ID,
  serviceId:         SERVICE_ID,
  providerId:        PROVIDER_ID,
  customerId:        CUSTOMER_ID,
  status:            QuotationStatus.PENDING,
  labourCost:        5000,
  materialCost:      2000,
  transportationCost: 500,
  additionalCharges: 0,
  taxRate:           0,
  totalAmount:       7500,
  paymentType:       PaymentType.LABOUR_ONLY,
  revisionNumber:    0,
  validUntil:        null,
  description:       'Fix leaking pipe',
  notes:             null,
  parentId:          null,
  acceptedAt:        null,
  rejectedAt:        null,
  rejectionReason:   null,
  createdAt:         new Date(),
  updatedAt:         new Date(),
};

describe('QuotationsService', () => {
  let service: QuotationsService;
  let repo: any;
  let prisma: any;
  let eventEmitter: any;

  beforeEach(async () => {
    repo = {
      findById:          jest.fn(),
      findByConversation: jest.fn(),
      findByUser:        jest.fn(),
      create:            jest.fn(),
      update:            jest.fn(),
    };

    prisma = {
      conversationParticipant: {
        findUnique: jest.fn(),
      },
      quotation: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      booking: {
        findFirst: jest.fn(),
      },
      serviceListing: {
        findUnique: jest.fn(),
      },
      userProfile: {
        findUnique: jest.fn().mockResolvedValue({ displayName: 'Emeka Plumber' }),
      },
    };

    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotationsService,
        { provide: QuotationsRepository, useValue: repo },
        { provide: PrismaService,        useValue: prisma },
        { provide: EventEmitter2,        useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<QuotationsService>(QuotationsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    beforeEach(() => {
      prisma.conversationParticipant.findUnique.mockResolvedValue({ id: 'p-1' });
    });

    it('creates quotation with flat cost fields', async () => {
      repo.create.mockResolvedValue(mockQuotation);

      const result = await service.create(PROVIDER_ID, {
        conversationId:    CONVO_ID,
        serviceId:         SERVICE_ID,
        customerId:        CUSTOMER_ID,
        labourCost:        5000,
        materialCost:      2000,
        transportationCost: 500,
        taxRate:           0,
        description:       'Fix pipe',
      });

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
        providerId:    PROVIDER_ID,
        customerId:    CUSTOMER_ID,
        status:        QuotationStatus.PENDING,
        totalAmount:   7500,
      }));
      expect(result).toEqual(mockQuotation);
    });

    it('computes costs from line items', async () => {
      repo.create.mockResolvedValue(mockQuotation);
      await service.create(PROVIDER_ID, {
        conversationId: CONVO_ID,
        serviceId:      SERVICE_ID,
        customerId:     CUSTOMER_ID,
        description:    'Fix pipe',
        items: [
          { type: QuotationItemType.LABOUR,   name: 'Labour', quantity: 2, unitPrice: 2500 },
          { type: QuotationItemType.MATERIAL, name: 'Parts',  quantity: 1, unitPrice: 2000 },
        ],
      });

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
        labourCost:   5000,
        materialCost: 2000,
        totalAmount:  7000,
      }));
    });

    it('applies tax when taxRate is provided', async () => {
      repo.create.mockResolvedValue(mockQuotation);
      await service.create(PROVIDER_ID, {
        conversationId: CONVO_ID,
        serviceId:      SERVICE_ID,
        customerId:     CUSTOMER_ID,
        labourCost:     10000,
        taxRate:        7.5,
        description:    'Electrical work',
      });

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
        taxRate:     7.5,
        totalAmount: 10750,
      }));
    });

    it('emits NEW_QUOTE notification to customer', async () => {
      repo.create.mockResolvedValue(mockQuotation);
      await service.create(PROVIDER_ID, {
        conversationId: CONVO_ID,
        serviceId:      SERVICE_ID,
        customerId:     CUSTOMER_ID,
        labourCost:     5000,
        description:    'Test',
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith('notification.send', expect.objectContaining({
        userId: CUSTOMER_ID,
        type:   'NEW_QUOTE',
      }));
    });

    it('throws ForbiddenException when provider not a participant', async () => {
      prisma.conversationParticipant.findUnique.mockResolvedValue(null);
      await expect(service.create(PROVIDER_ID, {
        conversationId: CONVO_ID,
        serviceId:      SERVICE_ID,
        customerId:     CUSTOMER_ID,
        description:    'Test',
      })).rejects.toThrow(ForbiddenException);
    });
  });

  // ── revise ────────────────────────────────────────────────────────────────

  describe('revise', () => {
    it('creates a revised quotation with incremented revisionNumber', async () => {
      repo.findById.mockResolvedValue(mockQuotation);
      prisma.booking.findFirst.mockResolvedValue(null);
      repo.update.mockResolvedValue({ ...mockQuotation, status: QuotationStatus.NEGOTIATING });
      const revised = { ...mockQuotation, id: 'quote-v2', revisionNumber: 1 };
      repo.create.mockResolvedValue(revised);

      const result = await service.revise(QUOTE_ID, PROVIDER_ID, {
        conversationId: CONVO_ID,
        serviceId:      SERVICE_ID,
        customerId:     CUSTOMER_ID,
        labourCost:     6000,
        description:    'Revised quote',
      });

      expect(result.revisionNumber).toBe(1);
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
        parentId:       QUOTE_ID,
        revisionNumber: 1,
      }));
    });

    it('emits QUOTE_UPDATED notification', async () => {
      repo.findById.mockResolvedValue(mockQuotation);
      prisma.booking.findFirst.mockResolvedValue(null);
      repo.update.mockResolvedValue(mockQuotation);
      repo.create.mockResolvedValue({ ...mockQuotation, revisionNumber: 1 });

      await service.revise(QUOTE_ID, PROVIDER_ID, {
        conversationId: CONVO_ID,
        serviceId:      SERVICE_ID,
        customerId:     CUSTOMER_ID,
        description:    'Updated',
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith('notification.send', expect.objectContaining({
        userId: CUSTOMER_ID, type: 'QUOTE_UPDATED',
      }));
    });

    it('throws ForbiddenException when another provider tries to revise', async () => {
      repo.findById.mockResolvedValue({ ...mockQuotation, providerId: 'other-provider' });
      await expect(service.revise(QUOTE_ID, PROVIDER_ID, {
        conversationId: CONVO_ID, serviceId: SERVICE_ID, customerId: CUSTOMER_ID, description: 'X',
      })).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when quotation is EXPIRED', async () => {
      repo.findById.mockResolvedValue({ ...mockQuotation, status: QuotationStatus.EXPIRED });
      await expect(service.revise(QUOTE_ID, PROVIDER_ID, {
        conversationId: CONVO_ID, serviceId: SERVICE_ID, customerId: CUSTOMER_ID, description: 'X',
      })).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when quotation is locked by a booking', async () => {
      repo.findById.mockResolvedValue(mockQuotation);
      prisma.booking.findFirst.mockResolvedValue({ id: 'booking-1', status: 'CONFIRMED' });

      await expect(service.revise(QUOTE_ID, PROVIDER_ID, {
        conversationId: CONVO_ID, serviceId: SERVICE_ID, customerId: CUSTOMER_ID, description: 'X',
      })).rejects.toThrow(BadRequestException);
    });
  });

  // ── respond ───────────────────────────────────────────────────────────────

  describe('respond', () => {
    it('customer accepts quotation', async () => {
      repo.findById.mockResolvedValue(mockQuotation);
      const accepted = { ...mockQuotation, status: QuotationStatus.ACCEPTED, acceptedAt: new Date() };
      repo.update.mockResolvedValue(accepted);

      const result = await service.respond(QUOTE_ID, CUSTOMER_ID, { action: 'ACCEPTED' });
      expect(result.status).toBe(QuotationStatus.ACCEPTED);
    });

    it('emits QUOTE_ACCEPTED to provider on acceptance', async () => {
      repo.findById.mockResolvedValue(mockQuotation);
      repo.update.mockResolvedValue({ ...mockQuotation, status: QuotationStatus.ACCEPTED });

      await service.respond(QUOTE_ID, CUSTOMER_ID, { action: 'ACCEPTED' });
      expect(eventEmitter.emit).toHaveBeenCalledWith('notification.send', expect.objectContaining({
        userId: PROVIDER_ID, type: 'QUOTE_ACCEPTED',
      }));
    });

    it('customer rejects quotation with reason', async () => {
      repo.findById.mockResolvedValue(mockQuotation);
      repo.update.mockResolvedValue({ ...mockQuotation, status: QuotationStatus.REJECTED });

      const result = await service.respond(QUOTE_ID, CUSTOMER_ID, {
        action: 'REJECTED', rejectionReason: 'Too expensive',
      });
      expect(result.status).toBe(QuotationStatus.REJECTED);
    });

    it('throws BadRequestException when rejection has no reason', async () => {
      repo.findById.mockResolvedValue(mockQuotation);
      await expect(service.respond(QUOTE_ID, CUSTOMER_ID, { action: 'REJECTED' }))
        .rejects.toThrow(BadRequestException);
    });

    it('customer requests changes → sets NEGOTIATING', async () => {
      repo.findById.mockResolvedValue(mockQuotation);
      repo.update.mockResolvedValue({ ...mockQuotation, status: QuotationStatus.NEGOTIATING });

      const result = await service.respond(QUOTE_ID, CUSTOMER_ID, { action: 'NEGOTIATING' });
      expect(result.status).toBe(QuotationStatus.NEGOTIATING);
    });

    it('throws ForbiddenException when non-customer responds', async () => {
      repo.findById.mockResolvedValue(mockQuotation);
      await expect(service.respond(QUOTE_ID, 'someone-else', { action: 'ACCEPTED' }))
        .rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when quotation is not respondable', async () => {
      repo.findById.mockResolvedValue({ ...mockQuotation, status: QuotationStatus.ACCEPTED });
      await expect(service.respond(QUOTE_ID, CUSTOMER_ID, { action: 'ACCEPTED' }))
        .rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when quotation has expired', async () => {
      repo.findById.mockResolvedValue({
        ...mockQuotation, validUntil: new Date(Date.now() - 86400000),
      });
      await expect(service.respond(QUOTE_ID, CUSTOMER_ID, { action: 'ACCEPTED' }))
        .rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when quotation does not exist', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.respond('bad-id', CUSTOMER_ID, { action: 'ACCEPTED' }))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ── getConversationQuotations ─────────────────────────────────────────────

  describe('getConversationQuotations', () => {
    it('returns quotations for a participant', async () => {
      prisma.conversationParticipant.findUnique.mockResolvedValue({ id: 'p-1' });
      repo.findByConversation.mockResolvedValue([mockQuotation]);

      const result = await service.getConversationQuotations(CONVO_ID, CUSTOMER_ID);
      expect(result).toHaveLength(1);
    });

    it('throws ForbiddenException for non-participant', async () => {
      prisma.conversationParticipant.findUnique.mockResolvedValue(null);
      await expect(service.getConversationQuotations(CONVO_ID, 'outsider'))
        .rejects.toThrow(ForbiddenException);
    });
  });
});
