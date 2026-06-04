import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LikesService } from '../services/likes.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ParseUUIDPipe } from '../../../common/pipes/parse-uuid.pipe';

@ApiTags('Social')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('likes')
export class LikesController {
  constructor(private likesService: LikesService) {}

  @Post('services/:serviceId')
  @ApiOperation({ summary: 'Toggle like on a service' })
  toggle(@CurrentUser('id') userId: string, @Param('serviceId', ParseUUIDPipe) serviceId: string) {
    return this.likesService.toggle(userId, serviceId);
  }
}
