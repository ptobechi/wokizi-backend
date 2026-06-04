import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SavedServicesService } from '../services/saved-services.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ParseUUIDPipe } from '../../../common/pipes/parse-uuid.pipe';

@ApiTags('Social')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('saved-services')
export class SavedServicesController {
  constructor(private savedServicesService: SavedServicesService) {}

  @Get()
  @ApiOperation({ summary: 'Get my saved services' })
  getMySaved(@CurrentUser('id') userId: string, @Query('page') page: number, @Query('limit') limit: number) {
    return this.savedServicesService.getMySaved(userId, page, limit);
  }

  @Post(':serviceId')
  @ApiOperation({ summary: 'Toggle save on a service' })
  toggle(@CurrentUser('id') userId: string, @Param('serviceId', ParseUUIDPipe) serviceId: string) {
    return this.savedServicesService.toggle(userId, serviceId);
  }
}
