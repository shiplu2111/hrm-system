import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
import { createGlobalValidationPipe } from '../src/common/pipes/validation.pipe';

describe('Dashboard (MODULES.md §39)', () => {
  let app: INestApplication;
  let adminToken: string;
  let employeeToken: string;
  let companyId: string;
  let employeeId: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['', 'health'] });
    app.useGlobalPipes(createGlobalValidationPipe());
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();

    async function login(email: string) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'password', tenantSubdomain: 'demo' })
        .expect(201);
      return res.body.data.accessToken as string;
    }

    adminToken = await login('admin@cmsnbd.com');
    employeeToken = await login('employee@cmsnbd.com');

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
    await app.close();
  });

  it('returns admin dashboard KPIs for a company', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/companies/${companyId}/dashboard/admin`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.kpis).toMatchObject({
      headcount: expect.any(Number),
      onLeaveToday: expect.any(Number),
      absentLateToday: expect.any(Number),
      workingNow: expect.any(Number),
      payrollCostMonth: expect.any(Number),
      pendingPayroll: expect.any(Number),
      pendingApprovals: expect.any(Number),
      expiryAlerts: expect.any(Number),
    });
    expect(Array.isArray(res.body.data.departmentHeadcount)).toBe(true);
    expect(Array.isArray(res.body.data.attendanceTrend)).toBe(true);
    expect(res.body.data.attendanceTrend.length).toBe(7);
  });

  it('returns employee dashboard for the signed-in employee', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/employees/${employeeId}/dashboard`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    expect(res.body.data.attendance).toBeDefined();
    expect(res.body.data.attendance.metrics).toBeDefined();
    expect(Array.isArray(res.body.data.leaveBalances)).toBe(true);
    expect(Array.isArray(res.body.data.upcomingLeave)).toBe(true);
    expect(Array.isArray(res.body.data.notifications)).toBe(true);
    expect(typeof res.body.data.unreadNotificationCount).toBe('number');
  });
});
