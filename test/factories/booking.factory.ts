import { BookingStatus, EscrowType } from '@prisma/client';
import { v4 as uuid } from 'uuid';

export function buildBooking(overrides: Record<string, any> = {}) {
  const customerId = uuid();
  const providerId = uuid();
  return {
    id: uuid(),
    customerId,
    providerId,
    quotationId: uuid(),
    conversationId: uuid(),
    serviceListingId: uuid(),
    status: BookingStatus.CONFIRMED,
    escrowType: EscrowType.LABOUR_ONLY,
    scheduledAt: null,
    completedAt: null,
    cancellationReason: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
    customerId: overrides.customerId ?? customerId,
    providerId: overrides.providerId ?? providerId,
  };
}
