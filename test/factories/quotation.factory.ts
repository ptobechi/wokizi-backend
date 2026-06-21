import { QuotationStatus } from '@prisma/client';
import { v4 as uuid } from 'uuid';

export function buildQuotation(overrides: Record<string, any> = {}) {
  const providerId = uuid();
  const customerId = uuid();
  return {
    id: uuid(),
    conversationId: uuid(),
    providerId,
    customerId,
    status: QuotationStatus.SENT,
    totalAmount: 50000,
    materialCost: 20000,
    labourCost: 30000,
    taxAmount: 0,
    taxRate: 0,
    currency: 'NGN',
    description: 'Test quotation',
    validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    revisionNumber: 1,
    parentId: null,
    lineItems: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
    providerId: overrides.providerId ?? providerId,
    customerId: overrides.customerId ?? customerId,
  };
}
