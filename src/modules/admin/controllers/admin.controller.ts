import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AdminService } from '../services/admin.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ParseUUIDPipe } from '../../../common/pipes/parse-uuid.pipe';
import { WithdrawalsService } from '../../withdrawals/services/withdrawals.service';
import { WalletService } from '../../wallet/services/wallet.service';
import { PaymentsService } from '../../payments/services/payments.service';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

class SuspendUserDto      { @IsString() reason: string; }
class ReviewServiceDto    { @IsString() action: 'APPROVED' | 'REJECTED' | 'SUSPENDED'; @IsOptional() @IsString() reason?: string; }
class ReviewVerifyDto     { @IsString() @IsIn(['APPROVED', 'REJECTED']) action: 'APPROVED' | 'REJECTED'; @IsOptional() @IsString() reason?: string; }
class ResolveDisputeDto   {
  @IsString() @IsIn(['RESOLVED_FOR_CUSTOMER', 'RESOLVED_FOR_PROVIDER']) outcome: 'RESOLVED_FOR_CUSTOMER' | 'RESOLVED_FOR_PROVIDER';
  @IsString() resolution: string;
  @IsOptional() @IsString() notes?: string;
}
class UpdateTicketDto     { @IsOptional() @IsString() status?: string; @IsOptional() @IsString() adminNote?: string; }
class BroadcastNotifDto   { @IsString() title: string; @IsString() body: string; @IsString() target: 'ALL' | 'PROVIDERS' | 'CUSTOMERS'; @IsOptional() userIds?: string[]; }
class CreateCategoryDto   { @IsString() name: string; @IsString() slug: string; @IsOptional() @IsString() description?: string; @IsOptional() @IsString() iconUrl?: string; }
class UpdateCategoryDto   { @IsOptional() @IsString() name?: string; @IsOptional() @IsString() description?: string; @IsOptional() @IsString() iconUrl?: string; @IsOptional() isActive?: boolean; }
class ProcessWithdrawalDto { @IsString() action: 'APPROVE' | 'REJECT'; @IsOptional() @IsString() adminNote?: string; }

// ─── Controller ───────────────────────────────────────────────────────────────

