import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from '../services/payments.service';

const mockPaymentsService = {
  initiateFunding: jest.fn(),
  verifyFunding: jest.fn(),
  createEscrow: jest.fn(),
  handleWebhook: jest.fn(),
};

describe('PaymentsController', () => {
  let controller: PaymentsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [{ provide: PaymentsService, useValue: mockPaymentsService }],
    }).compile();
    controller = module.get(PaymentsController);
  });

  describe('initiateFunding', () => {
    it('initiates a Paystack transaction and returns authorization URL', async () => {
      const response = { authorizationUrl: 'https://paystack.com/pay/abc', reference: 'REF_1' };
      mockPaymentsService.initiateFunding.mockResolvedValue(response);

      const result = await controller.initiateFunding('u1', 5000);

      expect(mockPaymentsService.initiateFunding).toHaveBeenCalledWith('u1', 5000);
      expect(result).toEqual(response);
    });

    it('casts string amount to number', async () => {
      mockPaymentsService.initiateFunding.mockResolvedValue({});

      await controller.initiateFunding('u1', '5000' as any);

      expect(mockPaymentsService.initiateFunding).toHaveBeenCalledWith('u1', 5000);
    });
  });

  describe('verifyFunding', () => {
    it('verifies a Paystack payment and credits wallet', async () => {
      const response = { success: true, amount: 5000 };
      mockPaymentsService.verifyFunding.mockResolvedValue(response);

      const result = await controller.verifyFunding('u1', 'REF_1');

      expect(mockPaymentsService.verifyFunding).toHaveBeenCalledWith('u1', 'REF_1');
      expect(result).toEqual(response);
    });
  });

  describe('createEscrow', () => {
    it('creates an escrow hold from wallet for a booking', async () => {
      const response = { id: 'esc1', amount: 30000, status: 'HELD' };
      mockPaymentsService.createEscrow.mockResolvedValue(response);

      const result = await controller.createEscrow('customer-1', 'booking-1', 'q1');

      expect(mockPaymentsService.createEscrow).toHaveBeenCalledWith('customer-1', 'booking-1', 'q1');
      expect(result).toEqual(response);
    });
  });

  describe('handleWebhook', () => {
    it('processes a valid Paystack webhook with raw body', async () => {
      const rawBody = Buffer.from(JSON.stringify({ event: 'charge.success' }));
      const req = { rawBody, body: {} } as any;
      mockPaymentsService.handleWebhook.mockResolvedValue({ received: true });

      const result = await controller.handleWebhook(req, 'sha512=abc123');

      expect(mockPaymentsService.handleWebhook).toHaveBeenCalledWith(
        rawBody.toString('utf8'),
        'sha512=abc123',
      );
      expect(result).toEqual({ received: true });
    });

    it('falls back to JSON.stringify(body) when rawBody is absent', async () => {
      const body = { event: 'charge.success' };
      const req = { rawBody: undefined, body } as any;
      mockPaymentsService.handleWebhook.mockResolvedValue({ received: false });

      await controller.handleWebhook(req, 'bad-sig');

      expect(mockPaymentsService.handleWebhook).toHaveBeenCalledWith(
        JSON.stringify(body),
        'bad-sig',
      );
    });
  });
});
