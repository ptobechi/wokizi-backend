import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ServiceStatus } from '@prisma/client';
import { AdminService } from './admin.service';
import { PrismaService } from '../../../core/prisma/prisma.service';

const ADMIN_ID   = 'admin-uuid-1';
const SERVICE_ID = 'service-uuid-1';
const PROVIDER_ID = 'provider-uuid-1';

function mockService(overrides: Record<string, any> = {}) {
  return {
    id: SERVICE_ID,
    providerId: PROVIDER_ID,
    title: 'Plumbing Repair',
    status: ServiceStatus.PENDING_REVIEW,
    isPublished: false,
    publishedAt: null,
    ...overrides,
  };
}

describe('AdminService.reviewService', () => {
  let service: AdminService;
  let prisma: any;
  let eventEmitter: any;

  beforeEach(async () => {
    prisma = {
      serviceListing: { findUnique: jest.fn(), update: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  afterEach(() => jest.clearAllMocks());

  it('publishes the service on APPROVED regardless of its prior isPublished value (the regression case)', async () => {
    const existing = mockService({ isPublished: false });
    prisma.serviceListing.findUnique.mockResolvedValue(existing);
    prisma.serviceListing.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...existing, ...data }),
    );

    const result = await service.reviewService(SERVICE_ID, ADMIN_ID, 'APPROVED');

    expect(prisma.serviceListing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SERVICE_ID },
        data: expect.objectContaining({
          status: ServiceStatus.APPROVED,
          isPublished: true,
          publishedAt: expect.any(Date),
        }),
      }),
    );
    expect(result.isPublished).toBe(true);
    expect(result.publishedAt).toBeInstanceOf(Date);
  });

  it('keeps isPublished false on REJECTED', async () => {
    const existing = mockService();
    prisma.serviceListing.findUnique.mockResolvedValue(existing);
    prisma.serviceListing.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...existing, ...data }),
    );

    await service.reviewService(SERVICE_ID, ADMIN_ID, 'REJECTED', 'Missing documents');

    expect(prisma.serviceListing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: ServiceStatus.REJECTED, isPublished: false }),
      }),
    );
    // publishedAt is intentionally left untouched on rejection (no key in the diff object)
    const call = prisma.serviceListing.update.mock.calls[0][0];
    expect(call.data.publishedAt).toBeUndefined();
  });

  it('clears isPublished and publishedAt on SUSPENDED', async () => {
    const existing = mockService({ status: ServiceStatus.APPROVED, isPublished: true, publishedAt: new Date() });
    prisma.serviceListing.findUnique.mockResolvedValue(existing);
    prisma.serviceListing.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...existing, ...data }),
    );

    const result = await service.reviewService(SERVICE_ID, ADMIN_ID, 'SUSPENDED', 'Policy violation');

    expect(prisma.serviceListing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: ServiceStatus.SUSPENDED, isPublished: false, publishedAt: null }),
      }),
    );
    expect(result.isPublished).toBe(false);
    expect(result.publishedAt).toBeNull();
  });

  it('writes exactly one audit log entry per review action', async () => {
    const existing = mockService();
    prisma.serviceListing.findUnique.mockResolvedValue(existing);
    prisma.serviceListing.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...existing, ...data }),
    );

    await service.reviewService(SERVICE_ID, ADMIN_ID, 'APPROVED');

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: ADMIN_ID,
        action: 'SERVICE_APPROVED',
        resource: 'ServiceListing',
        resourceId: SERVICE_ID,
        oldData: expect.objectContaining({ status: ServiceStatus.PENDING_REVIEW, isPublished: false }),
        newData: expect.objectContaining({ status: ServiceStatus.APPROVED, isPublished: true }),
      }),
    });
  });

  it('emits a SERVICE_APPROVED notification to the provider on approval', async () => {
    const existing = mockService();
    prisma.serviceListing.findUnique.mockResolvedValue(existing);
    prisma.serviceListing.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...existing, ...data }),
    );

    await service.reviewService(SERVICE_ID, ADMIN_ID, 'APPROVED');

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'notification.send',
      expect.objectContaining({ userId: PROVIDER_ID, type: 'SERVICE_APPROVED' }),
    );
  });
});
