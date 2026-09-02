import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createTestApp } from './test-app';

describe('Multi-tenant isolation (TESTING.md §4)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let tenantBId: string;
  let employeeBId: string;
  let employeeDemoId: string;
  let demoTenantId: string;
  let accessToken: string;
  let tenantBSubdomain: string;

  beforeAll(async () => {
    app = await createTestApp();

    prisma = new PrismaClient();

    const demoTenant = await prisma.tenant.findUnique({
      where: { subdomain: 'demo' },
    });
    if (!demoTenant) {
      throw new Error('Demo tenant missing — run npm run seed before e2e tests');
    }
    demoTenantId = demoTenant.id;

    const demoEmployee = await prisma.employee.findFirst({
      where: { tenantId: demoTenant.id },
    });
    if (!demoEmployee) {
      throw new Error('Demo employee missing — run npm run seed before e2e tests');
    }
    employeeDemoId = demoEmployee.id;

    const country = await prisma.country.findFirst({
      where: { isoCode: 'AUS' },
    });
    if (!country) {
      throw new Error('Seed country missing — run npm run seed before e2e tests');
    }

    tenantBSubdomain = `test-other-${Date.now()}`;
    const tenantB = await prisma.tenant.create({
      data: {
        name: 'Isolation Test Corp',
        subdomain: tenantBSubdomain,
        status: 'active',
        storageDriver: 'local',
      },
    });
    tenantBId = tenantB.id;

    const companyB = await prisma.company.create({
      data: {
        tenantId: tenantB.id,
        name: 'Isolation Test Pty Ltd',
        countryId: country.id,
        financialYearStart: 7,
      },
    });

    const employeeB = await prisma.employee.create({
      data: {
        tenantId: tenantB.id,
        companyId: companyB.id,
        employeeNumber: `EMP-ISO-${Date.now()}`,
        firstName: 'Cross',
        lastName: 'Tenant',
        hireDate: new Date('2024-01-01'),
      },
    });
    employeeBId = employeeB.id;

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@cmsnbd.com',
        password: 'password',
        tenantSubdomain: 'demo',
      })
      .expect(201);

    accessToken = loginResponse.body.data.accessToken as string;
  });

  afterAll(async () => {
    if (employeeBId) {
      await prisma.employee.delete({ where: { id: employeeBId } }).catch(() => undefined);
    }
    if (tenantBId) {
      await prisma.company.deleteMany({ where: { tenantId: tenantBId } });
      await prisma.tenant.delete({ where: { id: tenantBId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
    await app.close();
  });

  it('allows access to an employee in the authenticated tenant', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/employees/${employeeDemoId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.data.id).toBe(employeeDemoId);
    expect(response.body.data.tenantId).toBe(demoTenantId);
  });

  it('denies access to an employee belonging to another tenant', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/employees/${employeeBId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('rejects client-supplied tenantId in query string (RULES.md §1)', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/employees/${employeeDemoId}`)
      .query({ tenantId: tenantBId })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);

    expect(response.body.error.code).toBe('TENANT_ID_NOT_ALLOWED');
  });

  it('scopes Prisma reads by JWT tenant_id without a client filter', async () => {
    const crossTenantRow = await prisma.employee.findUnique({
      where: { id: employeeBId },
    });
    expect(crossTenantRow?.tenantId).toBe(tenantBId);

    const { PrismaService } = await import('../src/database/prisma.service');
    const { tenantContext } = await import('../src/tenant/tenant.context');

    const prismaService = app.get(PrismaService);
    const scopedResult = await new Promise<unknown>((resolve, reject) => {
      tenantContext.run(
        {
          tenantId: demoTenantId,
          userId: 'test-user',
          roleId: 'test-role',
          skipScope: false,
        },
        async () => {
          try {
            const row = await prismaService.scoped.employee.findUnique({
              where: { id: employeeBId },
            });
            resolve(row);
          } catch (error) {
            reject(error);
          }
        },
      );
    });

    expect(scopedResult).toBeNull();
  });
});