@ApiTags('Admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth('access-token')
@Controller('admin')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private withdrawalsService: WithdrawalsService,
    private walletService: WalletService,
    private paymentsService: PaymentsService,
  ) {}

  // ── Dashboard ─────────────────────────────────────────────────────────────

  @Get('dashboard')
  @ApiOperation({ summary: 'Get platform dashboard stats' })
  getDashboard() { return this.adminService.getDashboardStats(); }

  // ── Users ─────────────────────────────────────────────────────────────────

  @Get('users')
  @ApiOperation({ summary: 'List all users with filters' })
  listUsers(
    @Query('role') role?: string,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listUsers({
      role,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      search,
      page:  Number(page)  || 1,
      limit: Number(limit) || 20,
    });
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user detail' })
  getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Post('users/:id/suspend')
  @ApiOperation({ summary: 'Suspend a user' })
  suspendUser(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() dto: SuspendUserDto,
  ) {
    return this.adminService.suspendUser(adminId, userId, dto.reason);
  }

  @Post('users/:id/unsuspend')
  @ApiOperation({ summary: 'Unsuspend a user' })
  unsuspendUser(@Param('id', ParseUUIDPipe) userId: string) {
    return this.adminService.unsuspendUser(userId);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Post('users/:id/promote')
  @ApiOperation({ summary: '[SuperAdmin] Promote user to Admin' })
  promote(@Param('id', ParseUUIDPipe) userId: string) {
    return this.adminService.promoteToAdmin(userId);
  }

  // ── Services ─────────────────────────────────────────────────────────────

  @Get('services')
  @ApiOperation({ summary: 'List all service listings' })
  listServices(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listServices({ status, page: Number(page) || 1, limit: Number(limit) || 20 });
  }

  @Patch('services/:id/review')
  @ApiOperation({ summary: 'Approve / reject / suspend a service listing' })
  reviewService(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: ReviewServiceDto,
  ) {
    return this.adminService.reviewService(id, adminId, dto.action, dto.reason);
  }

  // ── Bookings ─────────────────────────────────────────────────────────────

  @Get('bookings')
  @ApiOperation({ summary: 'List all bookings' })
  listBookings(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listBookings({ status, search, page: Number(page) || 1, limit: Number(limit) || 20 });
  }

  @Get('bookings/:id')
  @ApiOperation({ summary: 'Get booking detail' })
  getBooking(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getBookingDetail(id);
  }

  // ── Disputes ─────────────────────────────────────────────────────────────

  @Get('disputes')
  @ApiOperation({ summary: 'List all disputes' })
  listDisputes(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listDisputes({ status, page: Number(page) || 1, limit: Number(limit) || 20 });
  }

  @Get('disputes/:id')
  @ApiOperation({ summary: 'Get dispute detail' })
  getDispute(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getDisputeDetail(id);
  }

  @Patch('disputes/:id/resolve')
  @ApiOperation({ summary: 'Resolve a dispute' })
  resolveDispute(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.adminService.resolveDispute(id, adminId, dto.outcome, dto.resolution, dto.notes);
  }

  // ── Reviews ───────────────────────────────────────────────────────────────

  @Get('reviews')
  @ApiOperation({ summary: 'List all reviews' })
  listReviews(
    @Query('minRating') minRating?: string,
    @Query('maxRating') maxRating?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listReviews({
      minRating: minRating ? Number(minRating) : undefined,
      maxRating: maxRating ? Number(maxRating) : undefined,
      page:  Number(page)  || 1,
      limit: Number(limit) || 20,
    });
  }

  @Delete('reviews/:id')
  @ApiOperation({ summary: 'Remove a review' })
  deleteReview(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deleteReview(id);
  }

  // ── Analytics ─────────────────────────────────────────────────────────────

  @Get('analytics')
  @ApiOperation({ summary: 'Platform analytics' })
  getAnalytics(@Query('period') period?: 'week' | 'month' | 'year') {
    return this.adminService.getAnalytics(period || 'month');
  }

  // ── Audit Logs ────────────────────────────────────────────────────────────

  @Get('audit-logs')
  @ApiOperation({ summary: 'List audit log entries' })
  getAuditLogs(
    @Query('action') action?: string,
    @Query('userId') userId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listAuditLogs({ action, userId, page: Number(page) || 1, limit: Number(limit) || 50 });
  }

  // ── Verifications ─────────────────────────────────────────────────────────

  @Get('verifications')
  @ApiOperation({ summary: 'List KYC verification submissions' })
  listVerifications(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listVerifications({ status, page: Number(page) || 1, limit: Number(limit) || 20 });
  }

  @Patch('verifications/:id/review')
  @ApiOperation({ summary: 'Approve or reject a KYC verification' })
  reviewVerification(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: ReviewVerifyDto,
  ) {
    return this.adminService.reviewVerification(id, adminId, dto.action, dto.reason);
  }

  // ── Support Tickets ───────────────────────────────────────────────────────

  @Get('support/tickets')
  @ApiOperation({ summary: 'List support tickets' })
  listSupportTickets(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listSupportTickets({ status, page: Number(page) || 1, limit: Number(limit) || 20 });
  }

  @Patch('support/tickets/:id')
  @ApiOperation({ summary: 'Update a support ticket' })
  updateSupportTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.adminService.updateSupportTicket(id, dto);
  }

  // ── Notifications ─────────────────────────────────────────────────────────

  @Post('notifications/broadcast')
  @ApiOperation({ summary: 'Broadcast notification to users' })
  broadcastNotification(@Body() dto: BroadcastNotifDto) {
    return this.adminService.broadcastNotification(dto);
  }

  // ── Categories ────────────────────────────────────────────────────────────

  @Get('categories')
  @ApiOperation({ summary: 'List all categories' })
  listCategories() { return this.adminService.listCategories(); }

  @Post('categories')
  @ApiOperation({ summary: 'Create a new category' })
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.adminService.createCategory(dto);
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Update a category' })
  updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.adminService.updateCategory(id, dto);
  }

  // ── Conversations ─────────────────────────────────────────────────────────

  @Get('conversations')
  @ApiOperation({ summary: 'List all conversations' })
  listConversations(
    @Query('page')   page?:   string,
    @Query('limit')  limit?:  string,
    @Query('status') status?: string,
  ) {
    return this.adminService.listConversations(
      page  ? Number(page)  : 1,
      limit ? Number(limit) : 20,
      status,
    );
  }

  // ── Quotations ────────────────────────────────────────────────────────────

  @Get('quotations')
  @ApiOperation({ summary: 'List all quotations' })
  listQuotations(
    @Query('page')   page?:   string,
    @Query('limit')  limit?:  string,
    @Query('status') status?: string,
  ) {
    return this.adminService.listQuotations(
      page  ? Number(page)  : 1,
      limit ? Number(limit) : 20,
      status as any,
    );
  }

  // ── Finance — Withdrawals ──────────────────────────────────────────────────

  @Get('finance/withdrawals')
  @ApiOperation({ summary: 'List all withdrawal requests' })
  listWithdrawals(
    @Query('status') status?: string,
    @Query('page')   page?:   string,
    @Query('limit')  limit?:  string,
  ) {
    return this.withdrawalsService.adminList(status, page ? Number(page) : 1, limit ? Number(limit) : 20);
  }

  @Patch('finance/withdrawals/:id')
  @ApiOperation({ summary: 'Approve or reject a withdrawal' })
  processWithdrawal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProcessWithdrawalDto,
  ) {
    return this.withdrawalsService.adminProcess(id, dto.action, dto.adminNote);
  }

  // ── Finance — Wallets ──────────────────────────────────────────────────────

  @Get('finance/wallet/:userId')
  @ApiOperation({ summary: 'Get a user wallet balance' })
  getUserWallet(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.walletService.getWallet(userId);
  }

  @Get('finance/wallet/:userId/transactions')
  @ApiOperation({ summary: 'Get a user wallet transaction history' })
  getUserTransactions(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('page')  page?:  string,
    @Query('limit') limit?: string,
  ) {
    return this.walletService.getTransactions(userId, page ? Number(page) : 1, limit ? Number(limit) : 20);
  }

  // ── Finance — Payments ────────────────────────────────────────────────────

  @Get('finance/payments')
  @ApiOperation({ summary: 'List all Paystack payment records' })
  listPayments(
    @Query('status') status?: string,
    @Query('page')   page?:   string,
    @Query('limit')  limit?:  string,
  ) {
    return this.paymentsService.adminListPayments(
      page   ? Number(page)  : 1,
      limit  ? Number(limit) : 20,
      status,
    );
  }

  // ── Finance — Banks ────────────────────────────────────────────────────────

  @Get('finance/banks')
  @ApiOperation({ summary: 'List Nigerian banks from Paystack' })
  listBanks() {
    return this.withdrawalsService.listBanks();
  }
}
