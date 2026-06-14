import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, DisputeStatus } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { DisputesRepository } from '../repositories/disputes.repository';
import { CreateDisputeDto, ResolveDisputeDto } from '../dto/requests/create-dispute.dto';
import { PaginatedResponseDto } from '../../../common/dto/base-response.dto';
import { EventName } from '../../../common/enums';

@Injectable()
export class DisputesService {
  constructor(private repo: DisputesRepository, private prisma: PrismaService, private eventEmitter: EventEmitter2) {}

  async create(raisedById: string, dto: CreateDisputeDto) {
    const booking = await this.prisma.booking.findUnique({ where: { id: dto.bookingId }, include: { dispute: true } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.customerId !== raisedById) throw new ForbiddenException('Only customer can raise dispute');
    if (!['COMPLETED', 'IN_PROGRESS', 'PARTIALLY_COMPLETED'].includes(booking.status)) throw new BadRequestException('Cannot dispute in this status');
    if (booking.dispute) throw new BadRequestException('Dispute already exists');

    const dispute = await this.repo.create({
      bookingId: dto.bookingId, raisedById, providerId: booking.providerId,
      reason: dto.reason, description: dto.description,
      evidence: dto.evidence?.length ? { create: dto.evidence.map(e => ({ ...e, uploadedBy: raisedById })) } : undefined,
    });

    await this.prisma.booking.update({ where: { id: dto.bookingId }, data: { status: BookingStatus.DISPUTED } });

    const raisedByProfile = await this.prisma.userProfile.findUnique({
      where: { userId: raisedById }, select: { displayName: true },
    });

    this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
      userId:   booking.providerId,
      type:     'BOOKING_DISPUTED',
      ctx:      { userName: raisedByProfile?.displayName },
      linkData: { disputeId: dispute.id, bookingId: dto.bookingId },
    });

    return dispute;
  }

  async findById(id: string, userId: string) {
    const dispute = await this.repo.findById(id);
    if (!dispute) throw new NotFoundException('Dispute not found');
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
    if (!isAdmin && dispute.raisedById !== userId && dispute.providerId !== userId) throw new ForbiddenException('Access denied');
    return dispute;
  }

  async resolve(id: string, resolvedBy: string, dto: ResolveDisputeDto) {
    const dispute = await this.repo.findById(id);
    if (!dispute) throw new NotFoundException('Dispute not found');
    if (dispute.status === DisputeStatus.RESOLVED || dispute.status === DisputeStatus.REJECTED) throw new BadRequestException('Already closed');

    const updated = await this.repo.update(id, {
      status: dto.outcome === 'RESOLVED' ? DisputeStatus.RESOLVED : DisputeStatus.REJECTED,
      resolution: dto.resolution, resolvedBy, resolvedAt: new Date(), adminNotes: dto.adminNotes,
    });

    for (const userId of [dispute.raisedById, dispute.providerId]) {
      this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
        userId,
        type:     'DISPUTE_RESOLVED',
        ctx:      { outcome: dto.outcome, resolution: dto.resolution },
        linkData: { disputeId: id },
      });
    }

    return updated;
  }

  async listAll(status?: DisputeStatus, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.repo.findAll(status, skip, limit),
      this.repo.countAll(status),
    ]);
    return PaginatedResponseDto.of(data, total, page, limit);
  }
}
