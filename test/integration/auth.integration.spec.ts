/**
 * Integration tests for the Auth flow against a real PostgreSQL/PostGIS test database.
 *
 * Prerequisites:
 *   TEST_DATABASE_URL must point to a dedicated test database.
 *   Run: npm run test:integration
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaTestService } from '../helpers/prisma-test.service';

describe('Auth (integration)', () => {
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

  afterEach(async () => {
    await prisma.$executeRawUnsafe('DELETE FROM "otp_codes"');
  });

  describe('POST /api/v1/auth/send-otp', () => {
    it('sends OTP to a new phone number and returns isNewUser=true', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/send-otp')
        .send({ phone: '+2348099000001' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ isNewUser: true });
    });

    it('sends OTP to an existing user and returns isNewUser=false', async () => {
      await request(app.getHttpServer()).post('/api/v1/auth/send-otp').send({ phone: '+2348099000002' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/send-otp')
        .send({ phone: '+2348099000002' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ isNewUser: false });
    });

    it('rejects missing phone number with 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/send-otp')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/verify-otp', () => {
    it('returns 401 for an incorrect OTP', async () => {
      await request(app.getHttpServer()).post('/api/v1/auth/send-otp').send({ phone: '+2348099000003' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/verify-otp')
        .send({ phone: '+2348099000003', code: '000000' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('returns 401 for an invalid refresh token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'not-a-real-token' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('returns 401 when no JWT is provided', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({});

      expect(res.status).toBe(401);
    });
  });
});
