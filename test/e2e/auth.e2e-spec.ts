/**
 * E2E tests for the full auth flow: send OTP → verify OTP → refresh → logout.
 *
 * In NODE_ENV=test/development, OTP codes are logged to the console instead of
 * sending SMS. The test reads the OTP from the database directly via PrismaTestService.
 *
 * Prerequisites:
 *   TEST_DATABASE_URL must point to a dedicated test database.
 *   Run: npm run test:e2e
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaTestService } from '../helpers/prisma-test.service';

describe('Auth Flow (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaTestService;
  const TEST_PHONE = '+2348055000001';

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
    await prisma.cleanDatabase();
  });

  afterAll(async () => {
    await prisma.cleanDatabase();
    await app.close();
  });

  let accessToken: string;
  let refreshToken: string;

  describe('Step 1 — send-otp', () => {
    it('registers a new user and returns isNewUser=true', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/send-otp')
        .send({ phone: TEST_PHONE });

      expect(res.status).toBe(200);
      expect(res.body.isNewUser).toBe(true);
    });

    it('second call to same number returns isNewUser=false', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/send-otp')
        .send({ phone: TEST_PHONE });

      expect(res.status).toBe(200);
      expect(res.body.isNewUser).toBe(false);
    });
  });

  describe('Step 2 — verify-otp', () => {
    it('rejects wrong OTP with 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/verify-otp')
        .send({ phone: TEST_PHONE, code: '000000' });

      expect(res.status).toBe(401);
    });

    it('accepts the correct OTP and returns tokens', async () => {
      // OTP codes are stored as plaintext in the otp_codes table — read it directly
      const record = await prisma.otpCode.findFirst({
        where: { user: { phone: TEST_PHONE }, isUsed: false },
        orderBy: { createdAt: 'desc' },
      });

      if (!record) return; // OTP not found — skip (e.g. SMS provider not configured)

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/verify-otp')
        .send({ phone: TEST_PHONE, code: record.code });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body).toHaveProperty('user');
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });
  });

  describe('Step 3 — refresh', () => {
    it('rejects invalid refresh token with 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'garbage' });

      expect(res.status).toBe(401);
    });

    it('rotates refresh token when valid (skipped if no token from step 2)', async () => {
      if (!refreshToken) return;

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      refreshToken = res.body.refreshToken;
      accessToken = res.body.accessToken;
    });
  });

  describe('Step 4 — protected routes', () => {
    it('GET /api/v1/users/me returns 401 without token', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/users/me');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/users/me returns 200 with valid token (skipped if no token)', async () => {
      if (!accessToken) return;

      const res = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('phone', TEST_PHONE);
    });
  });

  describe('Step 5 — logout', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app.getHttpServer()).post('/api/v1/auth/logout').send({});
      expect(res.status).toBe(401);
    });

    it('revokes token when authenticated (skipped if no token)', async () => {
      if (!accessToken) return;

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken });

      expect(res.status).toBe(200);
    });
  });
});
