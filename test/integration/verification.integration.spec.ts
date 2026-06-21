/**
 * Integration tests for the Verification (KYC) module.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaTestService } from '../helpers/prisma-test.service';

describe('Verification (integration)', () => {
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

  describe('POST /api/v1/verification/submit', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/verification/submit')
        .send({ idType: 'NIN', idNumber: '12345678901' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/verification/me', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/verification/me');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/verification/pending', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/verification/pending');
      expect(res.status).toBe(401);
    });
  });
});
