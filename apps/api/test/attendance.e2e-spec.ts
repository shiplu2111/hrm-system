import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createTestApp } from './test-app';
import { startOfUtcDay } from '../src/attendance/attendance.utils';

describe('Attendance (ATTENDANCE_LOGIC.md)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let adminToken: string;
  let employeeId: string;
  let workDate: string;
  let attendanceRecordId: string | null = null;

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

    const employees = await request(app.getHttpServer())
      .get('/api/v1/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    employeeId = employees.body.data.find(
      (e: { employeeNumber: string }) => e.employeeNumber === 'EMP-005',
    )?.id as string;
    if (!employeeId) {
      employeeId = employees.body.data[0].id as string;
    }

    workDate = startOfUtcDay().toISOString().slice(0, 10);

    await prisma.attendanceRecord.deleteMany({
      where: { employeeId, date: startOfUtcDay() },
    });
  });

  afterAll(async () => {
    if (attendanceRecordId) {
      await prisma.break.deleteMany({
        where: { attendanceRecordId },
      });
      await prisma.attendanceRecord
        .delete({ where: { id: attendanceRecordId } })
        .catch(() => undefined);
    }
    await prisma.$disconnect();
    await app.close();
  });

  it('returns absent state before clock in', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/employees/${employeeId}/attendance/today`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.data.status).toBe('absent');
    expect(response.body.data.metrics.phase).toBe('not_started');
    expect(response.body.data.shift.name).toBe('Standard 9–5');
  });

  it('clocks in late when after shift start + grace', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/employees/${employeeId}/attendance/clock-in`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        source: 'manual',
        timestamp: `${workDate}T09:30:00.000Z`,
      })
      .expect(201);

    attendanceRecordId = response.body.data.id as string;
    expect(response.body.data.status).toBe('late');
    expect(response.body.data.metrics.isLate).toBe(true);
    expect(response.body.data.metrics.phase).toBe('working');
  });

  it('records break start and end', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/employees/${employeeId}/attendance/break-start`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ timestamp: `${workDate}T12:00:00.000Z` })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post(`/api/v1/employees/${employeeId}/attendance/break-end`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ timestamp: `${workDate}T12:30:00.000Z` })
      .expect(201);

    expect(response.body.data.breaks).toHaveLength(1);
    expect(response.body.data.metrics.breakMinutes).toBe(30);
    expect(response.body.data.metrics.phase).toBe('working');
  });

  it('clocks out with early leave and net hours', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/employees/${employeeId}/attendance/clock-out`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ timestamp: `${workDate}T16:00:00.000Z` })
      .expect(201);

    expect(response.body.data.status).toBe('late');
    expect(response.body.data.metrics.isEarlyLeave).toBe(true);
    expect(response.body.data.metrics.phase).toBe('completed');
    expect(response.body.data.metrics.grossMinutes).toBe(390);
    expect(response.body.data.metrics.netMinutes).toBe(360);
    expect(response.body.data.metrics.standardMinutes).toBe(420);
    expect(response.body.data.metrics.overtimeMinutes).toBe(0);
  });

  it('rejects duplicate clock in', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/employees/${employeeId}/attendance/clock-in`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ timestamp: `${workDate}T09:00:00.000Z` })
      .expect(400);
  });
});
