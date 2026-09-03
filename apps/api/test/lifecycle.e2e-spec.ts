import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createTestApp } from './test-app';

describe('Employee Lifecycle Events (MODULES.md §05)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let adminToken: string;
  let payrollToken: string;
  let employeeId: string;
  let designationId: string;
  let createdEventId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = new PrismaClient();

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@cmsnbd.com',
        password: 'password',
        tenantSubdomain: 'demo',
      })
      .expect(201);
    adminToken = adminLogin.body.data.accessToken as string;

    const payrollLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'payroll@cmsnbd.com',
        password: 'password',
        tenantSubdomain: 'demo',
      })
      .expect(201);
    payrollToken = payrollLogin.body.data.accessToken as string;

    const employees = await request(app.getHttpServer())
      .get('/api/v1/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const target = employees.body.data.find(
      (e: { employeeNumber: string }) => e.employeeNumber === 'EMP-010',
    );
    employeeId = target?.id ?? employees.body.data[0].id;

    const companies = await request(app.getHttpServer())
      .get('/api/v1/organization/companies')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const companyId = companies.body.data[0].id as string;

    const designations = await request(app.getHttpServer())
      .get(`/api/v1/organization/companies/${companyId}/designations`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    designationId = designations.body.data[0].id as string;
  });

  afterAll(async () => {
    if (createdEventId) {
      await prisma.employeeLifecycleEvent
        .delete({ where: { id: createdEventId } })
        .catch(() => undefined);
    }
    await prisma.$disconnect();
    await app.close();
  });

  it('denies lifecycle create without employee:edit', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/employees/${employeeId}/lifecycle-events`)
      .set('Authorization', `Bearer ${payrollToken}`)
      .send({
        eventType: 'salary_revision',
        effectiveDate: '2026-04-01',
        details: { previousAmount: 50000, newAmount: 55000 },
      })
      .expect(403);
  });

  it('records promotion with audit logs', async () => {
    const before = await request(app.getHttpServer())
      .get(`/api/v1/employees/${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const previousDesignationId = before.body.data.designationId;

    const response = await request(app.getHttpServer())
      .post(`/api/v1/employees/${employeeId}/lifecycle-events`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        eventType: 'promotion',
        effectiveDate: '2026-04-01',
        details: {
          newDesignationId: designationId,
          notes: 'E2E promotion test',
        },
      })
      .expect(201);

    createdEventId = response.body.data.id as string;
    expect(response.body.data.eventType).toBe('promotion');

    const after = await request(app.getHttpServer())
      .get(`/api/v1/employees/${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(after.body.data.designationId).toBe(designationId);

    const lifecycleAudit = await prisma.auditLog.findFirst({
      where: { recordId: createdEventId, action: 'create', module: 'employee' },
    });
    expect(lifecycleAudit).toBeTruthy();
    expect(lifecycleAudit?.newValue).toMatchObject({
      eventType: 'promotion',
    });

    const employeeAudit = await prisma.auditLog.findFirst({
      where: {
        recordId: employeeId,
        action: 'update',
        module: 'employee',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(employeeAudit).toBeTruthy();
    expect(employeeAudit?.oldValue).toMatchObject({
      designationId: previousDesignationId,
    });
    expect(employeeAudit?.newValue).toMatchObject({
      designationId: designationId,
    });
  });

  it('lists lifecycle events for employee', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/employees/${employeeId}/lifecycle-events`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.data[0]).toMatchObject({
      id: expect.any(String),
      eventType: expect.any(String),
      effectiveDate: expect.any(String),
    });
  });

  it('records confirmation and probation events', async () => {
    const probation = await request(app.getHttpServer())
      .post(`/api/v1/employees/${employeeId}/lifecycle-events`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        eventType: 'probation',
        effectiveDate: '2026-05-01',
        details: { newProbationEndDate: '2026-07-01' },
      })
      .expect(201);

    expect(probation.body.data.eventType).toBe('probation');

    const confirmation = await request(app.getHttpServer())
      .post(`/api/v1/employees/${employeeId}/lifecycle-events`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        eventType: 'confirmation',
        effectiveDate: '2026-07-01',
        details: { confirmationDate: '2026-07-01' },
      })
      .expect(201);

    expect(confirmation.body.data.eventType).toBe('confirmation');

    const auditCount = await prisma.auditLog.count({
      where: {
        recordId: { in: [probation.body.data.id, confirmation.body.data.id] },
        action: 'create',
      },
    });
    expect(auditCount).toBe(2);
  });

  it('records salary revision with audit trail (no employee field change)', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/employees/${employeeId}/lifecycle-events`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        eventType: 'salary_revision',
        effectiveDate: '2026-08-01',
        details: {
          previousAmount: 60000,
          newAmount: 65000,
          currency: 'AUD',
          reason: 'Annual review',
        },
      })
      .expect(201);

    const audit = await prisma.auditLog.findFirst({
      where: { recordId: response.body.data.id, action: 'create' },
    });
    expect(audit).toBeTruthy();
  });
});
