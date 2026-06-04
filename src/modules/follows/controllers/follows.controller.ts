import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FollowsService } from '../services/follows.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ParseUUIDPipe } from '../../../common/pipes/parse-uuid.pipe';

@ApiTags('Social')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('follows')
export class FollowsController {
  constructor(private followsService: FollowsService) {}

  @Post(':userId')
  @ApiOperation({ summary: 'Follow or unfollow a user (toggle)' })
  toggle(@CurrentUser('id') followerId: string, @Param('userId', ParseUUIDPipe) followingId: string) {
    return this.followsService.toggle(followerId, followingId);
  }

  @Get('followers')
  getFollowers(@CurrentUser('id') userId: string, @Query('page') page: number, @Query('limit') limit: number) {
    return this.followsService.getFollowers(userId, page, limit);
  }

  @Get('following')
  getFollowing(@CurrentUser('id') userId: string, @Query('page') page: number, @Query('limit') limit: number) {
    return this.followsService.getFollowing(userId, page, limit);
  }

  @Get('check/:userId')
  isFollowing(@CurrentUser('id') followerId: string, @Param('userId', ParseUUIDPipe) followingId: string) {
    return this.followsService.isFollowing(followerId, followingId);
  }
}
