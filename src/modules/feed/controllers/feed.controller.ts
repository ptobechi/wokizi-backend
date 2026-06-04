import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FeedService } from '../services/feed.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('Feed')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('feed')
export class FeedController {
  constructor(private feedService: FeedService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get hyperlocal ranked service feed' })
  @ApiQuery({ name: 'lat', required: false, type: Number })
  @ApiQuery({ name: 'lng', required: false, type: Number })
  @ApiQuery({ name: 'radius', required: false, type: Number })
  @ApiQuery({ name: 'categoryId', required: false })
  getFeed(
    @CurrentUser('id') userId: string,
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radius') radius: number,
    @Query('categoryId') categoryId: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.feedService.getFeed(userId, { lat, lng, radius, categoryId, page, limit });
  }
}
