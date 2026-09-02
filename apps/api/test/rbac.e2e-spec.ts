import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createTestApp } from './test-app';

describe('RBAC (ROLES_PERMISSIONS.md)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let adminToken: string;
  let employeeToken: string;
  let hrAdminToken: string;
  let customRoleId: string;

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

    const employeeLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'employee@cmsnbd.com',
        password: 'password',
        tenantSubdomain: 'demo',
      })
      .expect(201);
    employeeToken = employeeLogin.body.data.accessToken as string;

    const hrLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'hr@cmsnbd.com',
        password: 'password',
        tenantSubdomain: 'demo',
      })
      .expect(201);
    hrAdminToken = hrLogin.body.data.accessToken as string;
  });

  afterAll(async () => {
    if (customRoleId) {
      await prisma.permission.deleteMany({ where: { roleId: customRoleId } });
      await prisma.role.delete({ where: { id: customRoleId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
    await app.close();
  });

  it('lists default system roles for tenant admin', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const names = response.body.data.map((role: { name: string }) => role.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'Company Owner',
        'HR Admin',
        'Employee',
      ]),
    );
  });

  it('creates a custom role with permissions', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Branch Manager ${Date.now()}`,
        permissions: [
          { module: 'employee', action: 'view' },
          { module: 'leave', action: 'approve' },
        ],
      })
      .expect(201);

    customRoleId = response.body.data.id as string;
    expect(response.body.data.isSystem).toBe(false);
    expect(response.body.data.permissions).toHaveLength(2);
  });

  it('denies role management without settings permission', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(403);
  });

  it('denies role deletion without settings:delete permission', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/roles/${customRoleId}`)
      .set('Authorization', `Bearer ${hrAdminToken}`)
      .expect(403);
  });

  it('blocks modifying a system role', async () => {
    const hrRole = await prisma.role.findFirst({
      where: { name: 'HR Admin', tenantId: { not: null } },
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/roles/${hrRole!.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Renamed HR' })
      .expect(403);
  });
});
