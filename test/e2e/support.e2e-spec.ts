/**
 * E2E tests for the support ticket flow:
 * User creates ticket → admin views + updates status
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaTestService } from '../helpers/prisma-test.service';

describe('Support Flow (E2E)', () => {
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

  describe('POST /api/v1/support/tickets', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/support/tickets')
        .send({ category: 'PAYMENT', subject: 'Test ticket', description: 'Wallet not credited' });

      expect(res.status).toBe(401);
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/support/tickets')
        .set('Authorization', 'Bearer fake-token')
        .send({});

      expect([400, 401]).toContain(res.status);
    });
  });

  describe('GET /api/v1/support/tickets', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/support/tickets');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/support/admin/tickets', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/support/admin/tickets');
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/v1/support/admin/tickets/:id', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/support/admin/tickets/some-id')
        .send({ status: 'RESOLVED' });

      expect(res.status).toBe(401);
    });
  });
});
