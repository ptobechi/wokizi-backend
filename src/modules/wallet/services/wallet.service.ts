import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { TransactionType } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventName } from '../../../common/enums';
import { randomUUID } from 'crypto';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async getOrCreateWallet(userId: string) {
    const existing = await this.prisma.wallet.findUnique({ where: { userId } });
    if (existing) return existing;

    return this.prisma.wallet.create({ data: { userId } });
  }

  async getWallet(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) return this.getOrCreateWallet(userId);
    return wallet;
  }

  async getTransactions(userId: string, page = 1, limit = 20) {
    const wallet = await this.getOrCreateWallet(userId);
    const skip   = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where:   { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.walletTransaction.count({ where: { walletId: wallet.id } }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async creditBalance(userId: string, amount: number, type: TransactionType, description?: string, metadata?: any) {
    const wallet = await this.getOrCreateWallet(userId);

    const [updated, tx] = await this.prisma.$transaction([
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data:  { balance: { increment: amount } },
      }),
      this.prisma.walletTransaction.create({
        data: {
          walletId:      wallet.id,
          type,
          amount:        new Decimal(amount),
          balanceBefore: wallet.balance,
          balanceAfter:  new Decimal(Number(wallet.balance) + amount),
          reference:     randomUUID(),
          description,
          metadata,
        },
      }),
    ]);

    return { wallet: updated, transaction: tx };
  }

  async debitBalance(userId: string, amount: number, type: TransactionType, description?: string, metadata?: any) {
    const wallet = await this.getOrCreateWallet(userId);

    if (Number(wallet.balance) < amount) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    const [updated, tx] = await this.prisma.$transaction([
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data:  { balance: { decrement: amount } },
      }),
      this.prisma.walletTransaction.create({
        data: {
          walletId:      wallet.id,
          type,
          amount:        new Decimal(amount),
          balanceBefore: wallet.balance,
          balanceAfter:  new Decimal(Number(wallet.balance) - amount),
          reference:     randomUUID(),
          description,
          metadata,
        },
      }),
    ]);

    return { wallet: updated, transaction: tx };
  }

  async holdFunds(userId: string, amount: number) {
    const wallet = await this.getOrCreateWallet(userId);

    if (Number(wallet.balance) < amount) {
      throw new BadRequestException('Insufficient wallet balance to hold funds');
    }

    return this.prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        balance:     { decrement: amount },
        heldBalance: { increment: amount },
      },
    });
  }

  async releaseFunds(userId: string, amount: number, toProviderId: string) {
    const customerWallet = await this.getOrCreateWallet(userId);

    await this.prisma.wallet.update({
      where: { id: customerWallet.id },
      data:  { heldBalance: { decrement: amount } },
    });

    return this.creditBalance(toProviderId, amount, TransactionType.EARNING_CREDIT, 'Escrow released for completed booking');
  }

  async refundHeldFunds(userId: string, amount: number) {
    const wallet = await this.getOrCreateWallet(userId);

    return this.prisma.$transaction([
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          heldBalance: { decrement: amount },
          balance:     { increment: amount },
        },
      }),
      this.prisma.walletTransaction.create({
        data: {
          walletId:      wallet.id,
          type:          TransactionType.REFUND,
          amount:        new Decimal(amount),
          balanceBefore: wallet.balance,
          balanceAfter:  new Decimal(Number(wallet.balance) + amount),
          reference:     randomUUID(),
          description:   'Escrow refunded',
        },
      }),
    ]);
  }
}
