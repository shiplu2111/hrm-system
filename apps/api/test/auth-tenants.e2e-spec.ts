import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
import { createGlobalValidationPipe } from '../src/common/pipes/validation.pipe';

describe('Multi-tenant auth (AUTH_FLOW.md §5)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let demoToken: string;
  let demoRefresh: string;
  let altTenantId: string;
  const altSubdomain = 'acme-alt';
  const sharedEmail = 'admin@cmsnbd.com';

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['', 'health'] });
    app.useGlobalPipes(createGlobalValidationPipe());
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();

    prisma = new PrismaClient();

    const demoTenant = await prisma.tenant.findUnique({
      where: { subdomain: 'demo' },
    });
    expect(demoTenant).toBeTruthy();

    const altTenant = await prisma.tenant.upsert({
      where: { subdomain: altSubdomain },
      create: {
        name: 'Acme Alt Corp',
        subdomain: altSubdomain,
        status: 'active',
      },
      update: {
        name: 'Acme Alt Corp',
        status: 'active',
      },
    });
    altTenantId = altTenant.id;

    const demoOwnerRole = await prisma.role.findFirst({
      where: { tenantId: demoTenant!.id, name: 'Company Owner' },
    });
    expect(demoOwnerRole).toBeTruthy();

    const altOwnerRole =
      (await prisma.role.findFirst({
        where: { tenantId: altTenantId, name: 'Company Owner' },
      })) ??
      (await prisma.role.create({
        data: {
          tenantId: altTenantId,
          name: 'Company Owner',
        },
      }));

    const demoPermissions = await prisma.permission.findMany({
      where: { roleId: demoOwnerRole!.id },
    });
    if (
      (await prisma.permission.count({ where: { roleId: altOwnerRole.id } })) ===
      0
    ) {
      await prisma.permission.createMany({
        data: demoPermissions.map((p) => ({
          roleId: altOwnerRole.id,
          module: p.module,
          action: p.action,
        })),
      });
    }

    const passwordHash = await bcrypt.hash('password', 12);
    await prisma.user.upsert({
      where: { id: '20000000-0000-4000-8000-000000000099' },
      create: {
        id: '20000000-0000-4000-8000-000000000099',
        tenantId: altTenantId,
        roleId: altOwnerRole.id,
        email: sharedEmail,
        passwordHash,
        isActive: true,
      },
      update: {
        tenantId: altTenantId,
        roleId: altOwnerRole.id,
        email: sharedEmail,
        passwordHash,
        isActive: true,
      },
    });

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: sharedEmail,
        password: 'password',
        tenantSubdomain: 'demo',
      })
      .expect(201);

    demoToken = login.body.data.accessToken as string;
    demoRefresh = login.body.data.refreshToken as string;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('lists active tenant memberships for the signed-in user', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/tenants')
      .set('Authorization', `Bearer ${demoToken}`)
      .expect(200);

    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    const demo = res.body.data.find(
      (row: { subdomain: string }) => row.subdomain === 'demo',
    );
    const alt = res.body.data.find(
      (row: { subdomain: string }) => row.subdomain === altSubdomain,
    );
    expect(demo?.isCurrent).toBe(true);
    expect(alt?.isCurrent).toBe(false);
  });

  it('issues a new JWT scoped to the target tenant on switch', async () => {
    const switched = await request(app.getHttpServer())
      .post('/api/v1/auth/switch-tenant')
      .set('Authorization', `Bearer ${demoToken}`)
      .send({ tenantId: altTenantId, refreshToken: demoRefresh })
      .expect(201);

    expect(switched.body.data.accessToken).toBeTruthy();
    expect(switched.body.data.user.tenantId).toBe(altTenantId);

    const altCompanies = await request(app.getHttpServer())
      .get('/api/v1/organization/companies')
      .set('Authorization', `Bearer ${switched.body.data.accessToken}`)
      .expect(200);

    expect(Array.isArray(altCompanies.body.data)).toBe(true);

    const demoEmployees = await request(app.getHttpServer())
      .get('/api/v1/employees')
      .set('Authorization', `Bearer ${demoToken}`)
      .expect(200);

    const altEmployees = await request(app.getHttpServer())
      .get('/api/v1/employees')
      .set('Authorization', `Bearer ${switched.body.data.accessToken}`)
      .expect(200);

    expect(demoEmployees.body.data).not.toEqual(altEmployees.body.data);
  });

  it('rejects switch to a tenant the user cannot access', async () => {
    const freshLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: sharedEmail,
        password: 'password',
        tenantSubdomain: 'demo',
      })
      .expect(201);

    const strangerTenant = await prisma.tenant.create({
      data: {
        name: 'Stranger Tenant',
        subdomain: `stranger-${Date.now()}`,
        status: 'active',
      },
    });

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/switch-tenant')
      .set('Authorization', `Bearer ${freshLogin.body.data.accessToken}`)
      .send({
        tenantId: strangerTenant.id,
        refreshToken: freshLogin.body.data.refreshToken,
      })
      .expect(401);

    expect(res.body.error.code).toBe('TENANT_ACCESS_DENIED');
  });
});
