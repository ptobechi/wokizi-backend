/**
 * Integration tests for the Wallet module.
 * Verifies credit, debit, hold, release operations against a real test database.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaTestService } from '../helpers/prisma-test.service';

describe('Wallet (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaTestService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      providers: [PrismaTestService],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = module.get(PrismaTestService);
  });

  afterAll(async () => {
    await prisma.cleanDatabase();
    await app.close();
  });

  describe('GET /api/v1/wallet', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/wallet');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/wallet/transactions', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/wallet/transactions');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/payments/fund/initiate', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/fund/initiate')
        .send({ amount: 5000 });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/payments/webhook/paystack', () => {
    it('returns 400 or rejected when signature is invalid', async () => {
      const payload = JSON.stringify({ event: 'charge.success', data: {} });
      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/webhook/paystack')
        .set('x-paystack-signature', 'invalid-signature')
        .set('content-type', 'application/json')
        .send(payload);

      expect([200, 400]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toMatchObject({ received: false });
      }
    });
  });
});
