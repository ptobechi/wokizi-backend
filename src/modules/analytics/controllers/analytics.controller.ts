import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from '../services/analytics.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@ApiTags('Analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('provider')
  @ApiOperation({ summary: 'Get my provider analytics' })
  getProvider(@CurrentUser('id') userId: string, @Query('days') days: number) {
    return this.analyticsService.getProviderAnalytics(userId, days || 30);
  }
}
