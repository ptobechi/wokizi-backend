import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TransactionType } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Decimal } from '@prisma/client/runtime/library';
import { WalletService } from './wallet.service';
import { PrismaService } from '../../../core/prisma/prisma.service';

const USER_ID = 'user-uuid-1';

const mockWallet = {
  id:             'wallet-uuid-1',
  userId:          USER_ID,
  balance:         new Decimal(500),
  pendingBalance:  new Decimal(0),
  heldBalance:     new Decimal(0),
  currency:        'NGN',
  createdAt:       new Date(),
  updatedAt:       new Date(),
};

const mockTx = {
  id:            'tx-uuid-1',
  walletId:      'wallet-uuid-1',
  type:          TransactionType.FUNDING,
  amount:        new Decimal(200),
  balanceBefore: new Decimal(300),
  balanceAfter:  new Decimal(500),
  reference:     'ref-123',
  description:   null,
  createdAt:     new Date(),
};

describe('WalletService', () => {
  let service: WalletService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      wallet: {
        findUnique: jest.fn(),
        create:     jest.fn(),
        update:     jest.fn(),
      },
      walletTransaction: {
        findMany:  jest.fn(),
        count:     jest.fn(),
        create:    jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: PrismaService,  useValue: prisma },
        { provide: EventEmitter2,  useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── getOrCreateWallet ─────────────────────────────────────────────────────

  describe('getOrCreateWallet', () => {
    it('returns existing wallet when found', async () => {
      prisma.wallet.findUnique.mockResolvedValue(mockWallet);
      const result = await service.getOrCreateWallet(USER_ID);
      expect(result).toEqual(mockWallet);
      expect(prisma.wallet.create).not.toHaveBeenCalled();
    });

    it('creates wallet when not found', async () => {
      prisma.wallet.findUnique.mockResolvedValue(null);
      prisma.wallet.create.mockResolvedValue(mockWallet);
      const result = await service.getOrCreateWallet(USER_ID);
      expect(prisma.wallet.create).toHaveBeenCalledWith({ data: { userId: USER_ID } });
      expect(result).toEqual(mockWallet);
    });
  });

  // ── getWallet ─────────────────────────────────────────────────────────────

  describe('getWallet', () => {
    it('returns wallet', async () => {
      prisma.wallet.findUnique.mockResolvedValue(mockWallet);
      const result = await service.getWallet(USER_ID);
      expect(result).toEqual(mockWallet);
    });

    it('creates wallet if not found', async () => {
      prisma.wallet.findUnique
        .mockResolvedValueOnce(null)  // getWallet
        .mockResolvedValueOnce(null); // getOrCreateWallet inner
      prisma.wallet.create.mockResolvedValue(mockWallet);
      const result = await service.getWallet(USER_ID);
      expect(result).toEqual(mockWallet);
    });
  });

  // ── getTransactions ───────────────────────────────────────────────────────

  describe('getTransactions', () => {
    it('returns paginated transactions', async () => {
      prisma.wallet.findUnique.mockResolvedValue(mockWallet);
      prisma.walletTransaction.findMany.mockResolvedValue([mockTx]);
      prisma.walletTransaction.count.mockResolvedValue(1);

      const result = await service.getTransactions(USER_ID, 1, 20);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });
  });

  // ── creditBalance ──────────────────────────────────────────────────────────

  describe('creditBalance', () => {
    it('credits wallet and records transaction', async () => {
      prisma.wallet.findUnique.mockResolvedValue(mockWallet);
      const updatedWallet = { ...mockWallet, balance: new Decimal(700) };
      prisma.$transaction.mockImplementation(async (ops: any[]) => {
        return [updatedWallet, mockTx];
      });

      const result = await service.creditBalance(USER_ID, 200, TransactionType.FUNDING, 'Test credit');
      expect(result.wallet.balance).toEqual(new Decimal(700));
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  // ── debitBalance ───────────────────────────────────────────────────────────

  describe('debitBalance', () => {
    it('debits wallet when sufficient balance', async () => {
      prisma.wallet.findUnique.mockResolvedValue(mockWallet);
      const updatedWallet = { ...mockWallet, balance: new Decimal(300) };
      prisma.$transaction.mockImplementation(async () => [updatedWallet, mockTx]);

      const result = await service.debitBalance(USER_ID, 200, TransactionType.WITHDRAWAL);
      expect(result.wallet.balance).toEqual(new Decimal(300));
    });

    it('throws BadRequestException when balance is insufficient', async () => {
      prisma.wallet.findUnique.mockResolvedValue(mockWallet); // balance 500
      await expect(service.debitBalance(USER_ID, 1000, TransactionType.WITHDRAWAL))
        .rejects.toThrow(BadRequestException);
    });
  });

  // ── holdFunds ─────────────────────────────────────────────────────────────

  describe('holdFunds', () => {
    it('transfers balance to held balance', async () => {
      prisma.wallet.findUnique.mockResolvedValue(mockWallet);
      prisma.wallet.update.mockResolvedValue({ ...mockWallet, balance: new Decimal(300), heldBalance: new Decimal(200) });

      const result = await service.holdFunds(USER_ID, 200);
      expect(prisma.wallet.update).toHaveBeenCalledWith({
        where: { id: mockWallet.id },
        data: {
          balance:     { decrement: 200 },
          heldBalance: { increment: 200 },
        },
      });
    });

    it('throws BadRequestException when balance insufficient to hold', async () => {
      prisma.wallet.findUnique.mockResolvedValue(mockWallet); // balance 500
      await expect(service.holdFunds(USER_ID, 1000)).rejects.toThrow(BadRequestException);
    });
  });
});
