import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from '../services/reviews.service';

const mockReviewsService = {
  create: jest.fn(),
  getServiceReviews: jest.fn(),
  getProviderReviews: jest.fn(),
};

describe('ReviewsController', () => {
  let controller: ReviewsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [{ provide: ReviewsService, useValue: mockReviewsService }],
    }).compile();
    controller = module.get(ReviewsController);
  });

  describe('create', () => {
    it('creates a review for a completed booking', async () => {
      const dto = { bookingId: 'b1', rating: 5, comment: 'Excellent work' };
      const review = { id: 'r1', rating: 5, comment: 'Excellent work' };
      mockReviewsService.create.mockResolvedValue(review);

      const result = await controller.create('customer-1', dto as any);

      expect(mockReviewsService.create).toHaveBeenCalledWith('customer-1', dto);
      expect(result).toEqual(review);
    });
  });

  describe('getServiceReviews', () => {
    it('returns paginated reviews for a service listing', async () => {
      const page = {
        data: [{ id: 'r1', rating: 5 }],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      };
      mockReviewsService.getServiceReviews.mockResolvedValue(page);

      const result = await controller.getServiceReviews('s1', 1, 10);

      expect(mockReviewsService.getServiceReviews).toHaveBeenCalledWith('s1', 1, 10);
      expect(result).toEqual(page);
    });
  });

  describe('getProviderReviews', () => {
    it('returns paginated reviews for a provider', async () => {
      const page = {
        data: [{ id: 'r2', rating: 4, comment: 'Good service' }],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      };
      mockReviewsService.getProviderReviews.mockResolvedValue(page);

      const result = await controller.getProviderReviews('provider-1', 1, 10);

      expect(mockReviewsService.getProviderReviews).toHaveBeenCalledWith('provider-1', 1, 10);
      expect(result).toEqual(page);
    });
  });
});
