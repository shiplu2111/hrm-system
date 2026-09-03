import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AttendanceRecordStatus, PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
import { createGlobalValidationPipe } from '../src/common/pipes/validation.pipe';
import { MailService } from '../src/settings/mail.service';
import { SmtpSettingsService } from '../src/settings/smtp-settings.service';

describe('Notification engine (NOTIFICATION_LOGIC.md §1–§6)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let adminToken: string;
  let employeeToken: string;
  let managerToken: string;
  let hrToken: string;
  let payrollToken: string;
  let companyId: string;
  let employeeId: string;
  let leaveTypeId: string;
  const sendMail = jest.fn().mockResolvedValue(undefined);

  beforeAll(async () => {
    if (!process.env.FIELD_ENCRYPTION_KEY) {
      process.env.FIELD_ENCRYPTION_KEY = 'test-field-encryption-key-32chars!';
    }

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue({ sendMail, sendTestEmail: sendMail })
      .overrideProvider(SmtpSettingsService)
      .useValue({
        resolveDecryptedSettings: jest.fn().mockResolvedValue({
          host: 'smtp.test.local',
          port: 587,
          username: 'mailer',
          password: 'secret',
          fromAddress: 'noreply@test.local',
          fromName: 'Test',
          useTls: true,
        }),
        getSmtpSettings: jest.fn(),
        updateSmtpSettings: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['', 'health'] });
    app.useGlobalPipes(createGlobalValidationPipe());
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();

    prisma = new PrismaClient();

    async function login(email: string) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'password', tenantSubdomain: 'demo' })
        .expect(201);
      return res.body.data.accessToken as string;
    }

    adminToken = await login('admin@cmsnbd.com');
    employeeToken = await login('employee@cmsnbd.com');
    managerToken = await login('manager@cmsnbd.com');
    hrToken = await login('hr@cmsnbd.com');
    payrollToken = await login('payroll@cmsnbd.com');

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

    await prisma.inAppNotification.deleteMany({
      where: {
        eventType: {
          in: [
            'leave.approved',
            'leave.rejected',
            'payroll.finalized',
            'attendance.late',
          ],
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('creates in-app notification when leave is approved', async () => {
    await prisma.leaveRequest.deleteMany({ where: { employeeId } });

    const created = await request(app.getHttpServer())
      .post(`/api/v1/employees/${employeeId}/leave-requests`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        leaveTypeId,
        startDate: '2099-07-01',
        endDate: '2099-07-02',
        reason: 'Notification engine test',
        submit: true,
      })
      .expect(201);

    const requestId = created.body.data.id as string;

    await request(app.getHttpServer())
      .post(`/api/v1/leave-requests/${requestId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ comment: 'Manager approval' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/leave-requests/${requestId}/approve`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ comment: 'HR final approval' })
      .expect(201);

    const notifications = await request(app.getHttpServer())
      .get('/api/v1/notifications?unreadOnly=true')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    const match = notifications.body.data.find(
      (n: { eventType: string }) => n.eventType === 'leave.approved',
    );
    expect(match).toBeDefined();
    expect(match.title).toContain('Leave approved');
    expect(match.body).toContain('Annual Leave');
  });

  it('creates in-app notification when leave is rejected', async () => {
    await prisma.leaveRequest.deleteMany({ where: { employeeId } });

    const created = await request(app.getHttpServer())
      .post(`/api/v1/employees/${employeeId}/leave-requests`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        leaveTypeId,
        startDate: '2099-09-10',
        endDate: '2099-09-11',
        reason: 'Reject notification test',
        submit: true,
      })
      .expect(201);

    const requestId = created.body.data.id as string;

    await request(app.getHttpServer())
      .post(`/api/v1/leave-requests/${requestId}/reject`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ comment: 'Rejected for notification test' })
      .expect(201);

    const notifications = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    expect(
      notifications.body.data.some(
        (n: { eventType: string }) => n.eventType === 'leave.rejected',
      ),
    ).toBe(true);
  });

  it('creates in-app notifications for late clock-in (employee + manager)', async () => {
    const workDate = '2099-05-06';
    await prisma.attendanceRecord.deleteMany({
      where: { employeeId, date: new Date(`${workDate}T00:00:00.000Z`) },
    });

    const shift = await prisma.shift.findFirstOrThrow({
      where: { companyId },
    });

    await prisma.roster.upsert({
      where: {
        employeeId_date: {
          employeeId,
          date: new Date(`${workDate}T00:00:00.000Z`),
        },
      },
      create: {
        employeeId,
        date: new Date(`${workDate}T00:00:00.000Z`),
        shiftId: shift.id,
      },
      update: { shiftId: shift.id },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/employees/${employeeId}/attendance/clock-in`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        timestamp: `${workDate}T11:30:00.000Z`,
        source: 'manual',
      })
      .expect(201);

    const record = await prisma.attendanceRecord.findFirstOrThrow({
      where: {
        employeeId,
        date: new Date(`${workDate}T00:00:00.000Z`),
      },
    });
    expect(record.status).toBe(AttendanceRecordStatus.late);

    const employeeUser = await prisma.user.findFirstOrThrow({
      where: { email: 'employee@cmsnbd.com' },
    });
    const managerUser = await prisma.user.findFirstOrThrow({
      where: { email: 'manager@cmsnbd.com' },
    });

    const employeeNotifications = await prisma.inAppNotification.findMany({
      where: { userId: employeeUser.id, eventType: 'attendance.late' },
    });
    const managerNotifications = await prisma.inAppNotification.findMany({
      where: { userId: managerUser.id, eventType: 'attendance.late' },
    });

    expect(employeeNotifications.length).toBeGreaterThan(0);
    expect(managerNotifications.length).toBeGreaterThan(0);
  }, 15_000);

  it('creates in-app notification when payroll run is finalized', async () => {
    const period = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/payroll-periods`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        startDate: '2099-03-01',
        endDate: '2099-03-31',
        paymentDate: '2099-04-05',
      })
      .expect(201);

    const periodId = period.body.data.id as string;

    const run = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/payroll-periods/${periodId}/runs`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeId })
      .expect(201);

    const runId = run.body.data.id as string;

    await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/payroll-runs/${runId}/calculate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    for (const status of ['under_review', 'approved'] as const) {
      await request(app.getHttpServer())
        .post(`/api/v1/companies/${companyId}/payroll-runs/${runId}/transition`)
        .set('Authorization', `Bearer ${payrollToken}`)
        .send({ targetStatus: status })
        .expect(201);
    }

    await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/payroll-runs/${runId}/transition`)
      .set('Authorization', `Bearer ${payrollToken}`)
      .send({ targetStatus: 'finalized' })
      .expect(201);

    const employeeUser = await prisma.user.findFirstOrThrow({
      where: { email: 'employee@cmsnbd.com' },
    });

    const stored = await prisma.inAppNotification.findFirst({
      where: { userId: employeeUser.id, eventType: 'payroll.finalized' },
    });
    expect(stored).not.toBeNull();
    expect(stored?.body).toContain('2099-03');
  }, 30_000);

  it('registers and unregisters a push device token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/notifications/push-tokens')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        token: 'fcm-test-token-abc',
        deviceId: 'test-device-001',
        platform: 'android',
      })
      .expect(200);

    const employeeUser = await prisma.user.findFirstOrThrow({
      where: { email: 'employee@cmsnbd.com' },
    });

    const stored = await prisma.pushDeviceToken.findFirst({
      where: { userId: employeeUser.id, deviceId: 'test-device-001' },
    });
    expect(stored?.token).toBe('fcm-test-token-abc');

    await request(app.getHttpServer())
      .delete('/api/v1/notifications/push-tokens')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ deviceId: 'test-device-001' })
      .expect(204);

    const removed = await prisma.pushDeviceToken.findFirst({
      where: { userId: employeeUser.id, deviceId: 'test-device-001' },
    });
    expect(removed).toBeNull();
  });
});
