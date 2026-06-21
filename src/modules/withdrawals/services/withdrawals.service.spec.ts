import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WithdrawalStatus, TransactionType } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Decimal } from '@prisma/client/runtime/library';
import { WithdrawalsService } from './withdrawals.service';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { WalletService } from '../../wallet/services/wallet.service';
import { PaystackService } from '../../../integrations/paystack/paystack.service';

const USER_ID = 'user-uuid-1';

const mockWallet = {
  id:             'wallet-uuid-1',
  userId:          USER_ID,
  balance:         new Decimal(5000),
  pendingBalance:  new Decimal(0),
  heldBalance:     new Decimal(0),
  currency:        'NGN',
  createdAt:       new Date(),
  updatedAt:       new Date(),
};

const mockWithdrawal = {
  id:            'wdl-uuid-1',
  userId:         USER_ID,
  amount:         new Decimal(1000),
  currency:       'NGN',
  status:         WithdrawalStatus.PENDING,
  bankName:       'First Bank',
  bankCode:       '011',
  accountNumber:  '3012345678',
  accountName:    'John Doe',
  reference:      'wdl-ref-1',
  recipientCode:  null,
  transferCode:   null,
  adminNote:      null,
  processedAt:    null,
  createdAt:      new Date(),
  updatedAt:      new Date(),
};

const dto = {
  amount:        1000,
  bankName:      'First Bank',
  bankCode:      '011',
  accountNumber: '3012345678',
  accountName:   'John Doe',
};

describe('WithdrawalsService', () => {
  let service: WithdrawalsService;
  let prisma: any;
  let walletService: jest.Mocked<WalletService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let paystackService: jest.Mocked<PaystackService>;

  beforeEach(async () => {
    prisma = {
      withdrawal: {
        create:     jest.fn(),
        findMany:   jest.fn(),
        count:      jest.fn(),
        findUnique: jest.fn(),
        update:     jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WithdrawalsService,
        { provide: PrismaService,  useValue: prisma },
        { provide: WalletService,  useValue: {
          getWallet:      jest.fn(),
          debitBalance:   jest.fn(),
          creditBalance:  jest.fn(),
        }},
        { provide: PaystackService, useValue: {
          createTransferRecipient: jest.fn(),
          initiateTransfer:        jest.fn(),
          listBanks:               jest.fn(),
        }},
        { provide: EventEmitter2,  useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service         = module.get<WithdrawalsService>(WithdrawalsService);
    walletService   = module.get(WalletService);
    eventEmitter    = module.get(EventEmitter2);
    paystackService = module.get(PaystackService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── requestWithdrawal ─────────────────────────────────────────────────────

  describe('requestWithdrawal', () => {
    it('creates withdrawal and debits wallet', async () => {
      (walletService.getWallet as jest.Mock).mockResolvedValue(mockWallet);
      (walletService.debitBalance as jest.Mock).mockResolvedValue({});
      prisma.withdrawal.create.mockResolvedValue(mockWithdrawal);

      const result = await service.requestWithdrawal(USER_ID, dto);
      expect(walletService.debitBalance).toHaveBeenCalledWith(USER_ID, 1000, TransactionType.WITHDRAWAL, expect.any(String));
      expect(result.status).toBe(WithdrawalStatus.PENDING);
      expect(eventEmitter.emit).toHaveBeenCalled();
    });

    it('throws BadRequestException when amount below minimum', async () => {
      await expect(service.requestWithdrawal(USER_ID, { ...dto, amount: 50 }))
        .rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when balance is insufficient', async () => {
      (walletService.getWallet as jest.Mock).mockResolvedValue({ ...mockWallet, balance: new Decimal(50) });
      await expect(service.requestWithdrawal(USER_ID, dto)).rejects.toThrow(BadRequestException);
    });
  });

  // ── listMine ──────────────────────────────────────────────────────────────

  describe('listMine', () => {
    it('returns paginated withdrawals', async () => {
      prisma.withdrawal.findMany.mockResolvedValue([mockWithdrawal]);
      prisma.withdrawal.count.mockResolvedValue(1);

      const result = await service.listMine(USER_ID);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  // ── adminProcess ──────────────────────────────────────────────────────────

  describe('adminProcess', () => {
    it('approves withdrawal, creates Paystack transfer, sets PROCESSING', async () => {
      prisma.withdrawal.findUnique.mockResolvedValue(mockWithdrawal);
      prisma.withdrawal.update.mockResolvedValue({ ...mockWithdrawal, status: WithdrawalStatus.PROCESSING, transferCode: 'TRF_abc123', recipientCode: 'RCP_xyz' });

      (paystackService.createTransferRecipient as jest.Mock).mockResolvedValue({ success: true, recipientCode: 'RCP_xyz' });
      (paystackService.initiateTransfer as jest.Mock).mockResolvedValue({ success: true, transferCode: 'TRF_abc123' });

      const result = await service.adminProcess('wdl-uuid-1', 'APPROVE', 'Processed');
      expect(paystackService.createTransferRecipient).toHaveBeenCalledWith('John Doe', '3012345678', '011');
      expect(paystackService.initiateTransfer).toHaveBeenCalledWith(1000, 'RCP_xyz', 'wdl-ref-1', expect.any(String));
      expect(result.status).toBe(WithdrawalStatus.PROCESSING);
      expect(eventEmitter.emit).toHaveBeenCalled();
    });

    it('throws BadRequestException when Paystack recipient creation fails', async () => {
      prisma.withdrawal.findUnique.mockResolvedValue(mockWithdrawal);
      (paystackService.createTransferRecipient as jest.Mock).mockResolvedValue({ success: false, error: 'Invalid account' });

      await expect(service.adminProcess('wdl-uuid-1', 'APPROVE')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when Paystack transfer initiation fails', async () => {
      prisma.withdrawal.findUnique.mockResolvedValue(mockWithdrawal);
      (paystackService.createTransferRecipient as jest.Mock).mockResolvedValue({ success: true, recipientCode: 'RCP_xyz' });
      (paystackService.initiateTransfer as jest.Mock).mockResolvedValue({ success: false, error: 'Insufficient balance' });

      await expect(service.adminProcess('wdl-uuid-1', 'APPROVE')).rejects.toThrow(BadRequestException);
    });

    it('rejects withdrawal and refunds balance', async () => {
      prisma.withdrawal.findUnique.mockResolvedValue(mockWithdrawal);
      prisma.withdrawal.update.mockResolvedValue({ ...mockWithdrawal, status: WithdrawalStatus.REJECTED });
      (walletService.creditBalance as jest.Mock).mockResolvedValue({});

      const result = await service.adminProcess('wdl-uuid-1', 'REJECT', 'Invalid account');
      expect(walletService.creditBalance).toHaveBeenCalledWith(USER_ID, 1000, TransactionType.REFUND, expect.any(String));
      expect(result.status).toBe(WithdrawalStatus.REJECTED);
    });

    it('throws NotFoundException for unknown withdrawal', async () => {
      prisma.withdrawal.findUnique.mockResolvedValue(null);
      await expect(service.adminProcess('bad-id', 'APPROVE')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when not PENDING', async () => {
      prisma.withdrawal.findUnique.mockResolvedValue({ ...mockWithdrawal, status: WithdrawalStatus.COMPLETED });
      await expect(service.adminProcess('wdl-uuid-1', 'APPROVE')).rejects.toThrow(BadRequestException);
    });
  });
});
