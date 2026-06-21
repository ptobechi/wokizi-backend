import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReviewsService } from './reviews.service';
import { ReviewsRepository } from '../repositories/reviews.repository';
import { PrismaService } from '../../../core/prisma/prisma.service';

const REVIEWER_ID = 'customer-uuid-1';
const PROVIDER_ID = 'provider-uuid-1';
const SERVICE_ID  = 'service-uuid-1';
const BOOKING_ID  = 'booking-uuid-1';
const REVIEW_ID   = 'review-uuid-1';

const mockCompletedBooking = {
  id:         BOOKING_ID,
  customerId: REVIEWER_ID,
  providerId: PROVIDER_ID,
  serviceId:  SERVICE_ID,
  status:     'COMPLETED',
  review:     null,
};

const mockReview = {
  id:         REVIEW_ID,
  bookingId:  BOOKING_ID,
  serviceId:  SERVICE_ID,
  reviewerId: REVIEWER_ID,
  providerId: PROVIDER_ID,
  rating:     5,
  comment:    'Excellent work!',
  images:     [],
  createdAt:  new Date(),
};

describe('ReviewsService', () => {
  let service: ReviewsService;
  let repo: any;
  let prisma: any;
  let eventEmitter: any;

  beforeEach(async () => {
    repo = {
      create:           jest.fn(),
      findByService:    jest.fn(),
      countByService:   jest.fn(),
      findByProvider:   jest.fn(),
      countByProvider:  jest.fn(),
    };

    prisma = {
      booking: {
        findUnique: jest.fn(),
      },
      userProfile: {
        findUnique: jest.fn().mockResolvedValue({ displayName: 'Chidi Customer' }),
      },
    };

    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: ReviewsRepository, useValue: repo },
        { provide: PrismaService,     useValue: prisma },
        { provide: EventEmitter2,     useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a review for a completed booking', async () => {
      prisma.booking.findUnique.mockResolvedValue(mockCompletedBooking);
      repo.create.mockResolvedValue(mockReview);

      const result = await service.create(REVIEWER_ID, {
        bookingId: BOOKING_ID, rating: 5, comment: 'Excellent work!',
      });

      expect(result).toEqual(mockReview);
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
        bookingId:  BOOKING_ID,
        reviewerId: REVIEWER_ID,
        providerId: PROVIDER_ID,
        rating:     5,
      }));
    });

    it('emits PROVIDER_METRICS_UPDATE after review creation', async () => {
      prisma.booking.findUnique.mockResolvedValue(mockCompletedBooking);
      repo.create.mockResolvedValue(mockReview);

      await service.create(REVIEWER_ID, { bookingId: BOOKING_ID, rating: 4 });
      expect(eventEmitter.emit).toHaveBeenCalledWith('provider.metrics.update', { providerId: PROVIDER_ID });
    });

    it('emits REVIEW_RECEIVED notification to provider', async () => {
      prisma.booking.findUnique.mockResolvedValue(mockCompletedBooking);
      repo.create.mockResolvedValue(mockReview);

      await service.create(REVIEWER_ID, { bookingId: BOOKING_ID, rating: 5 });
      expect(eventEmitter.emit).toHaveBeenCalledWith('notification.send', expect.objectContaining({
        userId: PROVIDER_ID, type: 'REVIEW_RECEIVED',
      }));
    });

    it('creates review with image attachments', async () => {
      prisma.booking.findUnique.mockResolvedValue(mockCompletedBooking);
      repo.create.mockResolvedValue({ ...mockReview, images: [{ url: 's3://bucket/photo.jpg' }] });

      const result = await service.create(REVIEWER_ID, {
        bookingId: BOOKING_ID, rating: 5, images: ['s3://bucket/photo.jpg'],
      });

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
        images: { create: [{ url: 's3://bucket/photo.jpg' }] },
      }));
    });

    it('throws NotFoundException when booking not found', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);
      await expect(service.create(REVIEWER_ID, { bookingId: 'bad', rating: 5 }))
        .rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when non-customer tries to review', async () => {
      prisma.booking.findUnique.mockResolvedValue(mockCompletedBooking);
      await expect(service.create(PROVIDER_ID, { bookingId: BOOKING_ID, rating: 5 }))
        .rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when booking is not COMPLETED', async () => {
      prisma.booking.findUnique.mockResolvedValue({ ...mockCompletedBooking, status: 'IN_PROGRESS' });
      await expect(service.create(REVIEWER_ID, { bookingId: BOOKING_ID, rating: 5 }))
        .rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when booking already has a review', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        ...mockCompletedBooking, review: { id: 'existing-review' },
      });
      await expect(service.create(REVIEWER_ID, { bookingId: BOOKING_ID, rating: 3 }))
        .rejects.toThrow(BadRequestException);
    });
  });

  // ── getServiceReviews ─────────────────────────────────────────────────────

  describe('getServiceReviews', () => {
    it('returns paginated reviews for a service', async () => {
      repo.findByService.mockResolvedValue([mockReview]);
      repo.countByService.mockResolvedValue(1);

      const result = await service.getServiceReviews(SERVICE_ID);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('handles second page correctly', async () => {
      repo.findByService.mockResolvedValue([]);
      repo.countByService.mockResolvedValue(10);

      const result = await service.getServiceReviews(SERVICE_ID, 2, 10);
      expect(result.meta.page).toBe(2);
      expect(result.meta.total).toBe(10);
    });
  });

  // ── getProviderReviews ────────────────────────────────────────────────────

  describe('getProviderReviews', () => {
    it('returns paginated reviews for a provider', async () => {
      repo.findByProvider.mockResolvedValue([mockReview]);
      repo.countByProvider.mockResolvedValue(1);

      const result = await service.getProviderReviews(PROVIDER_ID);
      expect(result.data).toHaveLength(1);
    });

    it('returns empty page when provider has no reviews', async () => {
      repo.findByProvider.mockResolvedValue([]);
      repo.countByProvider.mockResolvedValue(0);

      const result = await service.getProviderReviews(PROVIDER_ID);
      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });
});
