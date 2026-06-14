import {
  Body, Controller, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { SupportService } from '../services/support.service';
import { CreateTicketDto } from '../dto/create-ticket.dto';
import { UpdateTicketDto } from '../dto/update-ticket.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ParseUUIDPipe } from '../../../common/pipes/parse-uuid.pipe';

@ApiTags('Support')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('support')
export class SupportController {
  constructor(private supportService: SupportService) {}

  @Post('tickets')
  @ApiOperation({ summary: 'Submit a support ticket' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateTicketDto) {
    return this.supportService.createTicket(userId, dto);
  }

  @Get('tickets')
  @ApiOperation({ summary: 'Get my support tickets' })
  getMyTickets(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.supportService.getMyTickets(userId, Number(page) || 1, Number(limit) || 20);
  }

  @Get('tickets/:id')
  @ApiOperation({ summary: 'Get a specific support ticket' })
  getOne(
    @Param('id', ParseUUIDPipe) ticketId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.supportService.getTicketById(ticketId, userId, role !== UserRole.USER);
  }

  // ── Admin ──────────────────────────────────────────────────────────────

  @Get('admin/tickets')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] List all support tickets' })
  adminList(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.supportService.listAllTickets({
      status: status as any,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
  }

  @Patch('admin/tickets/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Update ticket status / add admin note' })
  adminUpdate(
    @Param('id', ParseUUIDPipe) ticketId: string,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.supportService.updateTicket(ticketId, dto);
  }
}
