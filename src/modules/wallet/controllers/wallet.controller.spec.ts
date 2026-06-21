import { Test, TestingModule } from '@nestjs/testing';
import { WalletController } from './wallet.controller';
import { WalletService } from '../services/wallet.service';

const mockWalletService = {
  getWallet: jest.fn(),
  getTransactions: jest.fn(),
};

describe('WalletController', () => {
  let controller: WalletController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletController],
      providers: [{ provide: WalletService, useValue: mockWalletService }],
    }).compile();
    controller = module.get(WalletController);
  });

  describe('getWallet', () => {
    it('returns wallet balance for the current user', async () => {
      const wallet = { id: 'w1', balance: 150000, heldBalance: 0, currency: 'NGN' };
      mockWalletService.getWallet.mockResolvedValue(wallet);

      const result = await controller.getWallet('u1');

      expect(mockWalletService.getWallet).toHaveBeenCalledWith('u1');
      expect(result).toEqual(wallet);
    });
  });

  describe('getTransactions', () => {
    it('returns paginated wallet transactions', async () => {
      const page = {
        data: [{ id: 'txn1', type: 'CREDIT', amount: 50000 }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      };
      mockWalletService.getTransactions.mockResolvedValue(page);

      const result = await controller.getTransactions('u1', 1, 20);

      expect(mockWalletService.getTransactions).toHaveBeenCalledWith('u1', 1, 20);
      expect(result).toEqual(page);
    });

    it('converts page and limit to numbers', async () => {
      mockWalletService.getTransactions.mockResolvedValue({ data: [], meta: {} });

      await controller.getTransactions('u1', '2' as any, '5' as any);

      expect(mockWalletService.getTransactions).toHaveBeenCalledWith('u1', 2, 5);
    });
  });
});
