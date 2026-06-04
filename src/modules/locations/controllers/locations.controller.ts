import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { LocationsService } from '../services/locations.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';

class UpdateLocationDto {
  @ApiProperty() @IsNumber() @Type(() => Number) lat: number;
  @ApiProperty() @IsNumber() @Type(() => Number) lng: number;
}

@ApiTags('Locations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('locations')
export class LocationsController {
  constructor(private locationsService: LocationsService) {}

  @Public()
  @Get('nearby')
  @ApiOperation({ summary: 'Find nearby service providers' })
  @ApiQuery({ name: 'lat', type: Number })
  @ApiQuery({ name: 'lng', type: Number })
  @ApiQuery({ name: 'radius', required: false, type: Number })
  findNearby(@Query('lat') lat: number, @Query('lng') lng: number, @Query('radius') radius: number) {
    return this.locationsService.findNearbyProviders(lat, lng, radius || 10);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update my current location' })
  updateLocation(@CurrentUser('id') userId: string, @Body() dto: UpdateLocationDto) {
    return this.locationsService.updateUserLocation(userId, dto.lat, dto.lng);
  }
}
