import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { ConversationsService } from '../../conversations/services/conversations.service';
import { ServiceRequestsRepository } from '../repositories/service-requests.repository';
import { AdjustPriceDto, CreateServiceRequestDto, DeclineServiceRequestDto } from '../dto/requests/service-request.dto';
import { EventName } from '../../../common/enums';

@Injectable()
export class ServiceRequestsService implements OnModuleInit {
  private readonly logger = new Logger(ServiceRequestsService.name);

  constructor(
    private repo: ServiceRequestsRepository,
    private prisma: PrismaService,
    private conversationsService: ConversationsService,
    private eventEmitter: EventEmitter2,
    private config: ConfigService,
  ) {}

  onModuleInit() {
    // Server-authoritative expiration sweep. Same setInterval-in-onModuleInit
    // pattern as QuotationsService's expiry sweep, but much tighter — the
    // response window here is short (as low as 30s in dev), so the sweep has
    // to run frequently enough that "expired" is enforced promptly rather
    // than hours late. Survives restarts (re-registered on every boot) and
    // is safe across multiple instances (each sweep is an idempotent,
    // conditional updateMany).
    this.expireStaleRequests();
    setInterval(() => this.expireStaleRequests(), 20 * 1000);
  }

  private responseTimeoutSeconds(): number {
    return this.config.get<number>('app.serviceRequestResponseTimeoutSeconds', 300);
  }

