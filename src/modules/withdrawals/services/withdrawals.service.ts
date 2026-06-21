import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { WithdrawalStatus, TransactionType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { WalletService } from '../../wallet/services/wallet.service';
import { PaystackService } from '../../../integrations/paystack/paystack.service';
import { EventName } from '../../../common/enums';
import { CreateWithdrawalDto } from '../dto/create-withdrawal.dto';
import { randomUUID } from 'crypto';

const MIN_WITHDRAWAL = 100;

@Injectable()
export class WithdrawalsService {
  private readonly logger = new Logger(WithdrawalsService.name);

  constructor(
    private prisma: PrismaService,
    private walletService: WalletService,
    private paystack: PaystackService,
    private eventEmitter: EventEmitter2,
  ) {}

  // ── Provider: request withdrawal ──────────────────────────────────────────────

  async requestWithdrawal(userId: string, dto: CreateWithdrawalDto) {
    if (dto.amount < MIN_WITHDRAWAL) {
      throw new BadRequestException(`Minimum withdrawal is ₦${MIN_WITHDRAWAL}`);
    }

    const wallet = await this.walletService.getWallet(userId);
    if (Number(wallet.balance) < dto.amount) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    // Reserve funds immediately so user cannot spend them while pending
    await this.walletService.debitBalance(userId, dto.amount, TransactionType.WITHDRAWAL, 'Withdrawal pending approval');

    const withdrawal = await this.prisma.withdrawal.create({
      data: {
        userId,
        amount:        new Decimal(dto.amount),
        bankName:      dto.bankName,
        bankCode:      dto.bankCode,
        accountNumber: dto.accountNumber,
        accountName:   dto.accountName,
        reference:     `wdl-${randomUUID()}`,
        status:        WithdrawalStatus.PENDING,
      },
    });

    this.eventEmitter.emit(EventName.WITHDRAWAL_REQUESTED, { userId, amount: dto.amount, withdrawalId: withdrawal.id });
    this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
      userId,
      type:     'WITHDRAWAL_REQUESTED',
      ctx:      { amount: dto.amount },
      linkData: { screen: 'wallet' },
    });

    return withdrawal;
  }

  async listMine(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.withdrawal.findMany({
        where:   { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take:    limit,
      }),
      this.prisma.withdrawal.count({ where: { userId } }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── Admin: list withdrawals ───────────────────────────────────────────────────

  async adminList(status?: string, page = 1, limit = 20) {
    const where: any = status ? { status: status as WithdrawalStatus } : {};
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.withdrawal.findMany({
        where,
        include: { user: { select: { phone: true, profile: { select: { displayName: true } } } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take:    limit,
      }),
      this.prisma.withdrawal.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── Admin: list available banks ───────────────────────────────────────────────

  async listBanks() {
    return this.paystack.listBanks();
  }

  // ── Admin: approve/reject ─────────────────────────────────────────────────────

  async adminProcess(withdrawalId: string, action: 'APPROVE' | 'REJECT', adminNote?: string) {
    const withdrawal = await this.prisma.withdrawal.findUnique({ where: { id: withdrawalId } });
    if (!withdrawal) throw new NotFoundException('Withdrawal not found');
    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      throw new BadRequestException('Withdrawal is not in PENDING state');
    }

    if (action === 'REJECT') {
      // Refund reserved funds
      await this.walletService.creditBalance(
        withdrawal.userId,
        Number(withdrawal.amount),
        TransactionType.REFUND,
        'Withdrawal rejected — funds returned',
      );

      const updated = await this.prisma.withdrawal.update({
        where: { id: withdrawalId },
        data:  { status: WithdrawalStatus.REJECTED, adminNote, processedAt: new Date() },
      });

      this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
        userId:   withdrawal.userId,
        type:     'REFUND_ISSUED',
        ctx:      { amount: Number(withdrawal.amount) },
        linkData: { screen: 'wallet' },
      });

      return updated;
    }

    // APPROVE — initiate Paystack transfer
    const recipientResult = await this.paystack.createTransferRecipient(
      withdrawal.accountName,
      withdrawal.accountNumber,
      withdrawal.bankCode,
    );

    if (!recipientResult.success || !recipientResult.recipientCode) {
      throw new BadRequestException(`Failed to create transfer recipient: ${recipientResult.error}`);
    }

    const transferResult = await this.paystack.initiateTransfer(
      Number(withdrawal.amount),
      recipientResult.recipientCode,
      withdrawal.reference,
      `Wokizi withdrawal for ${withdrawal.accountName}`,
    );

    if (!transferResult.success) {
      this.logger.error(`Transfer initiation failed for withdrawal ${withdrawalId}: ${transferResult.error}`);
      throw new BadRequestException(`Transfer initiation failed: ${transferResult.error}`);
    }

    const updated = await this.prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status:        WithdrawalStatus.PROCESSING,
        recipientCode: recipientResult.recipientCode,
        transferCode:  transferResult.transferCode,
        adminNote,
        processedAt:   new Date(),
      },
    });

    this.eventEmitter.emit(EventName.WITHDRAWAL_PROCESSED, { withdrawalId, userId: withdrawal.userId, approved: true });
    this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
      userId:   withdrawal.userId,
      type:     'WITHDRAWAL_APPROVED',
      ctx:      { amount: Number(withdrawal.amount) },
      linkData: { screen: 'wallet' },
    });

    return updated;
  }
}
