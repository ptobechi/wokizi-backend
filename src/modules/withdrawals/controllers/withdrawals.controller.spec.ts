import { Test, TestingModule } from '@nestjs/testing';
import { WithdrawalsController } from './withdrawals.controller';
import { WithdrawalsService } from '../services/withdrawals.service';

const mockWithdrawalsService = {
  requestWithdrawal: jest.fn(),
  listMine: jest.fn(),
  listBanks: jest.fn(),
};

describe('WithdrawalsController', () => {
  let controller: WithdrawalsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WithdrawalsController],
      providers: [{ provide: WithdrawalsService, useValue: mockWithdrawalsService }],
    }).compile();
    controller = module.get(WithdrawalsController);
  });

  describe('requestWithdrawal', () => {
    it('creates a withdrawal request for a provider', async () => {
      const dto = { amount: 20000, bankCode: '057', accountNumber: '1234567890' };
      const withdrawal = { id: 'w1', status: 'PENDING', amount: 20000 };
      mockWithdrawalsService.requestWithdrawal.mockResolvedValue(withdrawal);

      const result = await controller.requestWithdrawal('provider-1', dto as any);

      expect(mockWithdrawalsService.requestWithdrawal).toHaveBeenCalledWith('provider-1', dto);
      expect(result).toEqual(withdrawal);
    });
  });

  describe('listMine', () => {
    it('returns paginated withdrawal history', async () => {
      const page = {
        data: [{ id: 'w1', status: 'COMPLETED' }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      };
      mockWithdrawalsService.listMine.mockResolvedValue(page);

      const result = await controller.listMine('provider-1', 1, 20);

      expect(mockWithdrawalsService.listMine).toHaveBeenCalledWith('provider-1', 1, 20);
      expect(result).toEqual(page);
    });

    it('converts string page/limit to numbers', async () => {
      mockWithdrawalsService.listMine.mockResolvedValue({ data: [], meta: {} });

      await controller.listMine('provider-1', '2' as any, '10' as any);

      expect(mockWithdrawalsService.listMine).toHaveBeenCalledWith('provider-1', 2, 10);
    });
  });

  describe('listBanks', () => {
    it('returns list of Nigerian banks from Paystack', async () => {
      const banks = [{ name: 'Zenith Bank', code: '057' }, { name: 'GTBank', code: '058' }];
      mockWithdrawalsService.listBanks.mockResolvedValue(banks);

      const result = await controller.listBanks();

      expect(mockWithdrawalsService.listBanks).toHaveBeenCalled();
      expect(result).toEqual(banks);
    });
  });
});
