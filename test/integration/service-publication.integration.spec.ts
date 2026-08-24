/**
 * Integration tests for the service approval -> publication pipeline.
 *
 * Regression coverage for: admin approves a service, but it never actually
 * goes live (isPublished stayed false), so it was invisible in the feed,
 * search, and "View Service" (GET /services/:slug) 404'd with
 * "Service not found".
 *
 * Uses `prisma.*.create()` directly for setup (not the shared test factories
 * in test/factories/*.ts, which reference enum values — e.g. UserStatus —
 * that no longer exist on the current schema; a pre-existing issue unrelated
 * to this fix) and drives the actual fix end-to-end over real HTTP.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
// NOTE: `import * as request from 'supertest'` fails to typecheck across
// every existing integration spec in this repo (a pre-existing @types/supertest
// mismatch, not introduced here) — using the TS `import = require()` form
// works around it locally without touching the shared tsconfig.
import request = require('supertest');
import * as bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import { UserRole, ServiceStatus } from '@prisma/client';
import { AppModule } from '../../src/app.module';
import { PrismaTestService } from '../helpers/prisma-test.service';
import { TransformInterceptor } from '../../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';

describe('Service publication pipeline (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaTestService;
  let categoryId: string;
  let adminToken: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      providers: [PrismaTestService],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    // Mirror src/main.ts's bootstrap() exactly — a bare createNestApplication()
    // doesn't pick any of this up automatically, and the response envelope
    // (TransformInterceptor) is what the assertions below depend on.
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }));
    app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)), new TransformInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = module.get(PrismaTestService);
    // NOTE: intentionally not calling prisma.cleanDatabase() here — that
    // shared helper references tables that don't match the current schema
    // (e.g. 'support_ticket_messages', which doesn't exist anywhere; a
    // pre-existing test-infra issue unrelated to this fix). Every fixture
    // below uses a uuid-suffixed unique value instead, so this suite is
    // self-isolating without a full-database truncate.
    const suffix = uuid();

    const category = await prisma.category.create({
      data: { name: `Test Plumbing ${suffix}`, slug: `test-plumbing-${suffix}` },
    });
    categoryId = category.id;

    const adminEmail = `admin-${uuid()}@wokizi.test`;
    const adminPassword = 'Test@Admin123';
    await prisma.user.create({
      data: {
        phone: `+2340${Math.floor(100000000 + Math.random() * 899999999)}`,
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 12),
        role: UserRole.SUPER_ADMIN,
        isActive: true,
        isPhoneVerified: true,
      },
    });

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/admin/login')
      .send({ email: adminEmail, password: adminPassword });
    adminToken = loginRes.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  async function createProviderWithService(overrides: { status?: ServiceStatus } = {}) {
    const provider = await prisma.user.create({
      data: {
        phone: `+2348${Math.floor(10000000 + Math.random() * 89999999)}`,
        role: UserRole.USER,
        isActive: true,
        isPhoneVerified: true,
        profile: { create: { displayName: 'Test Provider', isProvider: true } },
      },
    });

    const slug = `test-service-${uuid()}`;
    const service = await prisma.serviceListing.create({
      data: {
        providerId: provider.id,
        categoryId,
        title: `Professional Plumbing ${slug}`,
        slug,
        description: 'A test service for the publication pipeline.',
        startingPrice: 5000,
        status: overrides.status ?? ServiceStatus.PENDING_REVIEW,
      },
    });

    return { provider, service };
  }

  it('approving a PENDING_REVIEW service publishes it immediately', async () => {
    const { service } = await createProviderWithService();

    const reviewRes = await request(app.getHttpServer())
      .patch(`/api/v1/admin/services/${service.id}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'APPROVED' });

    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.data.status).toBe('APPROVED');
    expect(reviewRes.body.data.isPublished).toBe(true);
    expect(reviewRes.body.data.publishedAt).not.toBeNull();

    // "View Service" — previously 404'd with "Service not found" because
    // isPublished never flipped true.
    const detailRes = await request(app.getHttpServer()).get(`/api/v1/services/${service.slug}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.id).toBe(service.id);

    // Appears in the default (non-geo) feed.
    const feedRes = await request(app.getHttpServer()).get('/api/v1/feed');
    expect(feedRes.status).toBe(200);
    const feedIds = feedRes.body.data.data.map((s: any) => s.id);
    expect(feedIds).toContain(service.id);

    // Appears in search suggestions.
    const searchRes = await request(app.getHttpServer())
      .get('/api/v1/search/suggestions')
      .query({ q: service.slug.slice(0, 20) });
    expect(searchRes.status).toBe(200);
    const suggestedSlugs = searchRes.body.data.map((s: any) => s.slug);
    expect(suggestedSlugs).toContain(service.slug);

    // Exactly one audit log entry was written for this approval.
    const auditLogs = await prisma.auditLog.findMany({ where: { resourceId: service.id } });
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].action).toBe('SERVICE_APPROVED');
  });

  it('rejecting a service keeps it unpublished and invisible', async () => {
    const { service } = await createProviderWithService();

    const reviewRes = await request(app.getHttpServer())
      .patch(`/api/v1/admin/services/${service.id}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'REJECTED', reason: 'Incomplete documentation' });

    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.data.isPublished).toBe(false);

    const detailRes = await request(app.getHttpServer()).get(`/api/v1/services/${service.slug}`);
    expect(detailRes.status).toBe(404);
  });

  it('suspending a previously-approved service unpublishes it and clears publishedAt', async () => {
    const { service } = await createProviderWithService({ status: ServiceStatus.APPROVED });
    await prisma.serviceListing.update({ where: { id: service.id }, data: { isPublished: true, publishedAt: new Date() } });

    const reviewRes = await request(app.getHttpServer())
      .patch(`/api/v1/admin/services/${service.id}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'SUSPENDED', reason: 'Policy violation' });

    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.data.isPublished).toBe(false);
    expect(reviewRes.body.data.publishedAt).toBeNull();

    const detailRes = await request(app.getHttpServer()).get(`/api/v1/services/${service.slug}`);
    expect(detailRes.status).toBe(404);
  });
});
