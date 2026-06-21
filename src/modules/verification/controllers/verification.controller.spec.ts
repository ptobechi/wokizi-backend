import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { VerificationController } from './verification.controller';
import { VerificationService } from '../services/verification.service';

const mockVerificationService = {
  submit: jest.fn(),
  getMyVerification: jest.fn(),
  listPending: jest.fn(),
  review: jest.fn(),
};

describe('VerificationController', () => {
  let controller: VerificationController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VerificationController],
      providers: [{ provide: VerificationService, useValue: mockVerificationService }],
    }).compile();
    controller = module.get(VerificationController);
  });

  describe('submit', () => {
    it('submits KYC documents for the current user', async () => {
      const dto = { idType: 'NIN', idNumber: '12345678901', selfieUrl: 'https://s3.example.com/s.jpg' };
      const verification = { id: 'v1', status: 'PENDING' };
      mockVerificationService.submit.mockResolvedValue(verification);

      const result = await controller.submit('u1', dto as any);

      expect(mockVerificationService.submit).toHaveBeenCalledWith('u1', dto);
      expect(result).toEqual(verification);
    });
  });

  describe('getMyVerification', () => {
    it('returns current verification status for the user', async () => {
      const verification = { id: 'v1', status: 'APPROVED' };
      mockVerificationService.getMyVerification.mockResolvedValue(verification);

      const result = await controller.getMyVerification('u1');

      expect(mockVerificationService.getMyVerification).toHaveBeenCalledWith('u1');
      expect(result).toEqual(verification);
    });
  });

  describe('listPending', () => {
    it('returns paginated pending verifications for admin', async () => {
      const page = {
        data: [{ id: 'v1', status: 'PENDING' }],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      };
      mockVerificationService.listPending.mockResolvedValue(page);

      const result = await controller.listPending(1, 10);

      expect(mockVerificationService.listPending).toHaveBeenCalledWith(1, 10);
      expect(result).toEqual(page);
    });
  });

  describe('review', () => {
    it('approves a verification as admin', async () => {
      const dto = { action: 'APPROVED', notes: 'Documents look good' };
      const updated = { id: 'v1', status: 'APPROVED' };
      mockVerificationService.review.mockResolvedValue(updated);

      const result = await controller.review('v1', 'admin-1', dto as any);

      expect(mockVerificationService.review).toHaveBeenCalledWith('v1', 'admin-1', dto);
      expect(result).toEqual(updated);
    });

    it('rejects a verification with a reason', async () => {
      const dto = { action: 'REJECTED', notes: 'ID image is blurry' };
      mockVerificationService.review.mockResolvedValue({ id: 'v1', status: 'REJECTED' });

      await controller.review('v1', 'admin-1', dto as any);

      expect(mockVerificationService.review).toHaveBeenCalledWith('v1', 'admin-1', dto);
    });
  });
});
