import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReportsService } from '../services/reports.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@ApiTags('Reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Post()
  @ApiOperation({ summary: 'Report content or a user' })
  report(@CurrentUser('id') userId: string, @Body() body: { targetType: string; targetId: string; reason: string }) {
    return this.reportsService.reportContent(userId, body);
  }
}
