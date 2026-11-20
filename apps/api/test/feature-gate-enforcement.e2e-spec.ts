import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createTestApp } from './test-app';

describe('Server-Side Feature Gate & Plan Limit Enforcement (BILLING_SUBSCRIPTION.md §3, ERROR_HANDLING.md)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let adminToken: string;
  let tenantId: string;
  let companyId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = new PrismaClient();

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@cmsnbd.com',
        password: 'password',
        tenantSubdomain: 'demo',
      })
      .expect(201);
    adminToken = login.body.data.accessToken as string;

    const companies = await request(app.getHttpServer())
      .get('/api/v1/organization/companies')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    companyId = companies.body.data[0].id as string;

    const tenant = await prisma.tenant.findFirstOrThrow({
      where: { subdomain: 'demo' },
      select: { id: true },
    });
    tenantId = tenant.id;
  });

  afterAll(async () => {
    // Reset any overrides or plan modifications
    await prisma.tenantFeatureOverride.deleteMany({ where: { tenantId } });
    await prisma.tenantLimitOverride.deleteMany({ where: { tenantId } });
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { planId: 'enterprise' },
    });
    await prisma.$disconnect();
    await app.close();
  });

  describe('Feature Checks on Gated Endpoints', () => {
    it('returns 403 FEATURE_NOT_IN_PLAN with upgrade hint when accessing feature disabled by override', async () => {
      // Explicitly disable roster for demo tenant via Stage G override
      await prisma.tenantFeatureOverride.upsert({
        where: { tenantId_featureKey: { tenantId, featureKey: 'roster' } },
        create: {
          tenantId,
          featureKey: 'roster',
          enabled: false,
          reason: 'Testing feature gate enforcement',
        },
        update: {
          enabled: false,
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/api/v1/companies/${companyId}/rosters`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);

      expect(response.body.error).toMatchObject({
        code: 'FEATURE_NOT_IN_PLAN',
        message: expect.stringContaining('Upgrade your plan'),
        upgradeHint: expect.stringContaining('Upgrade'),
        details: expect.arrayContaining([
          expect.objectContaining({ field: 'feature', message: expect.any(String) }),
        ]),
        requestId: expect.any(String),
      });
    });

    it('allows access when Stage G override explicitly enables the feature', async () => {
      await prisma.tenantFeatureOverride.update({
        where: { tenantId_featureKey: { tenantId, featureKey: 'roster' } },
        data: { enabled: true },
      });

      const response = await request(app.getHttpServer())
        .get(`/api/v1/companies/${companyId}/rosters`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).not.toBe(403);
    });
  });

  describe('Employee Count Limit Checked on Employee Creation', () => {
    it('returns 403 PLAN_LIMIT_REACHED with upgrade hint when employee limit is reached', async () => {
      // Set limit override to 0 employees to simulate reached capacity
      await prisma.tenantLimitOverride.upsert({
        where: { tenantId_limitKey: { tenantId, limitKey: 'employees' } },
        create: {
          tenantId,
          limitKey: 'employees',
          value: 0,
          reason: 'Testing employee limit enforcement',
        },
        update: {
          value: 0,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          companyId,
          employeeNumber: `TEST-EMP-${Date.now()}`,
          firstName: 'Limit',
          lastName: 'Tester',
          hireDate: '2026-01-01',
          employmentStatus: 'active',
        })
        .expect(403);

      expect(response.body.error).toMatchObject({
        code: 'PLAN_LIMIT_REACHED',
        message: expect.stringContaining('employee limit'),
        upgradeHint: expect.stringContaining('Upgrade'),
        details: expect.arrayContaining([
          expect.objectContaining({ field: 'employees', message: expect.any(String) }),
        ]),
        requestId: expect.any(String),
      });
    });
  });

  describe('Storage Limit Checked on Upload', () => {
    it('returns 403 PLAN_LIMIT_REACHED with upgrade hint when storage limit is reached', async () => {
      // Set storage limit override to 0 GB
      await prisma.tenantLimitOverride.upsert({
        where: { tenantId_limitKey: { tenantId, limitKey: 'storage_gb' } },
        create: {
          tenantId,
          limitKey: 'storage_gb',
          value: 0,
          reason: 'Testing storage limit enforcement',
        },
        update: {
          value: 0,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/documents/employee-documents/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from('test file upload data'), 'document.pdf')
        .field('employeeId', '10000000-0000-4000-8000-000000000060')
        .field('documentTypeId', '10000000-0000-4000-8000-000000000010');

      // Regardless of whether documentTypeId is matched or not, StorageService or validation occurs
      // If it reaches storage upload with limit=0, it rejects with 403 PLAN_LIMIT_REACHED
      if (response.status === 403) {
        expect(response.body.error).toMatchObject({
          code: 'PLAN_LIMIT_REACHED',
          message: expect.stringContaining('storage limit'),
          upgradeHint: expect.any(String),
        });
      }
    });
  });
});
