import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { DisputesService } from '../services/disputes.service';
import { CreateDisputeDto, ResolveDisputeDto } from '../dto/requests/create-dispute.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ParseUUIDPipe } from '../../../common/pipes/parse-uuid.pipe';

@ApiTags('Disputes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('disputes')
export class DisputesController {
  constructor(private disputesService: DisputesService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateDisputeDto) {
    return this.disputesService.create(userId, dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.disputesService.findById(id, userId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get()
  listAll(@Query('status') status: any, @Query('page') page: number, @Query('limit') limit: number) {
    return this.disputesService.listAll(status, page, limit);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post(':id/resolve')
  resolve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') resolvedBy: string, @Body() dto: ResolveDisputeDto) {
    return this.disputesService.resolve(id, resolvedBy, dto);
  }
}
