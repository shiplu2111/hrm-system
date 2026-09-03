import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createTestApp } from './test-app';

describe('Payroll (PAYROLL_LOGIC.md §3–§6)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let companyId: string;
  let employeeId: string;
  let adminToken: string;
  let basicComponentId: string;
  let hraComponentId: string;
  let taxComponentId: string;

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
    hraComponentId = components.body.data.find(
      (c: { name: string }) => c.name === 'House Rent Allowance',
    )?.id as string;
    taxComponentId = components.body.data.find(
      (c: { name: string }) => c.name === 'Income Tax',
    )?.id as string;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('lists seeded pay components', () => {
    expect(basicComponentId).toBeTruthy();
    expect(hraComponentId).toBeTruthy();
    expect(taxComponentId).toBeTruthy();
  });

  it('creates structured formula pay components', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/pay-components`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Dynamic OT Test',
        type: 'earning',
        calculationType: 'formula',
        formula: {
          version: 1,
          when: {
            op: 'gt',
            left: { ref: 'employee.worked_hours' },
            right: { ref: 'shift.standard_hours' },
          },
          then: {
            op: 'mul',
            args: [
              {
                op: 'sub',
                args: [
                  { ref: 'employee.worked_hours' },
                  { ref: 'shift.standard_hours' },
                ],
              },
              { ref: 'employee.hourly_rate' },
              { ref: 'shift.ot_multiplier' },
            ],
          },
        },
      })
      .expect(201);

    expect(res.body.data.calculationType).toBe('formula');
    expect(res.body.data.formula.version).toBe(1);

    await request(app.getHttpServer())
      .delete(
        `/api/v1/companies/${companyId}/pay-components/${res.body.data.id}`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);
  });

  it('rejects raw code or unsafe formula references', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/pay-components`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Unsafe OT',
        type: 'earning',
        calculationType: 'formula',
        formula: { expression: '1+1' },
      })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/pay-components`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Unsafe Ref',
        type: 'earning',
        calculationType: 'formula',
        formula: {
          version: 1,
          then: { ref: 'process.mainModule' },
        },
      })
      .expect(400);
  });

  it('lists employee salary structures', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/employees/${employeeId}/salary-structures`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
  });

  it('calculates gross → deductions → net preview', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/employees/${employeeId}/payroll/preview`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const preview = res.body.data;
    expect(preview.grossPay).toBe('6600.00');
    expect(preview.totalDeductions).toBe('990.00');
    expect(preview.netPay).toBe('5610.00');
    expect(preview.earnings).toHaveLength(2);
    expect(preview.deductions).toHaveLength(1);
  });

  it('creates fixed salary structure assignment', async () => {
    const transport = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/pay-components`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Transport Allowance Test',
        type: 'earning',
        calculationType: 'fixed',
      })
      .expect(201);

    const created = await request(app.getHttpServer())
      .post(`/api/v1/employees/${employeeId}/salary-structures`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        componentId: transport.body.data.id,
        componentType: 'earning',
        amountOrFormula: { amount: '200.00' },
        effectiveFrom: '2099-01-01',
      })
      .expect(201);

    expect(created.body.data.amountOrFormula.amount).toBe('200.00');

    await request(app.getHttpServer())
      .delete(
        `/api/v1/employees/${employeeId}/salary-structures/${created.body.data.id}`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .delete(
        `/api/v1/companies/${companyId}/pay-components/${transport.body.data.id}`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);
  });

  it('writes audit log on pay component create', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/pay-components`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Audit Test Component',
        type: 'deduction',
        calculationType: 'fixed',
      })
      .expect(201);

    const audit = await prisma.auditLog.findFirst({
      where: {
        module: 'payroll',
        recordId: created.body.data.id,
        action: 'create',
      },
    });
    expect(audit).toBeTruthy();

    await request(app.getHttpServer())
      .delete(
        `/api/v1/companies/${companyId}/pay-components/${created.body.data.id}`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);
  });
});
