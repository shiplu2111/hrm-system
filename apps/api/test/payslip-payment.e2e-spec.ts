import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createTestApp } from './test-app';

describe('Payslips & payment batches (MODULES.md §19)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let companyId: string;
  let employeeId: string;
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
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('generates payslip PDF on payroll finalization', async () => {
    const period = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/payroll-periods`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        paymentDate: '2026-05-05',
      })
      .expect(201);

    const run = await request(app.getHttpServer())
      .post(
        `/api/v1/companies/${companyId}/payroll-periods/${period.body.data.id}/runs`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeId })
      .expect(201);

    const runId = run.body.data.id as string;

    await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/payroll-runs/${runId}/calculate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    for (const status of ['under_review', 'approved', 'finalized'] as const) {
      await request(app.getHttpServer())
        .post(`/api/v1/companies/${companyId}/payroll-runs/${runId}/transition`)
        .set('Authorization', `Bearer ${payrollToken}`)
        .send({ targetStatus: status })
        .expect(201);
    }

    const payslip = await request(app.getHttpServer())
      .get(`/api/v1/companies/${companyId}/payroll-runs/${runId}/payslip`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(payslip.body.data.fileKey).toMatch(/\/payslips\//);
    expect(payslip.body.data.downloadUrl).toBeTruthy();

    const stored = await prisma.payslip.findUnique({
      where: { payrollRunId: runId },
    });
    expect(stored).toBeTruthy();

    const audit = await prisma.auditLog.findFirst({
      where: { module: 'payroll', recordId: stored!.id, action: 'create' },
    });
    expect(audit).toBeTruthy();

    const batch = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/payment-batches`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ payrollPeriodId: period.body.data.id })
      .expect(201);

    expect(batch.body.data.status).toBe('draft');
    expect(batch.body.data.itemCount).toBe(1);
    expect(batch.body.data.totalAmount).toBe('5610.00');

    const batchId = batch.body.data.id as string;

    await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/payment-batches/${batchId}/submit`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    const paid = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/payment-batches/${batchId}/mark-paid`)
      .set('Authorization', `Bearer ${payrollToken}`)
      .send({ transactionReference: 'TXN-DEMO-001' })
      .expect(201);

    expect(paid.body.data.newStatus).toBe('paid');
    expect(paid.body.data.batch.transactionReference).toBe('TXN-DEMO-001');
    expect(paid.body.data.batch.items[0].status).toBe('paid');

    await prisma.paymentBatchItem.deleteMany({ where: { paymentBatchId: batchId } });
    await prisma.paymentBatch.delete({ where: { id: batchId } });
    await prisma.payslip.deleteMany({ where: { payrollRunId: runId } });
    await prisma.payrollRun.delete({ where: { id: runId } });
    await prisma.payrollPeriod.delete({ where: { id: period.body.data.id } });
  });
});
