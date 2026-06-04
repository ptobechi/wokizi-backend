import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReviewsService, CreateReviewDto } from '../services/reviews.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { ParseUUIDPipe } from '../../../common/pipes/parse-uuid.pipe';

@ApiTags('Reviews')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('reviews')
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(userId, dto);
  }

  @Public()
  @Get('services/:serviceId')
  getServiceReviews(@Param('serviceId', ParseUUIDPipe) serviceId: string, @Query('page') page: number, @Query('limit') limit: number) {
    return this.reviewsService.getServiceReviews(serviceId, page, limit);
  }

  @Public()
  @Get('providers/:providerId')
  getProviderReviews(@Param('providerId', ParseUUIDPipe) providerId: string, @Query('page') page: number, @Query('limit') limit: number) {
    return this.reviewsService.getProviderReviews(providerId, page, limit);
  }
}