  private async expireStaleRequests() {
    try {
      const stale = await this.prisma.serviceRequest.findMany({
        where: { status: 'PENDING', expiresAt: { lt: new Date() } },
        select: { id: true, customerId: true, conversationId: true },
      });
      if (!stale.length) return;

      await this.prisma.serviceRequest.updateMany({
        where: { id: { in: stale.map(s => s.id) } },
        data: { status: 'EXPIRED', respondedAt: new Date() },
      });

      for (const req of stale) {
        this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
          userId:   req.customerId,
          type:     'REQUEST_EXPIRED',
          linkData: { conversationId: req.conversationId },
        });
      }
      this.logger.log(`Expired ${stale.length} stale service request(s)`);
    } catch (err) {
      this.logger.error(`Failed to expire stale service requests: ${(err as Error).message}`);
    }
  }

  // ── Create ───────────────────────────────────────────────────────────────

  async create(customerId: string, dto: CreateServiceRequestDto) {
    const service = await this.prisma.serviceListing.findUnique({
      where: { id: dto.serviceId },
      select: { id: true, providerId: true, title: true, startingPrice: true, isPublished: true },
    });
    if (!service || !service.isPublished) throw new NotFoundException('Service not found');
    if (service.providerId === customerId) throw new BadRequestException('Cannot request your own service');

    // Reuses the existing conversation-creation flow (find-or-create between
    // these two users for this service) rather than duplicating it — but this
    // service owns the NEW_SERVICE_REQUEST/SERVICE_REQUEST_SENT notifications
    // itself (below), since only it knows the real requestId, and because a
    // reused (already-existing) conversation would otherwise skip them.
    const conversation = await this.conversationsService.create(
      customerId,
      { recipientId: service.providerId, serviceId: service.id },
      { skipNotifications: true },
    );

    // A conversation can outlive several requests over time (e.g. a prior
    // request was declined/expired and the customer tries again), so this
    // only guards against a genuinely duplicate *active* request on it.
    const active = await this.repo.findActiveByConversation(conversation.id);
    if (active) return active;

    const request = await this.repo.create({
      conversationId: conversation.id,
      customerId,
      providerId:     service.providerId,
      serviceId:      service.id,
      description:    dto.description,
      address:        dto.address,
      latitude:       dto.latitude,
      longitude:      dto.longitude,
      savedAddressId: dto.savedAddressId,
      basePrice:      service.startingPrice, // server-derived — never trust a client-supplied price
      expiresAt:      new Date(Date.now() + this.responseTimeoutSeconds() * 1000),
      images: dto.images?.length
        ? { create: dto.images.map((url, i) => ({ url, sortOrder: i })) }
        : undefined,
    });

    const customerProfile = await this.prisma.userProfile.findUnique({
      where: { userId: customerId }, select: { displayName: true },
    });
    this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
      userId:   service.providerId,
      type:     'NEW_SERVICE_REQUEST',
      ctx:      { userName: customerProfile?.displayName, serviceName: service.title },
      linkData: { conversationId: conversation.id, requestId: request.id },
    });

    const providerProfile = await this.prisma.userProfile.findUnique({
      where: { userId: service.providerId }, select: { displayName: true },
    });
    this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
      userId:   customerId,
      type:     'SERVICE_REQUEST_SENT',
      ctx:      { artisanName: providerProfile?.displayName ?? 'the artisan' },
      linkData: { conversationId: conversation.id, requestId: request.id },
    });

    return request;
  }

  // ── Reads ────────────────────────────────────────────────────────────────

  async findById(id: string, userId: string) {
    const request = await this.repo.findById(id);
    if (!request) throw new NotFoundException('Service request not found');
    if (request.customerId !== userId && request.providerId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    if (request.providerId === userId) {
      const distances = await this.repo.distancesForProvider(userId, [id]);
      return { ...request, distanceKm: distances.get(id) ?? null };
    }
    return request;
  }

  async findForProvider(providerId: string, status: string | undefined, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const { data, total } = await this.repo.findByProvider(providerId, status, skip, limit);
    const distances = await this.repo.distancesForProvider(providerId, data.map(r => r.id));
    return {
      data: data.map(r => ({ ...r, distanceKm: distances.get(r.id) ?? null })),
      meta: { page, limit, total },
    };
  }

  async findForCustomer(customerId: string, status: string | undefined, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const { data, total } = await this.repo.findByCustomer(customerId, status, skip, limit);
    return { data, meta: { page, limit, total } };
  }

  // ── Provider actions ─────────────────────────────────────────────────────

  async accept(id: string, providerId: string, dto?: AdjustPriceDto) {
    const finalPrice = dto?.price;

    const request = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.serviceRequest.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Service request not found');
      if (existing.providerId !== providerId) throw new ForbiddenException('Not your request');
      // Server-authoritative deadline enforcement — never trust the client's
      // clock or a mobile-side countdown to gate this.
      if (existing.expiresAt <= new Date()) throw new BadRequestException('This request has expired');

      const price = finalPrice ?? existing.basePrice;
      if (price <= 0) throw new BadRequestException('Price must be greater than zero');
      const priceChanged = finalPrice != null && finalPrice !== existing.basePrice;

      // Compare-and-swap: only succeeds if it's still PENDING. Guards double
      // taps and a second provider action racing the first.
      const result = await tx.serviceRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status:        priceChanged ? 'PRICE_UPDATED' : 'ACCEPTED',
          adjustedPrice: finalPrice ?? null,
          priceReason:   priceChanged ? dto?.reason : null,
          respondedAt:   new Date(),
        },
      });
      if (result.count === 0) throw new BadRequestException('This request has already been responded to');

      if (priceChanged) {
        await tx.serviceRequestPriceHistory.create({
          data: {
            serviceRequestId: id,
            previousPrice:    existing.basePrice,
            newPrice:         price,
            reason:           dto?.reason,
            changedBy:        providerId,
          },
        });
      }

      return tx.serviceRequest.findUnique({ where: { id } });
    });

    const providerProfile = await this.prisma.userProfile.findUnique({
      where: { userId: providerId }, select: { displayName: true },
    });
    this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
      userId:   request!.customerId,
      type:     finalPrice != null && finalPrice !== request!.basePrice ? 'REQUEST_PRICE_ADJUSTED' : 'REQUEST_ACCEPTED',
      ctx:      { artisanName: providerProfile?.displayName, amount: String(finalPrice ?? request!.basePrice) },
      linkData: { conversationId: request!.conversationId, requestId: id },
    });

    return this.repo.findById(id);
  }

  async decline(id: string, providerId: string, dto: DeclineServiceRequestDto) {
    const request = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.serviceRequest.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Service request not found');
      if (existing.providerId !== providerId) throw new ForbiddenException('Not your request');
      if (existing.expiresAt <= new Date()) throw new BadRequestException('This request has expired');

      const result = await tx.serviceRequest.updateMany({
        where: { id, status: 'PENDING' },
        data:  { status: 'DECLINED', declineReason: dto.reason, respondedAt: new Date() },
      });
      if (result.count === 0) throw new BadRequestException('This request has already been responded to');

      return tx.serviceRequest.findUnique({ where: { id } });
    });

    this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
      userId:   request!.customerId,
      type:     'REQUEST_REJECTED',
      ctx:      { rejectionReason: dto.reason },
      linkData: { conversationId: request!.conversationId },
    });

    return this.repo.findById(id);
  }

  // ── Customer actions ─────────────────────────────────────────────────────

  // Customer explicitly confirms a provider's price adjustment — the
  // provider can never self-confirm their own change.
  async confirmPrice(id: string, customerId: string) {
    const request = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.serviceRequest.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Service request not found');
      if (existing.customerId !== customerId) throw new ForbiddenException('Not your request');

      const result = await tx.serviceRequest.updateMany({
        where: { id, status: 'PRICE_UPDATED' },
        data:  { status: 'ACCEPTED' },
      });
      if (result.count === 0) throw new BadRequestException('There is no price update to confirm');

      return tx.serviceRequest.findUnique({ where: { id } });
    });

    const customerProfile = await this.prisma.userProfile.findUnique({
      where: { userId: customerId }, select: { displayName: true },
    });
    this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
      userId:   request!.providerId,
      type:     'REQUEST_PRICE_ACCEPTED',
      ctx:      { userName: customerProfile?.displayName },
      linkData: { conversationId: request!.conversationId, requestId: id },
    });

    return this.repo.findById(id);
  }

  async declinePrice(id: string, customerId: string, reason?: string) {
    const request = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.serviceRequest.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Service request not found');
      if (existing.customerId !== customerId) throw new ForbiddenException('Not your request');

      const result = await tx.serviceRequest.updateMany({
        where: { id, status: 'PRICE_UPDATED' },
        data:  { status: 'DECLINED', declineReason: reason, respondedAt: new Date() },
      });
      if (result.count === 0) throw new BadRequestException('There is no price update to decline');

      return tx.serviceRequest.findUnique({ where: { id } });
    });

    const customerProfile = await this.prisma.userProfile.findUnique({
      where: { userId: customerId }, select: { displayName: true },
    });
    this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
      userId:   request!.providerId,
      type:     'REQUEST_PRICE_DECLINED',
      ctx:      { userName: customerProfile?.displayName, rejectionReason: reason },
      linkData: { conversationId: request!.conversationId },
    });

    return this.repo.findById(id);
  }

  async cancel(id: string, customerId: string) {
    const result = await this.prisma.serviceRequest.updateMany({
      where: { id, customerId, status: 'PENDING' },
      data:  { status: 'CANCELLED', respondedAt: new Date() },
    });
    if (result.count === 0) {
      const existing = await this.prisma.serviceRequest.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Service request not found');
      if (existing.customerId !== customerId) throw new ForbiddenException('Not your request');
      throw new BadRequestException('This request can no longer be cancelled');
    }
    return this.repo.findById(id);
  }
}
