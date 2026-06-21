import { ConversationStatus } from '@prisma/client';
import { v4 as uuid } from 'uuid';

export function buildConversation(overrides: Record<string, any> = {}) {
  return {
    id: uuid(),
    status: ConversationStatus.OPEN,
    serviceListingId: uuid(),
    isArchived: false,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
