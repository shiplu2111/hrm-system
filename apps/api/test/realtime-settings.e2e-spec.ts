import { INestApplication } from '@nestjs/common';
import { TenantSettingCategory } from '@prisma/client';
import request from 'supertest';
import { createTestApp } from './test-app';
import { realtimeSettingsKeyForCompany } from '../src/realtime/realtime.constants';

describe('Realtime notification settings (SYSTEM_SETTINGS.md §2a)', () => {
  let app: INestApplication;
  let adminToken: string;
  let employeeToken: string;
  let companyId: string;
  let tenantId: string;

  beforeAll(async () => {
    app = await createTestApp();

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@cmsnbd.com',
        password: 'password',
        tenantSubdomain: 'demo',
      })
      .expect(201);
    adminToken = adminLogin.body.data.accessToken as string;

    const employeeLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'employee@cmsnbd.com',
        password: 'password',
        tenantSubdomain: 'demo',
      })
      .expect(201);
    employeeToken = employeeLogin.body.data.accessToken as string;

    const companies = await request(app.getHttpServer())
      .get('/api/v1/organization/companies')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    companyId = companies.body.data[0].id as string;

    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const company = await prisma.company.findUniqueOrThrow({
      where: { id: companyId },
    });
    tenantId = company.tenantId;
    await prisma.$disconnect();
  });

  afterAll(async () => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.tenantSetting.deleteMany({
      where: {
        tenantId,
        category: TenantSettingCategory.notification,
        key: realtimeSettingsKeyForCompany(companyId),
      },
    });
    await prisma.$disconnect();
    await app.close();
  });

  it('returns default realtime settings', async () => {
    const response = await request(app.getHttpServer())
      .get(
        `/api/v1/organization/companies/${companyId}/settings/notifications/realtime`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.data).toMatchObject({
      enabled: true,
      liveBroadcast: {
        'leave.approved': true,
        'leave.rejected': false,
        'payroll.finalized': true,
        'attendance.late': true,
      },
    });
  });

  it('denies settings access without settings:view', async () => {
    await request(app.getHttpServer())
      .get(
        `/api/v1/organization/companies/${companyId}/settings/notifications/realtime`,
      )
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(403);
  });

  it('persists per-event live broadcast toggles', async () => {
    const update = await request(app.getHttpServer())
      .put(
        `/api/v1/organization/companies/${companyId}/settings/notifications/realtime`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        enabled: true,
        liveBroadcast: {
          'leave.approved': false,
          'leave.rejected': true,
          'payroll.finalized': true,
          'attendance.late': false,
        },
      })
      .expect(200);

    expect(update.body.data.liveBroadcast).toMatchObject({
      'leave.approved': false,
      'leave.rejected': true,
      'attendance.late': false,
    });

    const read = await request(app.getHttpServer())
      .get(
        `/api/v1/organization/companies/${companyId}/settings/notifications/realtime`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(read.body.data.liveBroadcast['leave.approved']).toBe(false);
    expect(read.body.data.liveBroadcast['leave.rejected']).toBe(true);
  });
});
