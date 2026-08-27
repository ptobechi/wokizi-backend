import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { ReviewsRepository } from '../repositories/reviews.repository';
import { PaginatedResponseDto } from '../../../common/dto/base-response.dto';
import { EventName } from '../../../common/enums';
import { BookingsService } from '../../bookings/services/bookings.service';

export class CreateReviewDto {
  @ApiProperty() @IsString() bookingId: string;
  @ApiProperty({ minimum: 1, maximum: 5 }) @IsInt() @Min(1) @Max(5) rating: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) comment?: string;

  @ApiPropertyOptional({ type: [String], description: 'Already-uploaded image URLs (max 8)' })
  @IsOptional() @IsArray() @ArrayMaxSize(8) @IsString({ each: true })
  images?: string[];
}

@Injectable()
export class ReviewsService {
  constructor(
    private repo: ReviewsRepository,
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private bookingsService: BookingsService,
  ) {}

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

    // The review is the gate: a booking cannot reach CLOSED (and escrow
    // cannot release) until either this happens or a dispute is resolved.
    await this.bookingsService.close(dto.bookingId, 'RELEASE');

    const reviewerProfile = await this.prisma.userProfile.findUnique({
      where: { userId: reviewerId }, select: { displayName: true },
    });

    this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
      userId:   booking.providerId,
      type:     'REVIEW_RECEIVED',
      ctx:      { userName: reviewerProfile?.displayName, rating: dto.rating },
      linkData: { reviewId: review.id, bookingId: dto.bookingId },
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
