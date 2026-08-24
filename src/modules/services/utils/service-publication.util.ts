import { Prisma } from '@prisma/client';

// Single source of truth for what each publication transition means. Used by
// both AdminService.reviewService() (admin approval/rejection/suspension) and
// ServiceListingsService.publish()/unpublish() (provider self-service toggle
// on an already-approved service) so there is exactly one place that decides
// what "publishing" a service actually does to its fields.

export function publishFields(): Prisma.ServiceListingUpdateInput {
  return { isPublished: true, publishedAt: new Date() };
}

// Provider-initiated pause. publishedAt is left untouched — it records the
// most recent go-live time, and a pause/resume cycle shouldn't erase that.
export function unpublishFields(): Prisma.ServiceListingUpdateInput {
  return { isPublished: false };
}

// Admin-forced takedown. A harder reset than a provider pause, so publishedAt
// is cleared rather than preserved.
export function suspendPublicationFields(): Prisma.ServiceListingUpdateInput {
  return { isPublished: false, publishedAt: null };
}
