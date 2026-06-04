import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ServiceStatus, UserRole } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { PaginatedResponseDto } from '../../../common/dto/base-response.dto';
import { EventName } from '../../../common/enums';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService, private eventEmitter: EventEmitter2) {}

  async listUsers(filters: { role?: string; isActive?: boolean; search?: string; page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where: any = { deletedAt: null };
    if (filters.role) where.role = filters.role;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.search) where.OR = [{ email: { contains: filters.search, mode: 'insensitive' } }, { profile: { displayName: { contains: filters.search, mode: 'insensitive' } } }];

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: { id: true, email: true, phone: true, role: true, isActive: true, isSuspended: true, isEmailVerified: true, createdAt: true, lastLoginAt: true, profile: { select: { displayName: true, avatarUrl: true, city: true, isProvider: true } }, verification: { select: { status: true } }, _count: { select: { services: true, bookingsAsCustomer: true } } },
        skip, take: limit, orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return PaginatedResponseDto.of(data, total, page, limit);
  }

  async suspendUser(adminId: string, userId: string, reason: string) {
    if (adminId === userId) throw new BadRequestException('Cannot suspend yourself');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.SUPER_ADMIN) throw new ForbiddenException('Cannot suspend super admin');
    await this.prisma.user.update({ where: { id: userId }, data: { isSuspended: true, suspendedReason: reason } });
    return { message: 'User suspended' };
  }

  async unsuspendUser(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { isSuspended: false, suspendedReason: null } });
    return { message: 'User unsuspended' };
  }

  async promoteToAdmin(userId: string) {
    return this.prisma.user.update({ where: { id: userId }, data: { role: UserRole.ADMIN }, select: { id: true, email: true, role: true } });
  }

  async listServices(filters: { status?: string; page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where: any = { deletedAt: null };
    if (filters.status) where.status = filters.status;

    const [data, total] = await Promise.all([
      this.prisma.serviceListing.findMany({
        where,
        include: { provider: { select: { id: true, email: true, profile: { select: { displayName: true } } } }, category: { select: { name: true } }, images: { take: 1 }, _count: { select: { bookings: true, reviews: true } } },
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
    const updated = await this.prisma.serviceListing.update({
      where: { id: serviceId },
      data: { status: statusMap[action], reviewedBy: adminId, reviewedAt: new Date(), rejectionReason: action !== 'APPROVED' ? reason : null, isPublished: action === 'APPROVED' ? service.isPublished : false },
    });

    const notifMap: Record<string, string> = { APPROVED: 'SERVICE_APPROVED', REJECTED: 'SERVICE_REJECTED', SUSPENDED: 'SERVICE_SUSPENDED' };
    this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
      userId: service.providerId, type: notifMap[action], title: `Service ${action}`,
      body: action === 'APPROVED' ? `"${service.title}" approved.` : `"${service.title}" ${action.toLowerCase()}: ${reason}`,
      data: { serviceId },
    });

    return updated;
  }

  async getDashboardStats() {
    const [totalUsers, totalProviders, totalServices, pendingServices, pendingVerifications, totalBookings, completedBookings, openDisputes, newUsersToday] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.userProfile.count({ where: { isProvider: true } }),
      this.prisma.serviceListing.count({ where: { deletedAt: null } }),
      this.prisma.serviceListing.count({ where: { status: 'PENDING_REVIEW' } }),
      this.prisma.verification.count({ where: { status: 'PENDING' } }),
      this.prisma.booking.count(),
      this.prisma.booking.count({ where: { status: 'COMPLETED' } }),
      this.prisma.dispute.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
      this.prisma.user.count({ where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }, deletedAt: null } }),
    ]);

    return {
      users: { total: totalUsers, providers: totalProviders, newToday: newUsersToday },
      services: { total: totalServices, pendingReview: pendingServices },
      bookings: { total: totalBookings, completed: completedBookings, completionRate: totalBookings > 0 ? ((completedBookings / totalBookings) * 100).toFixed(1) : 0 },
      pendingVerifications,
      openDisputes,
    };
  }
}
