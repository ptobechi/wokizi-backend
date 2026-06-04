import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { BookingsService } from '../services/bookings.service';
import { CreateBookingDto, UpdateBookingStatusDto } from '../dto/requests/create-booking.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { ParseUUIDPipe } from '../../../common/pipes/parse-uuid.pipe';

@ApiTags('Bookings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('bookings')
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(userId, dto);
  }

  @Get('me')
  @ApiQuery({ name: 'role', enum: ['customer', 'provider'] })
  findMine(@CurrentUser('id') userId: string, @Query('role') role: 'customer' | 'provider', @Query('status') status: string, @Query('page') page: number, @Query('limit') limit: number) {
    return this.bookingsService.findMine(userId, role || 'customer', status, page, limit);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.bookingsService.findById(id, userId);
  }

  @Patch(':id/status')
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string, @Body() dto: UpdateBookingStatusDto) {
    return this.bookingsService.updateStatus(id, userId, dto);
  }

  @Public()
  @Get('services/:serviceId/availability')
  @ApiQuery({ name: 'date', type: String })
  checkAvailability(@Param('serviceId') serviceId: string, @Query('date') date: string) {
    return this.bookingsService.checkAvailability(serviceId, date);
  }
}
