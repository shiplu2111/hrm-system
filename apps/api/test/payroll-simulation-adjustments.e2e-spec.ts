import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createTestApp } from './test-app';

describe('Payroll simulation & adjustments (PAYROLL_LOGIC.md §8, §11)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let companyId: string;
  let employeeId: string;
  let basicComponentId: string;
  let adminToken: string;
  let payrollToken: string;

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

    const components = await request(app.getHttpServer())
      .get(`/api/v1/companies/${companyId}/pay-components`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    basicComponentId = components.body.data.find(
      (c: { name: string }) => c.name === 'Basic Salary',
    )?.id as string;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('simulates net pay with hypothetical basic salary — no DB writes', async () => {
    const runsBefore = await prisma.payrollRun.count();

    const res = await request(app.getHttpServer())
      .post(`/api/v1/employees/${employeeId}/payroll/simulate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        structureOverrides: [{ componentId: basicComponentId, amount: '5000.00' }],
      })
      .expect(201);

    const { baseline, simulated, delta } = res.body.data;
    expect(baseline.netPay).toBe('5610.00');
    expect(simulated.netPay).toBe('4675.00');
    expect(delta.netPay).toBe('-935.00');

    const runsAfter = await prisma.payrollRun.count();
    expect(runsAfter).toBe(runsBefore);

    const auditBefore = await prisma.auditLog.count();
    await request(app.getHttpServer())
      .post(`/api/v1/employees/${employeeId}/payroll/simulate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        structureOverrides: [{ componentId: basicComponentId, amount: '5500.00' }],
      })
      .expect(201);
    const auditAfter = await prisma.auditLog.count();
    expect(auditAfter).toBe(auditBefore);
  });

  it('creates retroactive adjustment against finalized run without mutating it', async () => {
    const period = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/payroll-periods`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        startDate: '2026-02-01',
        endDate: '2026-02-28',
        paymentDate: '2026-03-05',
      })
      .expect(201);
    const periodId = period.body.data.id as string;

    const applyPeriod = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/payroll-periods`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        paymentDate: '2026-04-05',
      })
      .expect(201);

    const runRes = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/payroll-periods/${periodId}/runs`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeId })
      .expect(201);
    const runId = runRes.body.data.id as string;

    await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/payroll-runs/${runId}/calculate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    for (const status of [
      'under_review',
      'approved',
      'finalized',
    ] as const) {
      await request(app.getHttpServer())
        .post(`/api/v1/companies/${companyId}/payroll-runs/${runId}/transition`)
        .set('Authorization', `Bearer ${payrollToken}`)
        .send({ targetStatus: status })
        .expect(201);
    }

    const lockedBefore = await prisma.payrollRun.findUniqueOrThrow({
      where: { id: runId },
    });

    const adjustment = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/payroll-adjustments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        originalPayrollRunId: runId,
        applyToPayrollPeriodId: applyPeriod.body.data.id,
        reason: 'Retroactive basic salary increase',
        structureOverrides: [
          { componentId: basicComponentId, amount: '7000.00' },
        ],
      })
      .expect(201);

    expect(adjustment.body.data.originalNetPay).toBe('5610.00');
    expect(adjustment.body.data.revisedNetPay).toBe('6545.00');
    expect(adjustment.body.data.adjustmentNetPay).toBe('935.00');
    expect(adjustment.body.data.status).toBe('draft');

    const lockedAfter = await prisma.payrollRun.findUniqueOrThrow({
      where: { id: runId },
    });
    expect(lockedAfter.grossPay.toString()).toBe(lockedBefore.grossPay.toString());
    expect(lockedAfter.netPay.toString()).toBe(lockedBefore.netPay.toString());
    expect(lockedAfter.status).toBe('finalized');

    const audit = await prisma.auditLog.findFirst({
      where: {
        module: 'payroll',
        recordId: adjustment.body.data.id,
        action: 'create',
      },
    });
    expect(audit).toBeTruthy();

    const submitted = await request(app.getHttpServer())
      .post(
        `/api/v1/companies/${companyId}/payroll-adjustments/${adjustment.body.data.id}/submit`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect(submitted.body.data.status).toBe('pending');

    const applied = await request(app.getHttpServer())
      .post(
        `/api/v1/companies/${companyId}/payroll-adjustments/${adjustment.body.data.id}/apply`,
      )
      .set('Authorization', `Bearer ${payrollToken}`)
      .expect(201);
    expect(applied.body.data.status).toBe('applied');
    expect(applied.body.data.appliedAt).toBeTruthy();

    await prisma.payrollAdjustment.delete({
      where: { id: adjustment.body.data.id },
    });
    await prisma.payrollRun.delete({ where: { id: runId } });
    await prisma.payrollPeriod.delete({ where: { id: periodId } });
    await prisma.payrollPeriod.delete({
      where: { id: applyPeriod.body.data.id },
    });
  });
});
