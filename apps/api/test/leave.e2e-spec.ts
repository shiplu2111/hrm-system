import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createTestApp } from './test-app';

describe('Leave (LEAVE_LOGIC.md)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let companyId: string;
  let employeeId: string;
  let leaveTypeId: string;
  let employeeToken: string;
  let managerToken: string;
  let hrToken: string;
  let adminToken: string;
  let requestId: string | null = null;
  const leaveStart = '2099-06-08';
  const leaveEnd = '2099-06-10';

  beforeAll(async () => {
    app = await createTestApp();
    prisma = new PrismaClient();

    async function login(email: string) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'password', tenantSubdomain: 'demo' })
        .expect(201);
      return res.body.data.accessToken as string;
    }

    employeeToken = await login('employee@cmsnbd.com');
    managerToken = await login('manager@cmsnbd.com');
    hrToken = await login('hr@cmsnbd.com');
    adminToken = await login('admin@cmsnbd.com');

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

    const leaveTypes = await request(app.getHttpServer())
      .get(`/api/v1/companies/${companyId}/leave-types`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);
    leaveTypeId = leaveTypes.body.data.find(
      (t: { name: string }) => t.name === 'Annual Leave',
    )?.id as string;

    await prisma.leaveRequest.deleteMany({ where: { employeeId } });
    await prisma.attendanceRecord.deleteMany({
      where: {
        employeeId,
        date: {
          gte: new Date('2099-01-01T00:00:00.000Z'),
        },
      },
    });
    await prisma.leaveBalance.updateMany({
      where: { employeeId, leaveTypeId: '10000000-0000-4000-8000-000000000020' },
      data: {
        balanceDays: 20,
        carriedForwardDays: 0,
        carriedForwardExpiresAt: null,
        lastAccrualAt: new Date('2024-07-01T00:00:00.000Z'),
      },
    });
  });

  afterAll(async () => {
    if (requestId) {
      await prisma.leaveRequest.delete({ where: { id: requestId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
    await app.close();
  });

  it('lists leave types and policies', async () => {
    const policies = await request(app.getHttpServer())
      .get(`/api/v1/companies/${companyId}/leave-policies`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    expect(policies.body.data.length).toBeGreaterThan(0);
    expect(policies.body.data[0]).toMatchObject({
      accrualType: expect.any(String),
      approvalSteps: expect.any(Array),
    });
  });

  it('returns accrued leave balance for employee', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/employees/${employeeId}/leave-balances`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    const annual = response.body.data.find(
      (b: { leaveTypeName: string }) => b.leaveTypeName === 'Annual Leave',
    );
    expect(annual).toBeDefined();
    expect(annual.balanceDays).toBeGreaterThanOrEqual(0);
  });

  it('creates and submits a leave request', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/v1/employees/${employeeId}/leave-requests`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        leaveTypeId,
        startDate: leaveStart,
        endDate: leaveEnd,
        reason: 'E2E leave test',
        submit: true,
      })
      .expect(201);

    requestId = created.body.data.id as string;
    expect(created.body.data.status).toBe('pending');
    expect(created.body.data.totalDays).toBe(3);
    expect(created.body.data.approvalChain).toHaveLength(2);
  });

  it('manager approves first step', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/leave-requests/${requestId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ comment: 'Approved by manager' })
      .expect(201);

    expect(response.body.data.status).toBe('pending');
    expect(response.body.data.approvalChain[0].status).toBe('approved');
  });

  it('HR approves final step, deducts balance, sets attendance to leave', async () => {
    const balanceBefore = await request(app.getHttpServer())
      .get(`/api/v1/employees/${employeeId}/leave-balances`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);
    const annualBefore = balanceBefore.body.data.find(
      (b: { leaveTypeName: string }) => b.leaveTypeName === 'Annual Leave',
    );

    const response = await request(app.getHttpServer())
      .post(`/api/v1/leave-requests/${requestId}/approve`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ comment: 'Approved by HR' })
      .expect(201);

    expect(response.body.data.status).toBe('approved');
    expect(response.body.data.deductedAt).toBeTruthy();

    const balanceAfter = await request(app.getHttpServer())
      .get(`/api/v1/employees/${employeeId}/leave-balances`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);
    const annualAfter = balanceAfter.body.data.find(
      (b: { leaveTypeName: string }) => b.leaveTypeName === 'Annual Leave',
    );
    expect(annualAfter.balanceDays).toBeCloseTo(annualBefore.balanceDays - 3, 1);

    const attendance = await request(app.getHttpServer())
      .get(`/api/v1/employees/${employeeId}/attendance/today?date=${leaveStart}`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);
    expect(attendance.body.data.status).toBe('leave');
  });

  it('supports half-day leave when policy allows', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/v1/employees/${employeeId}/leave-requests`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        leaveTypeId,
        startDate: '2099-08-02',
        endDate: '2099-08-02',
        halfDay: true,
        submit: false,
      })
      .expect(201);

    expect(created.body.data.totalDays).toBe(0.5);
    await prisma.leaveRequest.delete({ where: { id: created.body.data.id } });
  });
});
