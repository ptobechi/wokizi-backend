import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { NotificationsService } from '../services/notifications.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

class RegisterDeviceDto {
  @IsString() token: string;
  @IsString() deviceId: string;
  @IsOptional() @IsString() deviceType?: string;
}

@ApiTags('Notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Post('register-token')
  @ApiOperation({ summary: 'Register or refresh this device\'s Expo push token' })
  registerToken(@CurrentUser('id') userId: string, @Body() dto: RegisterDeviceDto) {
    return this.notificationsService.registerDevice(userId, dto);
  }

  @Get()
  getMine(@CurrentUser('id') userId: string, @Query('page') page: number, @Query('limit') limit: number) {
    return this.notificationsService.getMine(userId, page, limit);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser('id') userId: string) {
    return this.notificationsService.getUnreadCount(userId);
  }

  @Patch(':id/read')
  markRead(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.notificationsService.markRead(userId, id);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllRead(userId);
  }

  @Get('preferences')
  getPrefs(@CurrentUser('id') userId: string) {
    return this.notificationsService.getPreferences(userId);
  }

  @Patch('preferences')
  updatePrefs(@CurrentUser('id') userId: string, @Body() body: any) {
    return this.notificationsService.updatePreferences(userId, body);
  }
}
