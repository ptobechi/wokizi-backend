import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ServiceRequestsService } from '../services/service-requests.service';
import { AdjustPriceDto, CreateServiceRequestDto, DeclineServiceRequestDto } from '../dto/requests/service-request.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ParseUUIDPipe } from '../../../common/pipes/parse-uuid.pipe';

@ApiTags('Service Requests')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('service-requests')
export class ServiceRequestsController {
  constructor(private serviceRequestsService: ServiceRequestsService) {}

  @Post()
  @ApiOperation({ summary: 'Send a service request to a provider' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateServiceRequestDto) {
    return this.serviceRequestsService.create(userId, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'List my service requests (as customer or provider)' })
  @ApiQuery({ name: 'role', enum: ['provider', 'customer'], required: false })
  getMine(
    @CurrentUser('id') userId: string,
    @Query('role') role: 'provider' | 'customer',
    @Query('status') status: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return role === 'provider'
      ? this.serviceRequestsService.findForProvider(userId, status, page, limit)
      : this.serviceRequestsService.findForCustomer(userId, status, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single service request' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.serviceRequestsService.findById(id, userId);
  }

  @Patch(':id/accept')
  @ApiOperation({ summary: 'Provider accepts a request, optionally adjusting the price' })
  accept(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: AdjustPriceDto,
  ) {
    return this.serviceRequestsService.accept(id, userId, dto);
  }

  @Patch(':id/decline')
  @ApiOperation({ summary: 'Provider declines a request' })
  decline(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: DeclineServiceRequestDto,
  ) {
    return this.serviceRequestsService.decline(id, userId, dto);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Customer cancels their own pending request' })
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.serviceRequestsService.cancel(id, userId);
  }

  @Patch(':id/price/confirm')
  @ApiOperation({ summary: "Customer confirms the provider's adjusted price" })
  confirmPrice(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.serviceRequestsService.confirmPrice(id, userId);
  }

  @Patch(':id/price/decline')
  @ApiOperation({ summary: "Customer declines the provider's adjusted price" })
  declinePrice(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: DeclineServiceRequestDto,
  ) {
    return this.serviceRequestsService.declinePrice(id, userId, dto.reason);
  }
}
