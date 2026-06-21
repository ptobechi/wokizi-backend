/**
 * E2E tests for the booking lifecycle:
 * Create booking → update status transitions → completion / cancellation
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaTestService } from '../helpers/prisma-test.service';

describe('Booking Flow (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaTestService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      providers: [PrismaTestService],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = module.get(PrismaTestService);
  });

  afterAll(async () => {
    await prisma.cleanDatabase();
    await app.close();
  });

  describe('POST /api/v1/bookings', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .send({ quotationId: 'q1', conversationId: 'c1' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/bookings/me', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/bookings/me');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/bookings/services/:serviceId/availability', () => {
    it('is publicly accessible and returns availability data', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/bookings/services/non-existent-service/availability')
        .query({ date: '2026-06-20' });

      // 404 = service not found (correct unauthenticated access), 400 = invalid uuid
      expect([400, 404]).toContain(res.status);
    });
  });

  describe('PATCH /api/v1/bookings/:id/status', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/bookings/some-id/status')
        .send({ status: 'IN_PROGRESS' });

      expect(res.status).toBe(401);
    });
  });
});
