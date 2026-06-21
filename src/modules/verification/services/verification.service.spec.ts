import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VerificationStatus } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { VerificationService } from './verification.service';
import { VerificationRepository } from '../repositories/verification.repository';

const USER_ID    = 'user-uuid-1';
const ADMIN_ID   = 'admin-uuid-1';
const VERIF_ID   = 'verif-uuid-1';

const mockVerification = {
  id:         VERIF_ID,
  userId:     USER_ID,
  status:     VerificationStatus.PENDING,
  reviewNotes: null,
  rejectionReason: null,
  reviewedBy: null,
  reviewedAt: null,
  createdAt:  new Date(),
  updatedAt:  new Date(),
  user: { id: USER_ID },
};

describe('VerificationService', () => {
  let service: VerificationService;
  let repo: any;
  let eventEmitter: any;

  beforeEach(async () => {
    repo = {
      findByUserId:  jest.fn(),
      findById:      jest.fn(),
      upsert:        jest.fn(),
      review:        jest.fn(),
      listPending:   jest.fn(),
      countPending:  jest.fn(),
    };
    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationService,
        { provide: VerificationRepository, useValue: repo },
        { provide: EventEmitter2,          useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<VerificationService>(VerificationService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── submit ────────────────────────────────────────────────────────────────

  describe('submit', () => {
    const dto = {
      documents: [
        { type: 'GOVERNMENT_ID', url: 's3://bucket/id.jpg' },
        { type: 'SELFIE',        url: 's3://bucket/selfie.jpg' },
      ],
    };

    it('submits verification for a new user', async () => {
      repo.findByUserId.mockResolvedValue(null);
      repo.upsert.mockResolvedValue(mockVerification);

      const result = await service.submit(USER_ID, dto as any);
      expect(repo.upsert).toHaveBeenCalledWith(USER_ID, dto.documents);
      expect(result).toEqual(mockVerification);
    });

    it('emits VERIFICATION_SUBMITTED notification', async () => {
      repo.findByUserId.mockResolvedValue(null);
      repo.upsert.mockResolvedValue(mockVerification);

      await service.submit(USER_ID, dto as any);
      expect(eventEmitter.emit).toHaveBeenCalledWith('notification.send', expect.objectContaining({
        userId: USER_ID, type: 'VERIFICATION_SUBMITTED',
      }));
    });

    it('allows resubmission when previously REJECTED', async () => {
      repo.findByUserId.mockResolvedValue({ ...mockVerification, status: VerificationStatus.REJECTED });
      repo.upsert.mockResolvedValue({ ...mockVerification, status: VerificationStatus.PENDING });

      const result = await service.submit(USER_ID, dto as any);
      expect(repo.upsert).toHaveBeenCalled();
      expect(result.status).toBe(VerificationStatus.PENDING);
    });

    it('throws BadRequestException when already APPROVED', async () => {
      repo.findByUserId.mockResolvedValue({ ...mockVerification, status: VerificationStatus.APPROVED });
      await expect(service.submit(USER_ID, dto as any)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when already PENDING', async () => {
      repo.findByUserId.mockResolvedValue(mockVerification);
      await expect(service.submit(USER_ID, dto as any)).rejects.toThrow(BadRequestException);
    });
  });

  // ── getMyVerification ─────────────────────────────────────────────────────

  describe('getMyVerification', () => {
    it('returns existing verification', async () => {
      repo.findByUserId.mockResolvedValue(mockVerification);
      const result = await service.getMyVerification(USER_ID);
      expect(result).toEqual(mockVerification);
    });

    it('returns not-submitted sentinel when no verification exists', async () => {
      repo.findByUserId.mockResolvedValue(null);
      const result = await service.getMyVerification(USER_ID);
      expect(result).toEqual({ status: null, message: 'Not submitted' });
    });
  });

  // ── review ────────────────────────────────────────────────────────────────

  describe('review', () => {
    it('approves a PENDING verification', async () => {
      repo.findById.mockResolvedValue(mockVerification);
      const approved = { ...mockVerification, status: VerificationStatus.APPROVED };
      repo.review.mockResolvedValue(approved);

      const result = await service.review(VERIF_ID, ADMIN_ID, {
        status: 'APPROVED', reviewNotes: 'All documents verified',
      } as any);

      expect(result.status).toBe(VerificationStatus.APPROVED);
      expect(repo.review).toHaveBeenCalledWith(VERIF_ID, ADMIN_ID, VerificationStatus.APPROVED, 'All documents verified', undefined);
    });

    it('emits VERIFICATION_APPROVED notification', async () => {
      repo.findById.mockResolvedValue(mockVerification);
      repo.review.mockResolvedValue({ ...mockVerification, status: VerificationStatus.APPROVED });

      await service.review(VERIF_ID, ADMIN_ID, { status: 'APPROVED' } as any);
      expect(eventEmitter.emit).toHaveBeenCalledWith('notification.send', expect.objectContaining({
        userId: USER_ID, type: 'VERIFICATION_APPROVED',
      }));
    });

    it('rejects with reason', async () => {
      repo.findById.mockResolvedValue(mockVerification);
      const rejected = { ...mockVerification, status: VerificationStatus.REJECTED, rejectionReason: 'Blurry ID' };
      repo.review.mockResolvedValue(rejected);

      const result = await service.review(VERIF_ID, ADMIN_ID, {
        status: 'REJECTED', rejectionReason: 'Blurry ID',
      } as any);
      expect(result.status).toBe(VerificationStatus.REJECTED);
    });

    it('emits VERIFICATION_REJECTED notification', async () => {
      repo.findById.mockResolvedValue(mockVerification);
      repo.review.mockResolvedValue({ ...mockVerification, status: VerificationStatus.REJECTED });

      await service.review(VERIF_ID, ADMIN_ID, {
        status: 'REJECTED', rejectionReason: 'Blurry ID',
      } as any);
      expect(eventEmitter.emit).toHaveBeenCalledWith('notification.send', expect.objectContaining({
        userId: USER_ID, type: 'VERIFICATION_REJECTED',
      }));
    });

    it('throws BadRequestException when rejecting without a reason', async () => {
      repo.findById.mockResolvedValue(mockVerification);
      await expect(service.review(VERIF_ID, ADMIN_ID, { status: 'REJECTED' } as any))
        .rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when verification is not PENDING', async () => {
      repo.findById.mockResolvedValue({ ...mockVerification, status: VerificationStatus.APPROVED });
      await expect(service.review(VERIF_ID, ADMIN_ID, { status: 'APPROVED' } as any))
        .rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when verification not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.review('bad-id', ADMIN_ID, { status: 'APPROVED' } as any))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ── listPending ───────────────────────────────────────────────────────────

  describe('listPending', () => {
    it('returns paginated pending verifications', async () => {
      repo.listPending.mockResolvedValue([mockVerification]);
      repo.countPending.mockResolvedValue(1);

      const result = await service.listPending(1, 10);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('returns empty list when no pending verifications', async () => {
      repo.listPending.mockResolvedValue([]);
      repo.countPending.mockResolvedValue(0);

      const result = await service.listPending(1, 10);
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });
});
