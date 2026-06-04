import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QuotationStatus } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { QuotationsRepository } from '../repositories/quotations.repository';
import { CreateQuotationDto, RespondQuotationDto } from '../dto/requests/create-quotation.dto';
import { EventName } from '../../../common/enums';

@Injectable()
export class QuotationsService {
  constructor(
    private repo: QuotationsRepository,
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(providerId: string, dto: CreateQuotationDto) {
    const p = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: dto.conversationId, userId: providerId } },
    });
    if (!p) throw new ForbiddenException('Not a participant in this conversation');

    const subtotal = (dto.labourCost || 0) + (dto.materialCost || 0) + (dto.transportationCost || 0) + (dto.additionalCharges || 0);
    const tax = subtotal * ((dto.taxRate || 0) / 100);
    const totalAmount = subtotal + tax;

    const quotation = await this.repo.create({
      conversationId: dto.conversationId, serviceId: dto.serviceId, providerId,
      customerId: dto.customerId, description: dto.description,
      labourCost: dto.labourCost, materialCost: dto.materialCost || 0,
      transportationCost: dto.transportationCost || 0, additionalCharges: dto.additionalCharges || 0,
      taxRate: dto.taxRate || 0, totalAmount, notes: dto.notes,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
      status: QuotationStatus.PENDING,
    });

    this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
      userId: dto.customerId, type: 'NEW_QUOTE', title: 'New Quotation',
      body: `You received a quotation for ₦${totalAmount.toLocaleString()}`,
      data: { quotationId: quotation.id, conversationId: dto.conversationId },
    });

    return quotation;
  }

  async revise(quotationId: string, providerId: string, dto: CreateQuotationDto) {
    const original = await this.get(quotationId);
    if (original.providerId !== providerId) throw new ForbiddenException('Not your quotation');
    if (original.status === QuotationStatus.ACCEPTED || original.status === QuotationStatus.EXPIRED) {
      throw new BadRequestException('Cannot revise this quotation');
    }
    await this.repo.update(quotationId, { status: QuotationStatus.NEGOTIATING });

    const subtotal = (dto.labourCost || 0) + (dto.materialCost || 0) + (dto.transportationCost || 0) + (dto.additionalCharges || 0);
    const tax = subtotal * ((dto.taxRate || 0) / 100);

    return this.repo.create({
      conversationId: dto.conversationId, serviceId: dto.serviceId,
      providerId, customerId: dto.customerId, description: dto.description,
      labourCost: dto.labourCost, materialCost: dto.materialCost || 0,
      transportationCost: dto.transportationCost || 0, additionalCharges: dto.additionalCharges || 0,
      taxRate: dto.taxRate || 0, totalAmount: subtotal + tax, notes: dto.notes,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
      status: QuotationStatus.PENDING, parentId: quotationId,
      revisionNumber: original.revisionNumber + 1,
    });
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

    if (dto.action === 'ACCEPTED') { status = QuotationStatus.ACCEPTED; updateData.acceptedAt = new Date(); }
    else if (dto.action === 'REJECTED') { status = QuotationStatus.REJECTED; updateData.rejectedAt = new Date(); updateData.rejectionReason = dto.rejectionReason; }
    else { status = QuotationStatus.NEGOTIATING; }

    const updated = await this.repo.update(quotationId, { status, ...updateData });

    this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
      userId: quotation.providerId,
      type: dto.action === 'ACCEPTED' ? 'QUOTE_ACCEPTED' : 'QUOTE_REJECTED',
      title: dto.action === 'ACCEPTED' ? 'Quotation Accepted!' : 'Quotation Rejected',
      body: dto.action === 'ACCEPTED' ? 'Your quotation was accepted.' : `Rejected: ${dto.rejectionReason}`,
      data: { quotationId },
    });

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
