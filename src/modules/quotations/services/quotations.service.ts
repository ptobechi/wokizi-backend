import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaymentType, QuotationItemType, QuotationStatus } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { QuotationsRepository } from '../repositories/quotations.repository';
import { CreateQuotationDto, QuotationItemDto, RespondQuotationDto } from '../dto/requests/create-quotation.dto';
import { EventName } from '../../../common/enums';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeCostsFromItems(items: QuotationItemDto[]) {
  let labourCost = 0, materialCost = 0, transportationCost = 0, additionalCharges = 0;
  for (const item of items) {
    const total = (item.quantity ?? 1) * item.unitPrice;
    switch (item.type) {
      case QuotationItemType.LABOUR:      labourCost       += total; break;
      case QuotationItemType.MATERIAL:    materialCost     += total; break;
      case QuotationItemType.TRANSPORT:   transportationCost += total; break;
      case QuotationItemType.ADDITIONAL:  additionalCharges += total; break;
    }
  }
  return { labourCost, materialCost, transportationCost, additionalCharges };
}

function buildItemsCreate(items: QuotationItemDto[]) {
  return items.map((item, idx) => ({
    type:        item.type,
    name:        item.name,
    description: item.description,
    quantity:    item.quantity ?? 1,
    unitPrice:   item.unitPrice,
    totalPrice:  (item.quantity ?? 1) * item.unitPrice,
    sortOrder:   idx,
  }));
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class QuotationsService implements OnModuleInit {
  private readonly logger = new Logger(QuotationsService.name);

  constructor(
    private repo: QuotationsRepository,
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  onModuleInit() {
    // Expire stale quotations on startup, then every hour
    this.expireStaleQuotations();
    setInterval(() => this.expireStaleQuotations(), 60 * 60 * 1000);
  }

  private async expireStaleQuotations() {
    try {
      const result = await this.prisma.quotation.updateMany({
        where: {
          status: { in: [QuotationStatus.PENDING, QuotationStatus.NEGOTIATING] },
          validUntil: { lt: new Date(), not: null },
        },
        data: { status: QuotationStatus.EXPIRED },
      });
      if (result.count > 0) {
        this.logger.log(`Expired ${result.count} stale quotation(s)`);
      }
    } catch (err) {
      this.logger.error(`Failed to expire stale quotations: ${(err as Error).message}`);
    }
  }

  async create(providerId: string, dto: CreateQuotationDto) {
    const p = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: dto.conversationId, userId: providerId } },
    });
    if (!p) throw new ForbiddenException('Not a participant in this conversation');

    // If items provided, compute flat costs from them; otherwise use supplied flat values
    let labourCost         = dto.labourCost         ?? 0;
    let materialCost       = dto.materialCost       ?? 0;
    let transportationCost = dto.transportationCost ?? 0;
    let additionalCharges  = dto.additionalCharges  ?? 0;

    if (dto.items?.length) {
      const computed = computeCostsFromItems(dto.items);
      labourCost         = computed.labourCost;
      materialCost       = computed.materialCost;
      transportationCost = computed.transportationCost;
      additionalCharges  = computed.additionalCharges;
    }

    const subtotal    = labourCost + materialCost + transportationCost + additionalCharges;
    const tax         = subtotal * ((dto.taxRate ?? 0) / 100);
    const totalAmount = subtotal + tax;

    const quotation = await this.repo.create({
      conversationId: dto.conversationId,
      serviceId:      dto.serviceId,
      providerId,
      customerId:     dto.customerId,
      description:    dto.description,
      labourCost,
      materialCost,
      transportationCost,
      additionalCharges,
      taxRate:     dto.taxRate ?? 0,
      totalAmount,
      notes:       dto.notes,
      validUntil:  dto.validUntil ? new Date(dto.validUntil) : undefined,
      status:      QuotationStatus.PENDING,
      paymentType: dto.paymentType ?? PaymentType.LABOUR_ONLY,
      ...(dto.items?.length ? { items: { create: buildItemsCreate(dto.items) } } : {}),
    });

    const providerProfile = await this.prisma.userProfile.findUnique({
      where: { userId: providerId }, select: { displayName: true },
    });

    this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
      userId:   dto.customerId,
      type:     'NEW_QUOTE',
      ctx:      { artisanName: providerProfile?.displayName },
      linkData: { quotationId: quotation.id, conversationId: dto.conversationId },
    });

    return quotation;
  }

  async revise(quotationId: string, providerId: string, dto: CreateQuotationDto) {
    const original = await this.get(quotationId);
    if (original.providerId !== providerId) throw new ForbiddenException('Not your quotation');
    if (original.status === QuotationStatus.EXPIRED || original.status === QuotationStatus.REJECTED) {
      throw new BadRequestException('Cannot revise this quotation');
    }

    // Locked once a confirmed booking exists for this quotation
    const booking = await this.prisma.booking.findFirst({
      where: { quotationId, status: { not: 'CANCELLED' as any } },
    });
    if (booking) throw new BadRequestException('Quotation is locked — a booking has been confirmed');

    await this.repo.update(quotationId, { status: QuotationStatus.NEGOTIATING });

    let labourCost         = dto.labourCost         ?? 0;
    let materialCost       = dto.materialCost       ?? 0;
    let transportationCost = dto.transportationCost ?? 0;
    let additionalCharges  = dto.additionalCharges  ?? 0;

    if (dto.items?.length) {
      const computed = computeCostsFromItems(dto.items);
      labourCost         = computed.labourCost;
      materialCost       = computed.materialCost;
      transportationCost = computed.transportationCost;
      additionalCharges  = computed.additionalCharges;
    }

    const subtotal    = labourCost + materialCost + transportationCost + additionalCharges;
    const tax         = subtotal * ((dto.taxRate ?? 0) / 100);
    const totalAmount = subtotal + tax;

    const revised = await this.repo.create({
      conversationId: dto.conversationId,
      serviceId:      dto.serviceId,
      providerId,
      customerId:     dto.customerId,
      description:    dto.description,
      labourCost,
      materialCost,
      transportationCost,
      additionalCharges,
      taxRate:        dto.taxRate ?? 0,
      totalAmount,
      notes:          dto.notes,
      validUntil:     dto.validUntil ? new Date(dto.validUntil) : undefined,
      status:         QuotationStatus.PENDING,
      paymentType:    dto.paymentType ?? PaymentType.LABOUR_ONLY,
      parentId:       quotationId,
      revisionNumber: original.revisionNumber + 1,
      ...(dto.items?.length ? { items: { create: buildItemsCreate(dto.items) } } : {}),
    });

    const reviserProfile = await this.prisma.userProfile.findUnique({
      where: { userId: providerId }, select: { displayName: true },
    });

    this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
      userId:   original.customerId,
      type:     'QUOTE_UPDATED',
      ctx:      { artisanName: reviserProfile?.displayName },
      linkData: { quotationId: revised.id, conversationId: dto.conversationId },
    });

    return revised;
  }

  async respond(quotationId: string, customerId: string, dto: RespondQuotationDto) {
    const quotation = await this.get(quotationId);
    if (quotation.customerId !== customerId) throw new ForbiddenException('Not your quotation');
    if (quotation.status !== QuotationStatus.PENDING && quotation.status !== QuotationStatus.NEGOTIATING) {
      throw new BadRequestException('Quotation is not respondable');
    }
    if (quotation.validUntil && quotation.validUntil < new Date()) throw new BadRequestException('Quotation expired');
    if (dto.action === 'REJECTED' && !dto.rejectionReason) throw new BadRequestException('Rejection reason required');

    const updateData: any = {};
    let status: QuotationStatus;

    if (dto.action === 'ACCEPTED') {
      status = QuotationStatus.ACCEPTED;
      updateData.acceptedAt = new Date();
    } else if (dto.action === 'REJECTED') {
      status = QuotationStatus.REJECTED;
      updateData.rejectedAt = new Date();
      updateData.rejectionReason = dto.rejectionReason;
    } else {
      status = QuotationStatus.NEGOTIATING;
    }

    const updated = await this.repo.update(quotationId, { status, ...updateData });

    const notifType = dto.action === 'ACCEPTED' ? 'QUOTE_ACCEPTED' : dto.action === 'REJECTED' ? 'QUOTE_REJECTED' : null;
    if (notifType) {
      this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
        userId:   quotation.providerId,
        type:     notifType,
        ctx:      { rejectionReason: dto.rejectionReason },
        linkData: { quotationId, conversationId: quotation.conversationId },
      });
    }

    return updated;
  }

  async getConversationQuotations(conversationId: string, userId: string) {
    const p = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!p) throw new ForbiddenException('Not a participant');
    return this.repo.findByConversation(conversationId);
  }

  async getMyQuotations(userId: string, role: 'provider' | 'customer', page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    return this.repo.findByUser(userId, role, skip, limit);
  }

  private async get(id: string) {
    const q = await this.repo.findById(id);
    if (!q) throw new NotFoundException('Quotation not found');
    return q;
  }
}
