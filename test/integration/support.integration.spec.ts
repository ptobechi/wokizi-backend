/**
 * Integration tests for the Support Tickets module.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaTestService } from '../helpers/prisma-test.service';

describe('Support (integration)', () => {
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

  describe('POST /api/v1/support/tickets', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/support/tickets')
        .send({ category: 'PAYMENT', subject: 'Test', description: 'Test desc' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/support/tickets', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/support/tickets');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/support/admin/tickets', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/support/admin/tickets');
      expect(res.status).toBe(401);
    });
  });
});
