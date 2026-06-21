import { PaymentStatus, TransactionType } from '@prisma/client';
import { v4 as uuid } from 'uuid';

export function buildWallet(userId: string, overrides: Record<string, any> = {}) {
  return {
    id: uuid(),
    userId,
    balance: 100000,
    heldBalance: 0,
    totalEarned: 0,
    totalSpent: 0,
    currency: 'NGN',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function buildPayment(userId: string, overrides: Record<string, any> = {}) {
  return {
    id: uuid(),
    userId,
    walletId: uuid(),
    reference: `PAY_${uuid()}`,
    amount: 50000,
    status: PaymentStatus.PENDING,
    paystackRef: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function buildWalletTransaction(walletId: string, overrides: Record<string, any> = {}) {
  return {
    id: uuid(),
    walletId,
    type: TransactionType.CREDIT,
    amount: 50000,
    balance: 100000,
    reference: `TXN_${uuid()}`,
    description: 'Test transaction',
    metadata: null,
    createdAt: new Date(),
    ...overrides,
  };
}
