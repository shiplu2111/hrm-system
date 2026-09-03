import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createTestApp } from './test-app';

describe('Payroll runs status flow (PAYROLL_LOGIC.md §7, §12)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let companyId: string;
  let employeeId: string;
  let adminToken: string;
  let payrollToken: string;
  let periodId: string;
  let runId: string;

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

    const companies = await request(app.getHttpServer())
      .get('/api/v1/organization/companies')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    companyId = companies.body.data[0].id as string;

    const employees = await request(app.getHttpServer())
      .get('/api/v1/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    employeeId = employees.body.data.find(
      (e: { employeeNumber: string }) => e.employeeNumber === 'EMP-005',
    )?.id as string;
  });

  afterAll(async () => {
    if (runId) {
      await prisma.payrollRun
        .update({
          where: { id: runId },
          data: { deletedAt: new Date() },
        })
        .catch(() => undefined);
    }
    if (periodId) {
      await prisma.payrollRun.deleteMany({ where: { payrollPeriodId: periodId } });
      await prisma.payrollPeriod
        .delete({ where: { id: periodId } })
        .catch(() => undefined);
    }
    await prisma.$disconnect();
    await app.close();
  });

  it('creates a payroll period and draft run', async () => {
    const period = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/payroll-periods`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        paymentDate: '2026-02-05',
      })
      .expect(201);

    periodId = period.body.data.id as string;
    expect(period.body.data.status).toBe('draft');

    const run = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/payroll-periods/${periodId}/runs`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeId })
      .expect(201);

    runId = run.body.data.id as string;
    expect(run.body.data.status).toBe('draft');
    expect(run.body.data.locked).toBe(false);

    const auditCreate = await prisma.auditLog.findFirst({
      where: { module: 'payroll', recordId: runId, action: 'create' },
    });
    expect(auditCreate).toBeTruthy();
  });

  it('calculates pay and moves to calculated', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/payroll-runs/${runId}/calculate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    expect(res.body.data.status).toBe('calculated');
    expect(res.body.data.netPay).toBe('5610.00');

    const audit = await prisma.auditLog.findFirst({
      where: { module: 'payroll', recordId: runId, action: 'update' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit?.oldValue).toMatchObject({ status: 'draft' });
    expect(audit?.newValue).toMatchObject({ status: 'calculated' });
  });

  it('walks through under_review → approved → finalized → paid with audit logs', async () => {
    const steps = [
      { status: 'under_review', action: 'update', token: adminToken },
      { status: 'approved', action: 'approve', token: payrollToken },
      { status: 'finalized', action: 'finalize', token: payrollToken },
      { status: 'paid', action: 'finalize', token: payrollToken },
    ] as const;

    for (const step of steps) {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/companies/${companyId}/payroll-runs/${runId}/transition`)
        .set('Authorization', `Bearer ${step.token}`)
        .send({ targetStatus: step.status })
        .expect(201);

      expect(res.body.data.newStatus).toBe(step.status);

      const audit = await prisma.auditLog.findFirst({
        where: {
          module: 'payroll',
          recordId: runId,
          action: step.action,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(audit).toBeTruthy();
    }

    const locked = await request(app.getHttpServer())
      .get(`/api/v1/companies/${companyId}/payroll-runs/${runId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(locked.body.data.status).toBe('paid');
    expect(locked.body.data.locked).toBe(true);
    expect(locked.body.data.finalizedAt).toBeTruthy();
  });

  it('blocks recalculation and edits after the run is paid (RULES.md §3)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/payroll-runs/${runId}/calculate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);

    await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/payroll-runs/${runId}/transition`)
      .set('Authorization', `Bearer ${payrollToken}`)
      .send({ targetStatus: 'cancelled' })
      .expect(400);
  });
});
