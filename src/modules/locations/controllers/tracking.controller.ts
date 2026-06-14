import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { TrackingService } from '../services/tracking.service';

class LocationUpdateDto {
  @ApiProperty() @IsNumber() @Type(() => Number) lat: number;
  @ApiProperty() @IsNumber() @Type(() => Number) lng: number;
}

@ApiTags('Tracking')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('tracking')
export class TrackingController {
  constructor(private trackingService: TrackingService) {}

  @Post(':bookingId/start')
  @ApiOperation({ summary: 'Artisan starts tracking for a booking' })
  start(
    @CurrentUser('id') userId: string,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ) {
    return this.trackingService.startTracking(bookingId, userId);
  }

  @Post(':bookingId/location')
  @ApiOperation({ summary: 'Artisan pushes a location update' })
  updateLocation(
    @CurrentUser('id') userId: string,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: LocationUpdateDto,
  ) {
    return this.trackingService.updateLocation(userId, bookingId, dto.lat, dto.lng);
  }

  @Post(':bookingId/arrived')
  @ApiOperation({ summary: 'Artisan signals they have arrived at the job' })
  arrived(
    @CurrentUser('id') userId: string,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ) {
    return this.trackingService.notifyArrived(userId, bookingId);
  }

  @Post(':bookingId/stop')
  @ApiOperation({ summary: 'Stop tracking session' })
  stop(
    @CurrentUser('id') userId: string,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ) {
    return this.trackingService.stopTracking(userId, bookingId);
  }

  @Get(':bookingId/session')
  @ApiOperation({ summary: 'Get active tracking session for a booking' })
  getSession(@Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.trackingService.getSession(bookingId);
  }
}
