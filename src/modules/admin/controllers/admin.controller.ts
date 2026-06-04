import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AdminService } from '../services/admin.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ParseUUIDPipe } from '../../../common/pipes/parse-uuid.pipe';

class SuspendUserDto { @IsString() reason: string; }
class ReviewServiceDto { @IsString() action: 'APPROVED' | 'REJECTED' | 'SUSPENDED'; @IsOptional() @IsString() reason?: string; }

@ApiTags('Admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth('access-token')
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('dashboard') getDashboard() { return this.adminService.getDashboardStats(); }

  @Get('users') listUsers(@Query('role') role: string, @Query('isActive') isActive: boolean, @Query('search') search: string, @Query('page') page: number, @Query('limit') limit: number) {
    return this.adminService.listUsers({ role, isActive, search, page, limit });
  }

  @Post('users/:id/suspend')
  suspendUser(@CurrentUser('id') adminId: string, @Param('id', ParseUUIDPipe) userId: string, @Body() dto: SuspendUserDto) {
    return this.adminService.suspendUser(adminId, userId, dto.reason);
  }

  @Post('users/:id/unsuspend')
  unsuspendUser(@Param('id', ParseUUIDPipe) userId: string) { return this.adminService.unsuspendUser(userId); }

  @Roles(UserRole.SUPER_ADMIN)
  @Post('users/:id/promote')
  promote(@Param('id', ParseUUIDPipe) userId: string) { return this.adminService.promoteToAdmin(userId); }

  @Get('services') listServices(@Query('status') status: string, @Query('page') page: number, @Query('limit') limit: number) {
    return this.adminService.listServices({ status, page, limit });
  }

  @Patch('services/:id/review')
  reviewService(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') adminId: string, @Body() dto: ReviewServiceDto) {
    return this.adminService.reviewService(id, adminId, dto.action, dto.reason);
  }
}
