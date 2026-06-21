import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException, ForbiddenException, NotFoundException,
} from '@nestjs/common';
import { PaymentAuditEvent, PaymentStatus, PaymentType, TransactionType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { PaystackService } from '../../../integrations/paystack/paystack.service';
import { WalletService } from '../../wallet/services/wallet.service';

const USER_ID    = 'user-uuid-1';
const BOOKING_ID = 'booking-uuid-1';
const QUOTE_ID   = 'quotation-uuid-1';
const PAYMENT_ID = 'payment-uuid-1';
const REFERENCE  = 'fund-user-uuid-1-1234567890';

const mockPayment = {
  id:                  PAYMENT_ID,
  userId:              USER_ID,
  status:              PaymentStatus.PENDING,
  amount:              new Decimal(5000),
  currency:            'NGN',
  paystackReference:   REFERENCE,
  reference:           REFERENCE,
  paystackChannel:     null,
  providerName:        'paystack',
  failureReason:       null,
  metadata:            {},
  createdAt:           new Date(),
};

const mockWallet = {
  id:            'wallet-uuid-1',
  userId:        USER_ID,
  balance:       new Decimal(10000),
  heldBalance:   new Decimal(0),
  pendingBalance: new Decimal(0),
};

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: any;
  let paystack: any;
  let walletService: any;
  let eventEmitter: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: USER_ID, email: 'user@test.com', phone: '+2348012345678' }),
      },
      payment: {
        create:      jest.fn(),
        findUnique:  jest.fn(),
        update:      jest.fn(),
        findMany:    jest.fn(),
        count:       jest.fn(),
      },
      paymentAudit: {
        create: jest.fn().mockResolvedValue({}),
      },
      quotation: {
        findUnique: jest.fn(),
      },
      escrowReservation: {
        findUnique: jest.fn(),
        create:     jest.fn(),
        update:     jest.fn(),
      },
      walletTransaction: {
        create: jest.fn(),
      },
      withdrawal: {
        findFirst: jest.fn(),
        update:    jest.fn(),
      },
    };

    paystack = {
      initializePayment:         jest.fn(),
      verifyPayment:             jest.fn(),
      validateWebhookSignature:  jest.fn(),
    };

    walletService = {
      getWallet:          jest.fn(),
      getOrCreateWallet:  jest.fn(),
      creditBalance:      jest.fn(),
      debitBalance:       jest.fn(),
      holdFunds:          jest.fn(),
      releaseFunds:       jest.fn(),
      refundHeldFunds:    jest.fn(),
    };

    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService,   useValue: prisma },
        { provide: PaystackService, useValue: paystack },
        { provide: WalletService,   useValue: walletService },
        { provide: EventEmitter2,   useValue: eventEmitter },
        { provide: ConfigService,   useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── initiateFunding ───────────────────────────────────────────────────────

  describe('initiateFunding', () => {
    it('creates a payment record and returns Paystack URL', async () => {
      paystack.initializePayment.mockResolvedValue({
        reference:        REFERENCE,
        authorizationUrl: 'https://checkout.paystack.com/abc123',
        accessCode:       'abc123',
      });
      prisma.payment.create.mockResolvedValue(mockPayment);

      const result = await service.initiateFunding(USER_ID, 5000);
      expect(result.authorizationUrl).toBe('https://checkout.paystack.com/abc123');
      expect(result.reference).toBe(REFERENCE);
      expect(prisma.payment.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ userId: USER_ID, status: PaymentStatus.PENDING }),
      }));
    });

    it('uses fallback email when user has no email', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: USER_ID, email: null, phone: '+2348012345678' });
      paystack.initializePayment.mockResolvedValue({
        reference: REFERENCE, authorizationUrl: 'https://x', accessCode: 'code',
      });
      prisma.payment.create.mockResolvedValue(mockPayment);

      await service.initiateFunding(USER_ID, 1000);
      expect(paystack.initializePayment).toHaveBeenCalledWith(
        1000,
        `${USER_ID}@wokizi.app`,
        expect.any(String),
        expect.any(Object),
      );
    });

    it('throws BadRequestException for zero or negative amounts', async () => {
      await expect(service.initiateFunding(USER_ID, 0)).rejects.toThrow(BadRequestException);
      await expect(service.initiateFunding(USER_ID, -100)).rejects.toThrow(BadRequestException);
    });

    it('writes a payment audit record', async () => {
      paystack.initializePayment.mockResolvedValue({
        reference: REFERENCE, authorizationUrl: 'https://x', accessCode: 'c',
      });
      prisma.payment.create.mockResolvedValue(mockPayment);

      await service.initiateFunding(USER_ID, 5000);
      expect(prisma.paymentAudit.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ event: PaymentAuditEvent.INITIALIZED }),
      }));
    });
  });

  // ── verifyFunding ─────────────────────────────────────────────────────────

  describe('verifyFunding', () => {
    it('credits wallet when payment succeeds', async () => {
      prisma.payment.findUnique.mockResolvedValue(mockPayment);
      paystack.verifyPayment.mockResolvedValue({ success: true, amount: 5000, channel: 'card' });
      prisma.payment.update.mockResolvedValue({ ...mockPayment, status: PaymentStatus.COMPLETED });
      walletService.creditBalance.mockResolvedValue({});

      const result = await service.verifyFunding(USER_ID, REFERENCE);
      expect(result.success).toBe(true);
      expect(walletService.creditBalance).toHaveBeenCalledWith(USER_ID, 5000, TransactionType.FUNDING, expect.any(String), expect.any(Object));
    });

    it('returns cached result when payment already COMPLETED', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        ...mockPayment, status: PaymentStatus.COMPLETED,
      });

      const result = await service.verifyFunding(USER_ID, REFERENCE) as any;
      expect(result.alreadyProcessed).toBe(true);
      expect(paystack.verifyPayment).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when Paystack verification fails', async () => {
      prisma.payment.findUnique.mockResolvedValue(mockPayment);
      paystack.verifyPayment.mockResolvedValue({ success: false, error: 'Payment abandoned' });
      prisma.payment.update.mockResolvedValue({});

      await expect(service.verifyFunding(USER_ID, REFERENCE)).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when payment record not found', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);
      await expect(service.verifyFunding(USER_ID, 'unknown-ref')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when payment belongs to another user', async () => {
      prisma.payment.findUnique.mockResolvedValue({ ...mockPayment, userId: 'other-user' });
      await expect(service.verifyFunding(USER_ID, REFERENCE)).rejects.toThrow(ForbiddenException);
    });
  });

  // ── handleWebhook ─────────────────────────────────────────────────────────

  describe('handleWebhook', () => {
    it('rejects webhook with invalid signature', async () => {
      paystack.validateWebhookSignature.mockReturnValue(false);
      const result = await service.handleWebhook('{}', 'bad-sig');
      expect(result).toEqual({ received: false });
    });

    it('credits wallet on charge.success event', async () => {
      paystack.validateWebhookSignature.mockReturnValue(true);
      prisma.payment.findUnique.mockResolvedValue(mockPayment);
      prisma.payment.update.mockResolvedValue({ ...mockPayment, status: PaymentStatus.COMPLETED });
      walletService.creditBalance.mockResolvedValue({});

      const body = JSON.stringify({
        event: 'charge.success',
        data:  { reference: REFERENCE, amount: 500000, channel: 'card' },
      });

      const result = await service.handleWebhook(body, 'valid-sig');
      expect(result).toEqual({ received: true });
      expect(walletService.creditBalance).toHaveBeenCalledWith(USER_ID, 5000, TransactionType.FUNDING, expect.any(String), expect.any(Object));
    });

    it('is idempotent — ignores charge.success for already-COMPLETED payment', async () => {
      paystack.validateWebhookSignature.mockReturnValue(true);
      prisma.payment.findUnique.mockResolvedValue({ ...mockPayment, status: PaymentStatus.COMPLETED });

      const body = JSON.stringify({
        event: 'charge.success',
        data:  { reference: REFERENCE, amount: 500000, channel: 'card' },
      });

      await service.handleWebhook(body, 'valid-sig');
      expect(walletService.creditBalance).not.toHaveBeenCalled();
    });

    it('marks withdrawal COMPLETED on transfer.success', async () => {
      paystack.validateWebhookSignature.mockReturnValue(true);
      const withdrawal = { id: 'wdl-1', userId: USER_ID, amount: new Decimal(2000), transferCode: 'TRF_abc' };
      prisma.withdrawal.findFirst.mockResolvedValue(withdrawal);
      prisma.withdrawal.update.mockResolvedValue({ ...withdrawal, status: 'COMPLETED' });

      const body = JSON.stringify({
        event: 'transfer.success',
        data:  { transfer_code: 'TRF_abc' },
      });

      await service.handleWebhook(body, 'valid-sig');
      expect(prisma.withdrawal.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'COMPLETED' }),
      }));
    });

    it('refunds wallet and marks withdrawal REJECTED on transfer.failed', async () => {
      paystack.validateWebhookSignature.mockReturnValue(true);
      const withdrawal = { id: 'wdl-1', userId: USER_ID, amount: new Decimal(2000), transferCode: 'TRF_abc' };
      prisma.withdrawal.findFirst.mockResolvedValue(withdrawal);
      prisma.withdrawal.update.mockResolvedValue({});
      walletService.creditBalance.mockResolvedValue({});

      const body = JSON.stringify({
        event: 'transfer.failed',
        data:  { transfer_code: 'TRF_abc' },
      });

      await service.handleWebhook(body, 'valid-sig');
      expect(walletService.creditBalance).toHaveBeenCalledWith(
        USER_ID, 2000, TransactionType.REFUND, expect.any(String),
      );
      expect(prisma.withdrawal.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'REJECTED' }),
      }));
    });

    it('handles unknown webhook events gracefully', async () => {
      paystack.validateWebhookSignature.mockReturnValue(true);
      const body = JSON.stringify({ event: 'invoice.create', data: {} });
      const result = await service.handleWebhook(body, 'valid-sig');
      expect(result).toEqual({ received: true });
    });

    it('rejects malformed JSON', async () => {
      paystack.validateWebhookSignature.mockReturnValue(true);
      const result = await service.handleWebhook('not-json', 'valid-sig');
      expect(result).toEqual({ received: false });
    });
  });

  // ── createEscrow ──────────────────────────────────────────────────────────

  describe('createEscrow', () => {
    it('returns null for LABOUR_ONLY payment type', async () => {
      prisma.quotation.findUnique.mockResolvedValue({
        id: QUOTE_ID, customerId: USER_ID, providerId: 'prov-1',
        paymentType: PaymentType.LABOUR_ONLY, totalAmount: new Decimal(5000), materialCost: new Decimal(0),
      });
      prisma.escrowReservation.findUnique.mockResolvedValue(null);

      const result = await service.createEscrow(USER_ID, BOOKING_ID, QUOTE_ID);
      expect(result).toBeNull();
    });

    it('holds material costs for MATERIALS_REQUIRED', async () => {
      prisma.quotation.findUnique.mockResolvedValue({
        id: QUOTE_ID, customerId: USER_ID, providerId: 'prov-1',
        paymentType: PaymentType.MATERIALS_REQUIRED,
        materialCost: new Decimal(3000), totalAmount: new Decimal(8000),
      });
      prisma.escrowReservation.findUnique.mockResolvedValue(null);
      walletService.getWallet.mockResolvedValue(mockWallet);
      walletService.holdFunds.mockResolvedValue({});
      walletService.getOrCreateWallet.mockResolvedValue(mockWallet);
      prisma.escrowReservation.create.mockResolvedValue({ id: 'escrow-1', status: 'COMPLETED', amount: new Decimal(3000) });
      prisma.walletTransaction.create.mockResolvedValue({});

      const result = await service.createEscrow(USER_ID, BOOKING_ID, QUOTE_ID);
      expect(walletService.holdFunds).toHaveBeenCalledWith(USER_ID, 3000);
      expect(result).not.toBeNull();
    });

    it('holds full amount for FULL_PROJECT', async () => {
      prisma.quotation.findUnique.mockResolvedValue({
        id: QUOTE_ID, customerId: USER_ID, providerId: 'prov-1',
        paymentType: PaymentType.FULL_PROJECT,
        totalAmount: new Decimal(8000), materialCost: new Decimal(0),
      });
      prisma.escrowReservation.findUnique.mockResolvedValue(null);
      walletService.getWallet.mockResolvedValue(mockWallet);
      walletService.holdFunds.mockResolvedValue({});
      walletService.getOrCreateWallet.mockResolvedValue(mockWallet);
      prisma.escrowReservation.create.mockResolvedValue({ id: 'escrow-1', status: 'COMPLETED', amount: new Decimal(8000) });
      prisma.walletTransaction.create.mockResolvedValue({});

      await service.createEscrow(USER_ID, BOOKING_ID, QUOTE_ID);
      expect(walletService.holdFunds).toHaveBeenCalledWith(USER_ID, 8000);
    });

    it('throws BadRequestException when wallet balance insufficient', async () => {
      prisma.quotation.findUnique.mockResolvedValue({
        id: QUOTE_ID, customerId: USER_ID, providerId: 'prov-1',
        paymentType: PaymentType.FULL_PROJECT,
        totalAmount: new Decimal(50000), materialCost: new Decimal(0),
      });
      prisma.escrowReservation.findUnique.mockResolvedValue(null);
      walletService.getWallet.mockResolvedValue({ ...mockWallet, balance: new Decimal(100) });

      await expect(service.createEscrow(USER_ID, BOOKING_ID, QUOTE_ID))
        .rejects.toThrow(BadRequestException);
    });

    it('returns existing escrow idempotently', async () => {
      const existing = { id: 'escrow-1', status: 'COMPLETED' };
      prisma.quotation.findUnique.mockResolvedValue({
        id: QUOTE_ID, customerId: USER_ID, providerId: 'prov-1',
        paymentType: PaymentType.FULL_PROJECT, totalAmount: new Decimal(8000),
      });
      prisma.escrowReservation.findUnique.mockResolvedValue(existing);

      const result = await service.createEscrow(USER_ID, BOOKING_ID, QUOTE_ID);
      expect(result).toEqual(existing);
      expect(walletService.holdFunds).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when customer does not own the quotation', async () => {
      prisma.quotation.findUnique.mockResolvedValue({
        id: QUOTE_ID, customerId: 'other-user', providerId: 'prov-1',
        paymentType: PaymentType.FULL_PROJECT, totalAmount: new Decimal(8000),
      });
      await expect(service.createEscrow(USER_ID, BOOKING_ID, QUOTE_ID))
        .rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when quotation not found', async () => {
      prisma.quotation.findUnique.mockResolvedValue(null);
      await expect(service.createEscrow(USER_ID, BOOKING_ID, QUOTE_ID))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ── releaseEscrow ─────────────────────────────────────────────────────────

  describe('releaseEscrow', () => {
    it('transfers held funds to provider', async () => {
      prisma.escrowReservation.findUnique.mockResolvedValue({
        id: 'escrow-1', customerId: USER_ID, providerId: 'prov-1',
        amount: new Decimal(5000), status: PaymentStatus.COMPLETED,
      });
      walletService.releaseFunds.mockResolvedValue({});
      prisma.escrowReservation.update.mockResolvedValue({});

      await service.releaseEscrow(BOOKING_ID);
      expect(walletService.releaseFunds).toHaveBeenCalledWith(USER_ID, 5000, 'prov-1');
    });

    it('emits PAYMENT_RECEIVED notification to provider', async () => {
      prisma.escrowReservation.findUnique.mockResolvedValue({
        id: 'escrow-1', customerId: USER_ID, providerId: 'prov-1',
        amount: new Decimal(5000), status: PaymentStatus.COMPLETED,
      });
      walletService.releaseFunds.mockResolvedValue({});
      prisma.escrowReservation.update.mockResolvedValue({});

      await service.releaseEscrow(BOOKING_ID);
      expect(eventEmitter.emit).toHaveBeenCalledWith('notification.send', expect.objectContaining({
        userId: 'prov-1', type: 'PAYMENT_RECEIVED',
      }));
    });

    it('is a no-op when no escrow exists', async () => {
      prisma.escrowReservation.findUnique.mockResolvedValue(null);
      await service.releaseEscrow(BOOKING_ID);
      expect(walletService.releaseFunds).not.toHaveBeenCalled();
    });
  });

  // ── refundEscrow ──────────────────────────────────────────────────────────

  describe('refundEscrow', () => {
    it('refunds held funds to customer', async () => {
      prisma.escrowReservation.findUnique.mockResolvedValue({
        id: 'escrow-1', customerId: USER_ID, providerId: 'prov-1',
        amount: new Decimal(5000), status: PaymentStatus.COMPLETED,
      });
      walletService.refundHeldFunds.mockResolvedValue({});
      prisma.escrowReservation.update.mockResolvedValue({});

      await service.refundEscrow(BOOKING_ID);
      expect(walletService.refundHeldFunds).toHaveBeenCalledWith(USER_ID, 5000);
    });

    it('emits REFUND_ISSUED notification to customer', async () => {
      prisma.escrowReservation.findUnique.mockResolvedValue({
        id: 'escrow-1', customerId: USER_ID, providerId: 'prov-1',
        amount: new Decimal(5000), status: PaymentStatus.COMPLETED,
      });
      walletService.refundHeldFunds.mockResolvedValue({});
      prisma.escrowReservation.update.mockResolvedValue({});

      await service.refundEscrow(BOOKING_ID);
      expect(eventEmitter.emit).toHaveBeenCalledWith('notification.send', expect.objectContaining({
        userId: USER_ID, type: 'REFUND_ISSUED',
      }));
    });

    it('is a no-op when no escrow exists', async () => {
      prisma.escrowReservation.findUnique.mockResolvedValue(null);
      await service.refundEscrow(BOOKING_ID);
      expect(walletService.refundHeldFunds).not.toHaveBeenCalled();
    });
  });

  // ── hasRequiredEscrow ─────────────────────────────────────────────────────

  describe('hasRequiredEscrow', () => {
    it('returns true for LABOUR_ONLY without escrow needed', async () => {
      prisma.quotation.findUnique.mockResolvedValue({
        id: QUOTE_ID, paymentType: PaymentType.LABOUR_ONLY,
      });
      const result = await service.hasRequiredEscrow(QUOTE_ID, BOOKING_ID);
      expect(result).toBe(true);
    });

    it('returns true when escrow is COMPLETED', async () => {
      prisma.quotation.findUnique.mockResolvedValue({
        id: QUOTE_ID, paymentType: PaymentType.FULL_PROJECT,
      });
      prisma.escrowReservation.findUnique.mockResolvedValue({ status: PaymentStatus.COMPLETED });

      const result = await service.hasRequiredEscrow(QUOTE_ID, BOOKING_ID);
      expect(result).toBe(true);
    });

    it('returns false when escrow is missing for FULL_PROJECT', async () => {
      prisma.quotation.findUnique.mockResolvedValue({
        id: QUOTE_ID, paymentType: PaymentType.FULL_PROJECT,
      });
      prisma.escrowReservation.findUnique.mockResolvedValue(null);

      const result = await service.hasRequiredEscrow(QUOTE_ID, BOOKING_ID);
      expect(result).toBe(false);
    });

    it('returns false when no bookingId provided for non-LABOUR_ONLY', async () => {
      prisma.quotation.findUnique.mockResolvedValue({
        id: QUOTE_ID, paymentType: PaymentType.MATERIALS_REQUIRED,
      });
      const result = await service.hasRequiredEscrow(QUOTE_ID);
      expect(result).toBe(false);
    });
  });
});
