import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ServiceListingsService } from '../services/service-listings.service';
import { CreateServiceDto, UpdateServiceDto } from '../dto/requests/create-service.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { ParseUUIDPipe } from '../../../common/pipes/parse-uuid.pipe';

@ApiTags('Services')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('services')
export class ServicesController {
  constructor(private service: ServiceListingsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a service listing' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateServiceDto) {
    return this.service.create(userId, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get my service listings' })
  findMine(@CurrentUser('id') userId: string, @Query('page') page: number, @Query('limit') limit: number) {
    return this.service.findMyServices(userId, page, limit);
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get service by slug (public)' })
  findOne(@Param('slug') slug: string, @CurrentUser('id') requesterId: string) {
    return this.service.findOne(slug, requesterId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a service listing' })
  update(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string, @Body() dto: UpdateServiceDto) {
    return this.service.update(id, userId, dto);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit for review' })
  submit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.service.submit(id, userId);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish approved service' })
  publish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.service.publish(id, userId);
  }

  @Post(':id/unpublish')
  @ApiOperation({ summary: 'Unpublish service' })
  unpublish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.service.unpublish(id, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a service listing' })
  delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.service.delete(id, userId);
  }
}
