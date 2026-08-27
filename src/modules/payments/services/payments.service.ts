import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  RawBodyRequest,
} from '@nestjs/common';
import { PaymentAuditEvent, PaymentStatus, PaymentType, TransactionType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { PaystackService } from '../../../integrations/paystack/paystack.service';
import { WalletService } from '../../wallet/services/wallet.service';
import { EventName } from '../../../common/enums';
import { randomUUID } from 'crypto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private paystack: PaystackService,
    private walletService: WalletService,
    private eventEmitter: EventEmitter2,
    private config: ConfigService,
  ) {}

  // ── Wallet Funding — Initialize ───────────────────────────────────────────────

  async initiateFunding(userId: string, amount: number) {
    if (amount <= 0) throw new BadRequestException('Amount must be greater than 0');

    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { email: true, phone: true },
    });
    const email = user?.email ?? `${userId}@wokizi.app`;

    const reference = `fund-${userId}-${Date.now()}`;

    const result = await this.paystack.initializePayment(
      amount,
      email,
      reference,
      { userId, type: 'wallet_funding' },
    );

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        paymentType:      PaymentType.LABOUR_ONLY,
        status:           PaymentStatus.PENDING,
        amount:           new Decimal(amount),
        currency:         'NGN',
        providerName:     'paystack',
        paystackReference: result.reference,
        reference,
        metadata:         { accessCode: result.accessCode },
      },
    });

    await this.audit(payment.id, PaymentAuditEvent.INITIALIZED, { reference, amount });

    return {
      reference:        result.reference,
      authorizationUrl: result.authorizationUrl,
      accessCode:       result.accessCode,
    };
  }

  // ── Wallet Funding — Verify (client-side poll) ────────────────────────────────

  async verifyFunding(userId: string, reference: string) {
    const payment = await this.prisma.payment.findUnique({ where: { paystackReference: reference } });
    if (!payment) throw new NotFoundException('Payment record not found');
    if (payment.userId !== userId) throw new ForbiddenException();

    if (payment.status === PaymentStatus.COMPLETED) {
      return { success: true, amount: Number(payment.amount), alreadyProcessed: true };
    }

    const verify = await this.paystack.verifyPayment(reference);

    if (!verify.success) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data:  { status: PaymentStatus.FAILED, failureReason: verify.error },
      });
      await this.audit(payment.id, PaymentAuditEvent.VERIFIED, { success: false, error: verify.error });
      throw new BadRequestException(verify.error ?? 'Payment verification failed');
    }

    return this.creditWalletFromPayment(payment.id, userId, verify.amount, verify.channel ?? 'card', reference);
  }

  // ── Paystack Webhook Handler ──────────────────────────────────────────────────

  async handleWebhook(rawBody: string, signature: string) {
    const valid = this.paystack.validateWebhookSignature(rawBody, signature);
    if (!valid) {
      this.logger.warn('Paystack webhook: invalid signature — rejected');
      return { received: false };
    }

    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return { received: false };
    }

    this.logger.log(`Paystack webhook: ${event.event}`);

    switch (event.event) {
      case 'charge.success':
        await this.onChargeSuccess(event.data);
        break;
      case 'transfer.success':
        await this.onTransferSuccess(event.data);
        break;
      case 'transfer.failed':
      case 'transfer.reversed':
        await this.onTransferFailed(event.data);
        break;
      case 'refund.processed':
        await this.onRefundProcessed(event.data);
        break;
      default:
        this.logger.debug(`Unhandled Paystack event: ${event.event}`);
    }

    return { received: true };
  }

  private async onChargeSuccess(data: any) {
    const reference = data.reference as string;
    const payment   = await this.prisma.payment.findUnique({ where: { paystackReference: reference } });
    if (!payment) {
      this.logger.warn(`charge.success: no payment found for reference ${reference}`);
      return;
    }
    if (payment.status === PaymentStatus.COMPLETED) return; // idempotent

    const amountNaira = data.amount / 100;
    await this.creditWalletFromPayment(payment.id, payment.userId, amountNaira, data.channel, reference);
    await this.audit(payment.id, PaymentAuditEvent.WEBHOOK_RECEIVED, { event: 'charge.success', reference });
  }

  private async onTransferSuccess(data: any) {
    const transferCode = data.transfer_code as string;
    const withdrawal   = await this.prisma.withdrawal.findFirst({ where: { transferCode } });
    if (!withdrawal) return;

    await this.prisma.withdrawal.update({
      where: { id: withdrawal.id },
      data:  { status: 'COMPLETED', processedAt: new Date() },
    });

    this.eventEmitter.emit(EventName.WITHDRAWAL_PROCESSED, { withdrawalId: withdrawal.id, approved: true });
    this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
      userId:   withdrawal.userId,
      type:     'WITHDRAWAL_COMPLETED',
      ctx:      { amount: Number(withdrawal.amount) },
      linkData: { screen: 'wallet' },
    });
  }

  private async onTransferFailed(data: any) {
    const transferCode = data.transfer_code as string;
    const withdrawal   = await this.prisma.withdrawal.findFirst({ where: { transferCode } });
    if (!withdrawal) return;

    // Refund the debited amount back to wallet
    await this.walletService.creditBalance(
      withdrawal.userId,
      Number(withdrawal.amount),
      TransactionType.REFUND,
      'Withdrawal transfer failed — funds returned',
    );

    await this.prisma.withdrawal.update({
      where: { id: withdrawal.id },
      data:  { status: 'REJECTED', adminNote: 'Transfer failed via Paystack', processedAt: new Date() },
    });

    this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
      userId:   withdrawal.userId,
      type:     'TRANSFER_FAILED',
      ctx:      { amount: Number(withdrawal.amount) },
      linkData: { screen: 'wallet' },
    });
  }

  private async onRefundProcessed(data: any) {
    this.logger.log(`Refund processed: ${JSON.stringify(data)}`);
  }

  private async creditWalletFromPayment(
    paymentId: string,
    userId: string,
    amountNaira: number,
    channel: string,
    reference: string,
  ) {
    await this.prisma.payment.update({
      where: { id: paymentId },
      data:  { status: PaymentStatus.COMPLETED, paystackChannel: channel },
    });

    await this.walletService.creditBalance(userId, amountNaira, TransactionType.FUNDING, 'Wallet funded via Paystack', { reference, channel });

    this.eventEmitter.emit(EventName.WALLET_FUNDED, { userId, amount: amountNaira });
    this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
      userId,
      type:     'WALLET_FUNDED',
      ctx:      { amount: amountNaira },
      linkData: { screen: 'wallet' },
    });

    await this.audit(paymentId, PaymentAuditEvent.VERIFIED, { success: true, amount: amountNaira, channel });

    return { success: true, amount: amountNaira };
  }

  // ── Escrow ────────────────────────────────────────────────────────────────────

  // Keyed off the booking alone (not a quotationId) so this works for both
  // booking origins. A Quotation-origin booking keeps its existing
  // payment-type-aware amount (LABOUR_ONLY needs no escrow at all); a
  // ServiceRequest-origin booking has no such concept and always escrows
  // the full canonical Booking.totalAmount up front.
  async createEscrow(customerId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { quotation: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.customerId !== customerId) throw new ForbiddenException();

    const existing = await this.prisma.escrowReservation.findUnique({ where: { bookingId } });
    if (existing) return existing;

    let escrowAmount = 0;
    if (booking.quotation) {
      const paymentType = (booking.quotation as any).paymentType as PaymentType;
      if (paymentType === PaymentType.MATERIALS_REQUIRED) {
        escrowAmount = Number(booking.quotation.materialCost);
      } else if (paymentType === PaymentType.FULL_PROJECT) {
        escrowAmount = Number(booking.quotation.totalAmount);
      } else {
        return null; // LABOUR_ONLY
      }
    } else {
      escrowAmount = Number(booking.totalAmount);
    }

    if (escrowAmount <= 0) return null;

    const wallet = await this.walletService.getWallet(customerId);
    if (Number(wallet.balance) < escrowAmount) {
      throw new BadRequestException(
        `Insufficient wallet balance. Please fund your wallet with at least ₦${escrowAmount.toLocaleString()}.`,
      );
    }

    await this.walletService.holdFunds(customerId, escrowAmount);

    const escrow = await this.prisma.escrowReservation.create({
      data: {
        bookingId,
        customerId,
        providerId: booking.providerId,
        amount:     new Decimal(escrowAmount),
        status:     PaymentStatus.COMPLETED,
      },
    });

    const walletRecord = await this.walletService.getOrCreateWallet(customerId);
    await this.prisma.walletTransaction.create({
      data: {
        walletId:      walletRecord.id,
        type:          TransactionType.ESCROW_HOLD,
        amount:        new Decimal(escrowAmount),
        balanceBefore: wallet.balance,
        balanceAfter:  new Decimal(Number(wallet.balance) - escrowAmount),
        reference:     randomUUID(),
        description:   `Escrow hold for booking ${bookingId}`,
        metadata:      { bookingId, escrowId: escrow.id },
      },
    });

    this.eventEmitter.emit(EventName.ESCROW_HELD, { customerId, bookingId, amount: escrowAmount });
    this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
      userId:   customerId,
      type:     'PAYMENT_SUCCESSFUL',
      ctx:      { amount: escrowAmount, note: 'Funds held in escrow for your booking' },
      linkData: { bookingId },
    });

    return escrow;
  }

  async releaseEscrow(bookingId: string) {
    const escrow = await this.prisma.escrowReservation.findUnique({ where: { bookingId } });
    if (!escrow || escrow.status !== PaymentStatus.COMPLETED) return;

    await this.walletService.releaseFunds(escrow.customerId, Number(escrow.amount), escrow.providerId);

    await this.prisma.escrowReservation.update({
      where: { id: escrow.id },
      data:  { status: PaymentStatus.REFUNDED, releasedAt: new Date() },
    });

    this.eventEmitter.emit(EventName.ESCROW_RELEASED, { bookingId, providerId: escrow.providerId, amount: Number(escrow.amount) });
    this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
      userId:   escrow.providerId,
      type:     'PAYMENT_RECEIVED',
      ctx:      { amount: Number(escrow.amount) },
      linkData: { bookingId },
    });
  }

  async refundEscrow(bookingId: string) {
    const escrow = await this.prisma.escrowReservation.findUnique({ where: { bookingId } });
    if (!escrow || escrow.status !== PaymentStatus.COMPLETED) return;

    await this.walletService.refundHeldFunds(escrow.customerId, Number(escrow.amount));

    await this.prisma.escrowReservation.update({
      where: { id: escrow.id },
      data:  { status: PaymentStatus.REFUNDED, refundedAt: new Date() },
    });

    this.eventEmitter.emit(EventName.ESCROW_REFUNDED, { bookingId, customerId: escrow.customerId });
    this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
      userId:   escrow.customerId,
      type:     'REFUND_ISSUED',
      ctx:      { amount: Number(escrow.amount) },
      linkData: { bookingId },
    });
  }

  // ── Escrow gate check ─────────────────────────────────────────────────────────

  async hasRequiredEscrow(quotationId: string, bookingId?: string): Promise<boolean> {
    const quotation = await this.prisma.quotation.findUnique({ where: { id: quotationId } });
    if (!quotation) return false;

    const paymentType = (quotation as any).paymentType as PaymentType;
    if (paymentType === PaymentType.LABOUR_ONLY) return true;
    if (!bookingId) return false;

    const escrow = await this.prisma.escrowReservation.findUnique({ where: { bookingId } });
    return !!escrow && escrow.status === PaymentStatus.COMPLETED;
  }

  // ── Admin: payment list ───────────────────────────────────────────────────────

  async adminListPayments(page = 1, limit = 20, status?: string) {
    const where: any = status ? { status } : {};
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: { user: { select: { phone: true, profile: { select: { displayName: true } } } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take:    limit,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── Audit helper ──────────────────────────────────────────────────────────────

  private async audit(paymentId: string | null, event: PaymentAuditEvent, data?: Record<string, unknown>) {
    try {
      await this.prisma.paymentAudit.create({ data: { paymentId, event, data: data as any } });
    } catch (err) {
      this.logger.warn(`Audit write failed: ${err}`);
    }
  }
}
