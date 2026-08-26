import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BookingStatus, MessageType, PaymentType, QuotationStatus } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { BookingsRepository } from '../repositories/bookings.repository';
import { CreateBookingDto, UpdateBookingStatusDto } from '../dto/requests/create-booking.dto';
import { PaginatedResponseDto } from '../../../common/dto/base-response.dto';
import { EventName } from '../../../common/enums';
import { InvalidStateException } from '../../../common/exceptions/business.exception';

// CONFIRMED is the post-payment state. Provider can then start work directly.
const TRANSITIONS: Record<string, string[]> = {
  PENDING:             ['CONFIRMED', 'ACCEPTED', 'CANCELLED'],
  CONFIRMED:           ['SCHEDULED', 'IN_PROGRESS', 'CANCELLED'],
  ACCEPTED:            ['SCHEDULED', 'CANCELLED'],
  SCHEDULED:           ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS:         ['PARTIALLY_COMPLETED', 'COMPLETED', 'CANCELLED'],
  PARTIALLY_COMPLETED: ['COMPLETED', 'SCHEDULED', 'CANCELLED'],
  COMPLETED:           [],
  CANCELLED:           [],
  DISPUTED:            ['CANCELLED'],
};

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private repo: BookingsRepository,
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(customerId: string, dto: CreateBookingDto) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id: dto.quotationId },
      include: { service: { select: { title: true } } },
    });
    if (!quotation)                                           throw new NotFoundException('Quotation not found');
    if (quotation.customerId !== customerId)                  throw new ForbiddenException('Not your quotation');
    if (quotation.status !== QuotationStatus.ACCEPTED)       throw new BadRequestException('Only ACCEPTED quotations can be booked');

    const exists = await this.repo.findByQuotationId(dto.quotationId);
    if (exists) throw new BadRequestException('Booking already exists for this quotation');

    // Validate requested date against provider availability slots
    if (dto.scheduledAt) {
      const avail = await this.checkAvailability(quotation.serviceId, dto.scheduledAt);
      if (!avail.available) {
        throw new BadRequestException(avail.reason ?? 'Provider is not available on the requested date');
      }
    }

    // LABOUR_ONLY needs no escrow, so the booking is confirmed immediately.
    // MATERIALS_REQUIRED/FULL_PROJECT need payment first — the booking is
    // created PENDING, then the client pays via the existing
    // POST /payments/escrow (scoped to this booking's id, unlike the old
    // unscoped "does the customer have any completed escrow" check this
    // replaces) and finally confirms via the existing
    // PATCH /bookings/:id/status, an already-allowed PENDING → CONFIRMED
    // transition.
    const paymentType = (quotation as any).paymentType as PaymentType;
    const needsEscrow = paymentType === PaymentType.MATERIALS_REQUIRED || paymentType === PaymentType.FULL_PROJECT;

    const booking = await this.repo.create({
      customerId,
      providerId:    quotation.providerId,
      serviceId:     quotation.serviceId,
      quotationId:   dto.quotationId,
      status:        needsEscrow ? BookingStatus.PENDING : BookingStatus.CONFIRMED,
      scheduledAt:   dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
      providerNotes: dto.notes,
    });

    // If this quotation originated from a ServiceRequest, mark it CONVERTED
    // now that a real Booking exists for it.
    await this.prisma.serviceRequest.updateMany({
      where: { quotationId: dto.quotationId, status: 'ACCEPTED' as any },
      data:  { status: 'CONVERTED' as any },
    });

    if (!needsEscrow) {
      this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
        userId:   quotation.providerId,
        type:     'BOOKING_CONFIRMED',
        ctx:      { serviceName: (quotation as any).service?.title },
        linkData: { bookingId: booking.id },
      });
    }

    return booking;
  }

  async updateStatus(bookingId: string, userId: string, dto: UpdateBookingStatusDto) {
    const booking = await this.repo.findById(bookingId);
    if (!booking) throw new NotFoundException('Booking not found');

    const isCustomer = booking.customerId === userId;
    const isProvider = booking.providerId === userId;
    if (!isCustomer && !isProvider) throw new ForbiddenException('Not your booking');

    const allowed = TRANSITIONS[booking.status] || [];
    if (!allowed.includes(dto.status)) throw new InvalidStateException(booking.status, dto.status);

    if (dto.status === 'COMPLETED'   && !isProvider) throw new ForbiddenException('Only provider can complete');
    if (dto.status === 'IN_PROGRESS' && !isProvider) throw new ForbiddenException('Only provider can start work');
    if (dto.status === 'CANCELLED'   && !dto.cancelReason) throw new BadRequestException('Cancellation reason required');

    const updateData: any = { status: dto.status as BookingStatus };
    if (dto.status === 'COMPLETED')  { updateData.completedAt = new Date(); updateData.completionNotes = dto.notes; }
    if (dto.status === 'CANCELLED')  { updateData.cancelledAt = new Date(); updateData.cancelReason = dto.cancelReason; }
    if (dto.status === 'IN_PROGRESS') updateData.startedAt = new Date();
    if ((dto.status === 'SCHEDULED' || dto.status === 'CONFIRMED') && dto.scheduledAt) {
      updateData.scheduledAt = new Date(dto.scheduledAt);
    }

    const updated = await this.repo.update(bookingId, updateData);

    if (dto.status === 'COMPLETED') {
      this.eventEmitter.emit(EventName.PROVIDER_METRICS_UPDATE, { providerId: booking.providerId });
      this.eventEmitter.emit(EventName.ESCROW_RELEASED, { bookingId, release: true });
    }
    if (dto.status === 'CANCELLED') {
      this.eventEmitter.emit(EventName.ESCROW_REFUNDED, { bookingId, refund: true });
    }

    const notifyId  = isProvider ? booking.customerId : booking.providerId;
    const statusKey = `BOOKING_${dto.status}` as any;
    this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
      userId:   notifyId,
      type:     statusKey,
      ctx:      { cancelReason: dto.cancelReason },
      linkData: { bookingId },
    });

    // Auto-close the conversation when the booking lifecycle ends
    if (dto.status === 'COMPLETED' || dto.status === 'CANCELLED') {
      const quotation = await this.prisma.quotation.findUnique({
        where: { id: booking.quotationId },
        select: { conversationId: true },
      });
      if (quotation?.conversationId) {
        const convId = quotation.conversationId;

        await this.prisma.conversation.update({
          where: { id: convId },
          data: { isArchived: true, archivedAt: new Date(), closedReason: dto.status },
        });
        this.logger.debug(`Archived conversation ${convId} with reason ${dto.status}`);

        const systemContent = dto.status === 'COMPLETED'
          ? 'Service completed. This conversation has been archived. To hire this artisan again, create a new service request.'
          : 'Booking cancelled. This conversation has been closed. To request service again, create a new service request.';

        const sysMsg = await this.prisma.message.create({
          data: { conversationId: convId, senderId: userId, type: MessageType.SYSTEM, content: systemContent },
        });

        this.eventEmitter.emit(EventName.CHAT_MESSAGE, { message: sysMsg, conversationId: convId });

        // Notify both parties that the conversation is now archived
        const actorId    = userId;
        const otherParty = isProvider ? booking.customerId : booking.providerId;
        for (const uid of [actorId, otherParty]) {
          this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
            userId:   uid,
            type:     'CONVERSATION_ARCHIVED',
            ctx:      { bookingStatus: dto.status },
            linkData: { conversationId: convId },
          });
        }
      }
    }

    return updated;
  }

  async findById(bookingId: string, userId: string) {
    const booking = await this.repo.findById(bookingId);
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.customerId !== userId && booking.providerId !== userId) throw new ForbiddenException('Access denied');
    return booking;
  }

  async findMine(userId: string, role: 'customer' | 'provider', status?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.repo.findAllByUser(userId, role, status, skip, limit),
      this.repo.countByUser(userId, role, status),
    ]);
    return PaginatedResponseDto.of(data, total, page, limit);
  }

  async checkAvailability(serviceId: string, date: string) {
    const availability = await this.prisma.availability.findUnique({
      where: { serviceId }, include: { slots: true, holidays: true },
    });
    if (!availability) return { available: true };
    if (availability.isVacationMode) {
      const d = new Date(date);
      if (availability.vacationStart && availability.vacationEnd && d >= availability.vacationStart && d <= availability.vacationEnd) {
        return { available: false, reason: 'Provider is on vacation' };
      }
    }
    const requestDate = new Date(date);
    const dow = requestDate.getDay();
    const holiday = availability.holidays.find(h => h.date.toDateString() === requestDate.toDateString());
    if (holiday) return { available: false, reason: holiday.reason || 'Holiday' };
    const slot = availability.slots.find(s => s.dayOfWeek === dow);
    if (!slot || !slot.isAvailable) return { available: false, reason: 'Not available this day' };
    return { available: true, slot: { startTime: slot.startTime, endTime: slot.endTime } };
  }
}
