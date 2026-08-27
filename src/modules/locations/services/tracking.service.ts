import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { EventName } from '../../../common/enums';

export const TrackingEvent = {
  LOCATION_UPDATED:   'tracking.location_updated',
  TRACKING_STARTED:   'tracking.started',
  TRACKING_STOPPED:   'tracking.stopped',
  ARTISAN_ARRIVED:    'tracking.artisan_arrived',
} as const;

@Injectable()
export class TrackingService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async startTracking(bookingId: string, artisanId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: true,
        provider: { include: { profile: { select: { displayName: true } } } },
        serviceRequest: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.providerId !== artisanId) throw new ForbiddenException();

    // The job-site coordinates the customer supplied when they sent the
    // original request, carried directly on Booking.serviceRequest — since
    // Booking itself has no location fields of its own. A booking that
    // originated from a manual in-chat Quotation instead of a ServiceRequest
    // has no destination coordinates here (that path predates GPS tracking
    // on this flow); `destination` is simply undefined in that case.
    const destination = booking.serviceRequest;

    const session = await this.prisma.trackingSession.upsert({
      where:  { bookingId },
      update: { status: 'ACTIVE', completedAt: null },
      create: {
        bookingId,
        artisanId,
        customerId: booking.customerId,
        status: 'ACTIVE',
        destinationLatitude:  destination?.latitude,
        destinationLongitude: destination?.longitude,
      },
    });

    this.eventEmitter.emit(TrackingEvent.TRACKING_STARTED, {
      sessionId:  session.id,
      bookingId,
      artisanId,
      customerId: booking.customerId,
    });

    // Push notification — artisan is heading to the customer
    const artisanName = (booking.provider as any)?.profile?.displayName;
    this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
      userId:   booking.customerId,
      type:     'ARTISAN_EN_ROUTE',
      ctx:      { artisanName },
      linkData: { bookingId },
    });

    return session;
  }

  async updateLocation(artisanId: string, bookingId: string, lat: number, lng: number) {
    const session = await this.prisma.trackingSession.findUnique({ where: { bookingId } });
    if (!session) throw new NotFoundException('No active tracking session');
    if (session.artisanId !== artisanId) throw new ForbiddenException();

    const updated = await this.prisma.trackingSession.update({
      where: { bookingId },
      data:  { currentLatitude: lat, currentLongitude: lng },
    });

    this.eventEmitter.emit(TrackingEvent.LOCATION_UPDATED, {
      sessionId:  session.id,
      bookingId,
      artisanId,
      customerId: session.customerId,
      lat,
      lng,
    });

    return updated;
  }

  async notifyArrived(artisanId: string, bookingId: string) {
    const session = await this.prisma.trackingSession.findUnique({ where: { bookingId } });
    if (!session) throw new NotFoundException('No active tracking session');
    if (session.artisanId !== artisanId) throw new ForbiddenException();

    this.eventEmitter.emit(TrackingEvent.ARTISAN_ARRIVED, {
      bookingId,
      artisanId,
      customerId: session.customerId,
    });

    // Push notification — artisan has arrived
    const artisanProfile = await this.prisma.userProfile.findUnique({
      where: { userId: artisanId }, select: { displayName: true },
    });
    this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
      userId:   session.customerId,
      type:     'ARTISAN_ARRIVED',
      ctx:      { artisanName: artisanProfile?.displayName },
      linkData: { bookingId },
    });

    return { notified: true };
  }

  async stopTracking(artisanId: string, bookingId: string) {
    const session = await this.prisma.trackingSession.findUnique({ where: { bookingId } });
    if (!session) throw new NotFoundException('No active tracking session');
    if (session.artisanId !== artisanId) throw new ForbiddenException();

    const stopped = await this.prisma.trackingSession.update({
      where: { bookingId },
      data:  { status: 'COMPLETED', completedAt: new Date() },
    });

    this.eventEmitter.emit(TrackingEvent.TRACKING_STOPPED, {
      bookingId,
      artisanId,
      customerId: session.customerId,
    });

    return stopped;
  }

  getSession(bookingId: string) {
    return this.prisma.trackingSession.findUnique({ where: { bookingId } });
  }
}
