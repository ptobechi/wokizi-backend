import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { ReviewsRepository } from '../repositories/reviews.repository';
import { PaginatedResponseDto } from '../../../common/dto/base-response.dto';
import { EventName } from '../../../common/enums';

export class CreateReviewDto {
  bookingId: string;
  rating: number;
  comment?: string;
  images?: string[];
}

@Injectable()
export class ReviewsService {
  constructor(private repo: ReviewsRepository, private prisma: PrismaService, private eventEmitter: EventEmitter2) {}

  async create(reviewerId: string, dto: CreateReviewDto) {
    const booking = await this.prisma.booking.findUnique({ where: { id: dto.bookingId }, include: { review: true } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.customerId !== reviewerId) throw new ForbiddenException('Only customer can review');
    if (booking.status !== 'COMPLETED') throw new BadRequestException('Can only review completed bookings');
    if (booking.review) throw new BadRequestException('Already reviewed');

    const review = await this.repo.create({
      bookingId: dto.bookingId, serviceId: booking.serviceId,
      reviewerId, providerId: booking.providerId, rating: dto.rating, comment: dto.comment,
      images: dto.images?.length ? { create: dto.images.map(url => ({ url })) } : undefined,
    });

    this.eventEmitter.emit(EventName.PROVIDER_METRICS_UPDATE, { providerId: booking.providerId });
    this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
      userId: booking.providerId, type: 'REVIEW_RECEIVED', title: 'New Review',
      body: `You received a ${dto.rating}-star review`, data: { reviewId: review.id },
    });

    return review;
  }

  async getServiceReviews(serviceId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.repo.findByService(serviceId, skip, limit),
      this.repo.countByService(serviceId),
    ]);
    return PaginatedResponseDto.of(data, total, page, limit);
  }

  async getProviderReviews(providerId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.repo.findByProvider(providerId, skip, limit),
      this.repo.countByProvider(providerId),
    ]);
    return PaginatedResponseDto.of(data, total, page, limit);
  }
}
