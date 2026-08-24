import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ServiceStatus, UserRole, DisputeStatus, VerificationStatus, QuotationStatus } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { PaginatedResponseDto } from '../../../common/dto/base-response.dto';
import { EventName } from '../../../common/enums';
import { publishFields, unpublishFields, suspendPublicationFields } from '../../services/utils/service-publication.util';

// ─── Shared helpers ───────────────────────────────────────────────────────────

const USER_PUBLIC_SELECT = {
  id: true, phone: true, email: true, role: true,
  isActive: true, isSuspended: true, isEmailVerified: true,
  suspendedReason: true, lastLoginAt: true, createdAt: true,
  profile: { select: { displayName: true, avatarUrl: true, city: true, state: true, isProvider: true, avgRating: true, totalReviews: true, completedJobs: true } },
  verification: { select: { status: true } },
};

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  // ── Dashboard ───────────────────────────────────────────────────────────────

  async getDashboardStats() {
    const [
      totalUsers, totalProviders, totalServices, pendingServices,
      pendingVerifications, totalBookings, completedBookings,
      openDisputes, newUsersToday, openSupportTickets,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.userProfile.count({ where: { isProvider: true } }),
      this.prisma.serviceListing.count({ where: { deletedAt: null } }),
      this.prisma.serviceListing.count({ where: { status: 'PENDING_REVIEW' } }),
      this.prisma.verification.count({ where: { status: 'PENDING' } }),
      this.prisma.booking.count(),
      this.prisma.booking.count({ where: { status: 'COMPLETED' } }),
      this.prisma.dispute.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
      this.prisma.user.count({ where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }, deletedAt: null } }),
      this.prisma.supportTicket.count({ where: { status: 'OPEN' } }),
    ]);

    return {
      users: { total: totalUsers, providers: totalProviders, newToday: newUsersToday },
      services: { total: totalServices, pendingReview: pendingServices },
      bookings: {
        total: totalBookings,
        completed: completedBookings,
        completionRate: totalBookings > 0 ? ((completedBookings / totalBookings) * 100).toFixed(1) : 0,
      },
      pendingVerifications,
      openDisputes,
      openSupportTickets,
    };
  }

  // ── Users ───────────────────────────────────────────────────────────────────

  async listUsers(filters: { role?: string; isActive?: boolean; search?: string; page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where: any = { deletedAt: null };
    if (filters.role) where.role = filters.role;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.search) {
      where.OR = [
        { email: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search } },
        { profile: { displayName: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: { ...USER_PUBLIC_SELECT, _count: { select: { services: true, bookingsAsCustomer: true } } },
        skip, take: limit, orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);
    return PaginatedResponseDto.of(data, total, page, limit);
  }

  async getUserDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...USER_PUBLIC_SELECT,
        failedLoginAttempts: true,
        lockedUntil: true,
        updatedAt: true,
        devices:  { select: { deviceType: true, deviceName: true, lastSeenAt: true, isActive: true }, where: { isActive: true }, orderBy: { lastSeenAt: 'desc' } },
        verification: {
          select: {
            id: true, status: true, submittedAt: true, reviewedAt: true, rejectionReason: true,
            documents: { select: { id: true, documentType: true, fileUrl: true, createdAt: true } },
          },
        },
        services: { select: { id: true, title: true, status: true, startingPrice: true, createdAt: true }, take: 10, orderBy: { createdAt: 'desc' } },
        _count: { select: { services: true, bookingsAsCustomer: true, bookingsAsProvider: true, reviewsGiven: true, reviewsReceived: true, followers: true, following: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async suspendUser(adminId: string, userId: string, reason: string) {
    if (adminId === userId) throw new BadRequestException('Cannot suspend yourself');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.SUPER_ADMIN) throw new ForbiddenException('Cannot suspend super admin');
    await this.prisma.user.update({ where: { id: userId }, data: { isSuspended: true, suspendedReason: reason } });
    this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
      userId, type: 'SECURITY_ALERT',
      ctx: {}, linkData: {},
    });
    return { message: 'User suspended' };
  }

  async unsuspendUser(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { isSuspended: false, suspendedReason: null } });
    return { message: 'User unsuspended' };
  }

  async promoteToAdmin(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { role: UserRole.ADMIN },
      select: { id: true, email: true, phone: true, role: true },
    });
  }

  // ── Services ────────────────────────────────────────────────────────────────

  async listServices(filters: { status?: string; page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where: any = { deletedAt: null };
    if (filters.status) where.status = filters.status;
    const [data, total] = await Promise.all([
      this.prisma.serviceListing.findMany({
        where,
        include: {
          provider: { select: { id: true, email: true, phone: true, profile: { select: { displayName: true, avatarUrl: true } } } },
          category: { select: { name: true, slug: true } },
          images:   { where: { isPrimary: true }, take: 1 },
          _count:   { select: { bookings: true, reviews: true } },
        },
        skip, take: limit, orderBy: { createdAt: 'desc' },
      }),
      this.prisma.serviceListing.count({ where }),
    ]);
    return PaginatedResponseDto.of(data, total, page, limit);
  }

  async reviewService(serviceId: string, adminId: string, action: 'APPROVED' | 'REJECTED' | 'SUSPENDED', reason?: string) {
    const service = await this.prisma.serviceListing.findUnique({ where: { id: serviceId } });
    if (!service) throw new NotFoundException('Service not found');
    const statusMap: Record<string, ServiceStatus> = { APPROVED: ServiceStatus.APPROVED, REJECTED: ServiceStatus.REJECTED, SUSPENDED: ServiceStatus.SUSPENDED };

    // Approval must publish the service immediately — see service-publication.util.ts
    // for why these three transitions are centralized in one place.
    const publicationFields =
      action === 'APPROVED' ? publishFields()
      : action === 'SUSPENDED' ? suspendPublicationFields()
      : unpublishFields(); // REJECTED

    const updated = await this.prisma.serviceListing.update({
      where: { id: serviceId },
      data: {
        status: statusMap[action], reviewedBy: adminId, reviewedAt: new Date(),
        rejectionReason: action !== 'APPROVED' ? reason : null,
        ...publicationFields,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: `SERVICE_${action}`,
        resource: 'ServiceListing',
        resourceId: serviceId,
        oldData: { status: service.status, isPublished: service.isPublished, publishedAt: service.publishedAt },
        newData: { status: updated.status, isPublished: updated.isPublished, publishedAt: updated.publishedAt },
      },
    });

    const notifMap: Record<string, string> = { APPROVED: 'SERVICE_APPROVED', REJECTED: 'SERVICE_REJECTED', SUSPENDED: 'SERVICE_SUSPENDED' };
    this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
      userId: service.providerId, type: notifMap[action],
      ctx: { serviceName: service.title, rejectionReason: reason }, linkData: { serviceId },
    });
    return updated;
  }

  // ── Bookings ────────────────────────────────────────────────────────────────

  async listBookings(filters: { status?: string; page?: number; limit?: number; search?: string }) {
    const { page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.OR = [
        { customer: { phone: { contains: filters.search } } },
        { provider: { phone: { contains: filters.search } } },
        { service:  { title: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          customer:  { select: { id: true, phone: true, profile: { select: { displayName: true, avatarUrl: true } } } },
          provider:  { select: { id: true, phone: true, profile: { select: { displayName: true, avatarUrl: true } } } },
          service:   { select: { id: true, title: true, category: { select: { name: true } } } },
          quotation: { select: { totalAmount: true, status: true } },
        },
        skip, take: limit, orderBy: { createdAt: 'desc' },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return PaginatedResponseDto.of(data, total, page, limit);
  }

  async getBookingDetail(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer:  { select: { id: true, phone: true, email: true, profile: { select: { displayName: true, avatarUrl: true } } } },
        provider:  { select: { id: true, phone: true, email: true, profile: { select: { displayName: true, avatarUrl: true } } } },
        service:   { select: { id: true, title: true, description: true, startingPrice: true, category: { select: { name: true } } } },
        quotation: { include: { items: true } },
        dispute:   { select: { id: true, status: true, reason: true, createdAt: true } },
        trackingSession: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  // ── Disputes ────────────────────────────────────────────────────────────────

  async listDisputes(filters: { status?: string; page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (filters.status) where.status = filters.status;
    const [data, total] = await Promise.all([
      this.prisma.dispute.findMany({
        where,
        include: {
          raisedBy: { select: { id: true, phone: true, profile: { select: { displayName: true, avatarUrl: true } } } },
          provider: { select: { id: true, phone: true, profile: { select: { displayName: true, avatarUrl: true } } } },
          booking:  { select: { id: true, service: { select: { title: true } }, quotation: { select: { totalAmount: true } } } },
          evidence: { select: { id: true, fileUrl: true, fileName: true, uploadedBy: true } },
        },
        skip, take: limit, orderBy: { createdAt: 'desc' },
      }),
      this.prisma.dispute.count({ where }),
    ]);
    return PaginatedResponseDto.of(data, total, page, limit);
  }

  async getDisputeDetail(disputeId: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        raisedBy: { select: { id: true, phone: true, email: true, profile: { select: { displayName: true, avatarUrl: true } } } },
        provider: { select: { id: true, phone: true, email: true, profile: { select: { displayName: true, avatarUrl: true } } } },
        booking:  {
          include: {
            service:   { select: { id: true, title: true } },
            quotation: { include: { items: true } },
          },
        },
        evidence: true,
      },
    });
    if (!dispute) throw new NotFoundException('Dispute not found');
    return dispute;
  }

  async resolveDispute(disputeId: string, adminId: string, resolution: string, notes?: string) {
    const dispute = await this.prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!dispute) throw new NotFoundException('Dispute not found');
    const updated = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: { status: DisputeStatus.RESOLVED, resolution, adminNotes: notes, resolvedBy: adminId, resolvedAt: new Date() },
    });
    this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
      userId: dispute.raisedById, type: 'DISPUTE_RESOLVED',
      ctx: { resolution }, linkData: { disputeId },
    });
    this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
      userId: dispute.providerId, type: 'DISPUTE_RESOLVED',
      ctx: { resolution }, linkData: { disputeId },
    });
    return updated;
  }

  // ── Reviews ─────────────────────────────────────────────────────────────────

  async listReviews(filters: { page?: number; limit?: number; minRating?: number; maxRating?: number }) {
    const { page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (filters.minRating) where.rating = { gte: filters.minRating };
    if (filters.maxRating) where.rating = { ...where.rating, lte: filters.maxRating };
    const [data, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: {
          reviewer: { select: { id: true, phone: true, profile: { select: { displayName: true, avatarUrl: true } } } },
          provider: { select: { id: true, phone: true, profile: { select: { displayName: true } } } },
          service:  { select: { id: true, title: true } },
        },
        skip, take: limit, orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.count({ where }),
    ]);
    return PaginatedResponseDto.of(data, total, page, limit);
  }

  async deleteReview(reviewId: string) {
    await this.prisma.review.delete({ where: { id: reviewId } });
    return { message: 'Review removed' };
  }

  // ── Analytics ───────────────────────────────────────────────────────────────

  async getAnalytics(period: 'week' | 'month' | 'year' = 'month') {
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 365;
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      userGrowth, bookingGrowth, totalRevenue,
      categoryStats, topProviders, verificationRate,
    ] = await Promise.all([
      // User signups per day — columns are camelCase in DB (no @@map on fields)
      this.prisma.$queryRaw<{ date: string; count: number }[]>`
        SELECT DATE("createdAt")::text AS date, COUNT(*)::int AS count
        FROM users WHERE "createdAt" >= ${from} AND "deletedAt" IS NULL
        GROUP BY DATE("createdAt") ORDER BY date
      `,
      // Bookings per day
      this.prisma.$queryRaw<{ date: string; count: number }[]>`
        SELECT DATE("createdAt")::text AS date, COUNT(*)::int AS count
        FROM bookings WHERE "createdAt" >= ${from}
        GROUP BY DATE("createdAt") ORDER BY date
      `,
      // Revenue from completed bookings
      this.prisma.quotation.aggregate({
        where: { booking: { status: 'COMPLETED', completedAt: { gte: from } } },
        _sum: { totalAmount: true },
      }),
      // Bookings per category
      this.prisma.$queryRaw<{ category: string; count: number }[]>`
        SELECT c.name AS category, COUNT(b.id)::int AS count
        FROM bookings b
        JOIN service_listings s ON b."serviceId" = s.id
        JOIN categories c ON s."categoryId" = c.id
        WHERE b."createdAt" >= ${from}
        GROUP BY c.name ORDER BY count DESC LIMIT 10
      `,
      // Top providers by completed jobs
      this.prisma.userProfile.findMany({
        where: { isProvider: true, completedJobs: { gt: 0 } },
        select: { displayName: true, avgRating: true, completedJobs: true, userId: true },
        orderBy: { completedJobs: 'desc' },
        take: 5,
      }),
      // Verification approval rate
      this.prisma.verification.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);

    const verifiedCount = verificationRate.find(v => v.status === VerificationStatus.APPROVED)?._count._all ?? 0;
    const totalVerifications = verificationRate.reduce((a, b) => a + b._count._all, 0);

    return {
      period,
      userGrowth:    userGrowth.map(r => ({ label: r.date, value: Number(r.count) })),
      bookingGrowth: bookingGrowth.map(r => ({ label: r.date, value: Number(r.count) })),
      revenue:       Number(totalRevenue._sum.totalAmount ?? 0),
      categoryStats: categoryStats.map(r => ({ label: r.category, value: Number(r.count) })),
      topProviders,
      verificationRate: totalVerifications > 0 ? Math.round((verifiedCount / totalVerifications) * 100) : 0,
    };
  }

  // ── Audit Logs ──────────────────────────────────────────────────────────────

  async listAuditLogs(filters: { page?: number; limit?: number; action?: string; userId?: string }) {
    const { page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (filters.action) where.action = { contains: filters.action, mode: 'insensitive' };
    if (filters.userId) where.userId = filters.userId;
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, phone: true, profile: { select: { displayName: true } } } } },
        skip, take: limit, orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return PaginatedResponseDto.of(data, total, page, limit);
  }

  // ── Verifications ───────────────────────────────────────────────────────────

  async listVerifications(filters: { status?: string; page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (filters.status) where.status = filters.status;
    const [data, total] = await Promise.all([
      this.prisma.verification.findMany({
        where,
        include: {
          user:      { select: { id: true, phone: true, email: true, profile: { select: { displayName: true, avatarUrl: true } } } },
          documents: { select: { id: true, documentType: true, fileUrl: true, fileName: true, createdAt: true } },
        },
        skip, take: limit, orderBy: { submittedAt: 'desc' },
      }),
      this.prisma.verification.count({ where }),
    ]);
    return PaginatedResponseDto.of(data, total, page, limit);
  }

  async reviewVerification(verificationId: string, adminId: string, action: 'APPROVED' | 'REJECTED', reason?: string) {
    const verification = await this.prisma.verification.findUnique({ where: { id: verificationId } });
    if (!verification) throw new NotFoundException('Verification not found');
    const updated = await this.prisma.verification.update({
      where: { id: verificationId },
      data: { status: action === 'APPROVED' ? VerificationStatus.APPROVED : VerificationStatus.REJECTED, reviewedBy: adminId, reviewedAt: new Date(), rejectionReason: reason ?? null },
    });
    const type = action === 'APPROVED' ? 'VERIFICATION_APPROVED' : 'VERIFICATION_REJECTED';
    this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
      userId: verification.userId, type,
      ctx: { rejectionReason: reason }, linkData: {},
    });
    return updated;
  }

  // ── Support Tickets ─────────────────────────────────────────────────────────

  async listSupportTickets(filters: { status?: string; page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (filters.status) where.status = filters.status;
    const [data, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        include: { user: { select: { id: true, phone: true, profile: { select: { displayName: true, avatarUrl: true } } } } },
        skip, take: limit, orderBy: { createdAt: 'desc' },
      }),
      this.prisma.supportTicket.count({ where }),
    ]);
    return PaginatedResponseDto.of(data, total, page, limit);
  }

  async updateSupportTicket(ticketId: string, data: { status?: string; adminNote?: string }) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        ...(data.status    ? { status: data.status as any }     : {}),
        ...(data.adminNote ? { adminNote: data.adminNote }       : {}),
        ...(data.status === 'RESOLVED' ? { resolvedAt: new Date() } : {}),
      },
    });
    if (data.status) {
      const notifMap: Record<string, string> = {
        IN_PROGRESS: 'SUPPORT_TICKET_UPDATED', AWAITING_USER: 'SUPPORT_TICKET_UPDATED',
        RESOLVED: 'SUPPORT_TICKET_RESOLVED',   CLOSED: 'SUPPORT_TICKET_CLOSED',
      };
      if (notifMap[data.status]) {
        this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
          userId: ticket.userId, type: notifMap[data.status],
          ctx: { ticketSubject: ticket.subject }, linkData: { ticketId },
        });
      }
    }
    return updated;
  }

  // ── Notifications Broadcast ─────────────────────────────────────────────────

  async broadcastNotification(data: { title: string; body: string; target: 'ALL' | 'PROVIDERS' | 'CUSTOMERS'; userIds?: string[] }) {
    let userIds: string[] = data.userIds ?? [];

    if (!userIds.length) {
      if (data.target === 'ALL') {
        const users = await this.prisma.user.findMany({ where: { isActive: true, isSuspended: false }, select: { id: true } });
        userIds = users.map(u => u.id);
      } else if (data.target === 'PROVIDERS') {
        const profiles = await this.prisma.userProfile.findMany({ where: { isProvider: true }, select: { userId: true } });
        userIds = profiles.map(p => p.userId);
      } else {
        const profiles = await this.prisma.userProfile.findMany({ where: { isProvider: false } }, );
        userIds = profiles.map((p: any) => p.userId);
      }
    }

    await Promise.all(
      userIds.map(userId =>
        this.prisma.notification.create({
          data: { userId, type: 'SYSTEM_MAINTENANCE', title: data.title, body: data.body },
        }),
      ),
    );

    return { message: `Notification sent to ${userIds.length} users`, count: userIds.length };
  }

  // ── Categories ──────────────────────────────────────────────────────────────

  async listCategories() {
    return this.prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { services: true } } },
    });
  }

  async createCategory(data: { name: string; slug: string; description?: string; iconUrl?: string }) {
    return this.prisma.category.create({ data });
  }

  async updateCategory(id: string, data: { name?: string; description?: string; iconUrl?: string; isActive?: boolean }) {
    return this.prisma.category.update({ where: { id }, data });
  }

  // ── Conversations ────────────────────────────────────────────────────────────

  async listConversations(page = 1, limit = 20, status?: string) {
    const skip = (page - 1) * limit;
    const where = status === 'archived'
      ? { isArchived: true }
      : status === 'active'
      ? { isArchived: false }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { lastMessageAt: 'desc' },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true, phone: true,
                  profile: { select: { displayName: true, avatarUrl: true, isProvider: true } },
                },
              },
            },
          },
          _count: { select: { messages: true, quotations: true } },
        },
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return PaginatedResponseDto.of(data, total, page, limit);
  }

  // ── Quotations ───────────────────────────────────────────────────────────────

  async listQuotations(page = 1, limit = 20, status?: QuotationStatus) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};

    const [data, total] = await Promise.all([
      this.prisma.quotation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          service:  { select: { id: true, title: true, category: { select: { name: true } } } },
          provider: { select: { id: true, phone: true, profile: { select: { displayName: true, avatarUrl: true } } } },
          customer: { select: { id: true, phone: true, profile: { select: { displayName: true } } } },
          _count:   { select: { items: true } },
        },
      }),
      this.prisma.quotation.count({ where }),
    ]);

    return PaginatedResponseDto.of(data, total, page, limit);
  }
}
