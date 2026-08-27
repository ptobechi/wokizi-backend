import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { ServiceRequestsService } from './service-requests.service';
import { ServiceRequestsRepository } from '../repositories/service-requests.repository';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { ConversationsService } from '../../conversations/services/conversations.service';

const CUSTOMER_ID  = 'customer-uuid-1';
const PROVIDER_ID  = 'provider-uuid-1';
const REQUEST_ID   = 'request-uuid-1';
const CONVO_ID     = 'convo-uuid-1';

function mockPendingRequest(overrides: Record<string, any> = {}) {
  return {
    id:             REQUEST_ID,
    customerId:     CUSTOMER_ID,
    providerId:     PROVIDER_ID,
    conversationId: CONVO_ID,
    status:         'PENDING',
    basePrice:      5000,
    adjustedPrice:  null,
    expiresAt:      new Date(Date.now() + 60_000), // not yet expired
    ...overrides,
  };
}

describe('ServiceRequestsService', () => {
  let service: ServiceRequestsService;
  let repo: any;
  let prisma: any;
  let eventEmitter: any;
  let conversationsService: any;
  let config: any;
  let tx: any;

  beforeEach(async () => {
    repo = {
      findById:                jest.fn(),
      findActiveByConversation: jest.fn(),
      create:                  jest.fn(),
    };

    // The transactional client shares the same shape as the top-level
    // PrismaService for the models this service touches inside $transaction.
    tx = {
      serviceRequest: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      serviceRequestPriceHistory: {
        create: jest.fn(),
      },
    };

    prisma = {
      $transaction: jest.fn((fn: any) => fn(tx)),
      serviceRequest: {
        findMany:   jest.fn(),
        updateMany: jest.fn(),
      },
      serviceListing: {
        findUnique: jest.fn(),
      },
      userProfile: {
        findUnique: jest.fn().mockResolvedValue({ displayName: 'Chidi' }),
      },
    };

    eventEmitter = { emit: jest.fn() };
    conversationsService = { create: jest.fn() };
    config = { get: jest.fn().mockReturnValue(300) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceRequestsService,
        { provide: ServiceRequestsRepository, useValue: repo },
        { provide: PrismaService,             useValue: prisma },
        { provide: ConversationsService,      useValue: conversationsService },
        { provide: EventEmitter2,             useValue: eventEmitter },
        { provide: ConfigService,             useValue: config },
      ],
    }).compile();

    service = module.get<ServiceRequestsService>(ServiceRequestsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    const SERVICE_ID = 'service-uuid-1';

    beforeEach(() => {
      prisma.serviceListing.findUnique.mockResolvedValue({
        id: SERVICE_ID, providerId: PROVIDER_ID, title: 'Barbering', startingPrice: 5000, isPublished: true,
      });
      conversationsService.create.mockResolvedValue({ id: CONVO_ID });
      repo.findActiveByConversation.mockResolvedValue(null);
      repo.create.mockImplementation((data: any) => Promise.resolve({ id: REQUEST_ID, ...data }));
    });

    it('sets expiresAt from the configured response timeout, not a hardcoded window', async () => {
      config.get.mockReturnValue(30); // e.g. the short dev override
      const before = Date.now();

      const result = await service.create(CUSTOMER_ID, {
        serviceId: SERVICE_ID, description: 'Fade', address: 'Lekki', latitude: 6.4, longitude: 3.4,
      });

      expect(config.get).toHaveBeenCalledWith('app.serviceRequestResponseTimeoutSeconds', 300);
      const expiresAt = new Date(result.expiresAt).getTime();
      // Within a couple seconds of now + 30s — proves it's driven by the
      // configured value rather than a hardcoded 24-hour window.
      expect(expiresAt).toBeGreaterThanOrEqual(before + 29_000);
      expect(expiresAt).toBeLessThanOrEqual(before + 32_000);
    });

    it('derives basePrice from the service, never the client', async () => {
      await service.create(CUSTOMER_ID, {
        serviceId: SERVICE_ID, description: 'Fade', address: 'Lekki', latitude: 6.4, longitude: 3.4,
        // @ts-expect-error — a client-supplied price must be ignored even if sent
        basePrice: 1,
      });
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ basePrice: 5000 }));
    });
  });

  // ── accept ────────────────────────────────────────────────────────────────

  describe('accept', () => {
    it('accepts at the base price with no price history written', async () => {
      const existing = mockPendingRequest();
      tx.serviceRequest.findUnique
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({ ...existing, status: 'ACCEPTED' });
      tx.serviceRequest.updateMany.mockResolvedValue({ count: 1 });
      repo.findById.mockResolvedValue({ ...existing, status: 'ACCEPTED' });

      await service.accept(REQUEST_ID, PROVIDER_ID);

      expect(tx.serviceRequest.updateMany).toHaveBeenCalledWith({
        where: { id: REQUEST_ID, status: 'PENDING' },
        data:  expect.objectContaining({ status: 'ACCEPTED', adjustedPrice: null }),
      });
      expect(tx.serviceRequestPriceHistory.create).not.toHaveBeenCalled();
    });

    it('moves to PRICE_UPDATED and writes price history when the price changes', async () => {
      const existing = mockPendingRequest();
      tx.serviceRequest.findUnique
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({ ...existing, status: 'PRICE_UPDATED', adjustedPrice: 7500 });
      tx.serviceRequest.updateMany.mockResolvedValue({ count: 1 });
      repo.findById.mockResolvedValue({ ...existing, status: 'PRICE_UPDATED' });

      await service.accept(REQUEST_ID, PROVIDER_ID, { price: 7500, reason: 'Extra materials' });

      expect(tx.serviceRequest.updateMany).toHaveBeenCalledWith({
        where: { id: REQUEST_ID, status: 'PENDING' },
        data:  expect.objectContaining({ status: 'PRICE_UPDATED', adjustedPrice: 7500, priceReason: 'Extra materials' }),
      });
      expect(tx.serviceRequestPriceHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          serviceRequestId: REQUEST_ID, previousPrice: 5000, newPrice: 7500, changedBy: PROVIDER_ID,
        }),
      });
    });

    it('rejects acceptance past the server-side deadline', async () => {
      tx.serviceRequest.findUnique.mockResolvedValueOnce(
        mockPendingRequest({ expiresAt: new Date(Date.now() - 1000) }),
      );
      await expect(service.accept(REQUEST_ID, PROVIDER_ID)).rejects.toThrow(BadRequestException);
      expect(tx.serviceRequest.updateMany).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when request does not exist', async () => {
      tx.serviceRequest.findUnique.mockResolvedValueOnce(null);
      await expect(service.accept(REQUEST_ID, PROVIDER_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when a different provider tries to accept', async () => {
      tx.serviceRequest.findUnique.mockResolvedValueOnce(mockPendingRequest({ providerId: 'someone-else' }));
      await expect(service.accept(REQUEST_ID, PROVIDER_ID)).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException on a double-accept race (compare-and-swap miss)', async () => {
      tx.serviceRequest.findUnique.mockResolvedValueOnce(mockPendingRequest());
      tx.serviceRequest.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.accept(REQUEST_ID, PROVIDER_ID)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for a zero/negative adjusted price', async () => {
      tx.serviceRequest.findUnique.mockResolvedValueOnce(mockPendingRequest());
      await expect(service.accept(REQUEST_ID, PROVIDER_ID, { price: 0 })).rejects.toThrow(BadRequestException);
    });
  });

  // ── decline ───────────────────────────────────────────────────────────────

  describe('decline', () => {
    it('declines a pending request', async () => {
      const existing = mockPendingRequest();
      tx.serviceRequest.findUnique
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({ ...existing, status: 'DECLINED' });
      tx.serviceRequest.updateMany.mockResolvedValue({ count: 1 });
      repo.findById.mockResolvedValue({ ...existing, status: 'DECLINED' });

      await service.decline(REQUEST_ID, PROVIDER_ID, { reason: 'Too far' });
      expect(tx.serviceRequest.updateMany).toHaveBeenCalledWith({
        where: { id: REQUEST_ID, status: 'PENDING' },
        data:  expect.objectContaining({ status: 'DECLINED', declineReason: 'Too far' }),
      });
    });

    it('rejects decline past the server-side deadline', async () => {
      tx.serviceRequest.findUnique.mockResolvedValueOnce(
        mockPendingRequest({ expiresAt: new Date(Date.now() - 1000) }),
      );
      await expect(service.decline(REQUEST_ID, PROVIDER_ID, {})).rejects.toThrow(BadRequestException);
    });
  });

  // ── confirmPrice / declinePrice ──────────────────────────────────────────

  describe('confirmPrice', () => {
    it('customer confirms a PRICE_UPDATED request and it becomes ACCEPTED', async () => {
      const existing = mockPendingRequest({ status: 'PRICE_UPDATED', adjustedPrice: 7500 });
      tx.serviceRequest.findUnique
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({ ...existing, status: 'ACCEPTED' });
      tx.serviceRequest.updateMany.mockResolvedValue({ count: 1 });
      repo.findById.mockResolvedValue({ ...existing, status: 'ACCEPTED' });

      await service.confirmPrice(REQUEST_ID, CUSTOMER_ID);
      expect(tx.serviceRequest.updateMany).toHaveBeenCalledWith({
        where: { id: REQUEST_ID, status: 'PRICE_UPDATED' },
        data:  { status: 'ACCEPTED' },
      });
    });

    it('throws ForbiddenException when a different customer tries to confirm', async () => {
      tx.serviceRequest.findUnique.mockResolvedValueOnce(
        mockPendingRequest({ status: 'PRICE_UPDATED', customerId: 'someone-else' }),
      );
      await expect(service.confirmPrice(REQUEST_ID, CUSTOMER_ID)).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when there is no price update to confirm', async () => {
      tx.serviceRequest.findUnique.mockResolvedValueOnce(mockPendingRequest({ status: 'PENDING' }));
      tx.serviceRequest.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.confirmPrice(REQUEST_ID, CUSTOMER_ID)).rejects.toThrow(BadRequestException);
    });
  });

  describe('declinePrice', () => {
    it('customer declines a PRICE_UPDATED request and it becomes DECLINED', async () => {
      const existing = mockPendingRequest({ status: 'PRICE_UPDATED', adjustedPrice: 7500 });
      tx.serviceRequest.findUnique
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({ ...existing, status: 'DECLINED' });
      tx.serviceRequest.updateMany.mockResolvedValue({ count: 1 });
      repo.findById.mockResolvedValue({ ...existing, status: 'DECLINED' });

      await service.declinePrice(REQUEST_ID, CUSTOMER_ID, 'Too expensive');
      expect(tx.serviceRequest.updateMany).toHaveBeenCalledWith({
        where: { id: REQUEST_ID, status: 'PRICE_UPDATED' },
        data:  expect.objectContaining({ status: 'DECLINED', declineReason: 'Too expensive' }),
      });
    });
  });

  // ── cancel ────────────────────────────────────────────────────────────────

  describe('cancel', () => {
    it('customer cancels their own pending request', async () => {
      prisma.serviceRequest.updateMany.mockResolvedValue({ count: 1 });
      repo.findById.mockResolvedValue(mockPendingRequest({ status: 'CANCELLED' }));

      await service.cancel(REQUEST_ID, CUSTOMER_ID);
      expect(prisma.serviceRequest.updateMany).toHaveBeenCalledWith({
        where: { id: REQUEST_ID, customerId: CUSTOMER_ID, status: 'PENDING' },
        data:  expect.objectContaining({ status: 'CANCELLED' }),
      });
    });

    it('throws ForbiddenException when cancelling someone else\'s request', async () => {
      prisma.serviceRequest.updateMany.mockResolvedValue({ count: 0 });
      prisma.serviceRequest.findUnique = jest.fn().mockResolvedValue(mockPendingRequest({ customerId: 'someone-else' }));
      await expect(service.cancel(REQUEST_ID, CUSTOMER_ID)).rejects.toThrow(ForbiddenException);
    });
  });
});
