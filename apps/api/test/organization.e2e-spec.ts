import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createTestApp } from './test-app';

describe('Organization & Employees (MODULES.md §03–04)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let adminToken: string;
  let employeeToken: string;
  let companyId: string;
  let createdDepartmentId: string;
  let createdEmployeeId: string;
  let createdJobLevelId: string;

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

    const companies = await request(app.getHttpServer())
      .get('/api/v1/organization/companies')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    companyId = companies.body.data[0].id as string;
  });

  afterAll(async () => {
    if (createdEmployeeId) {
      await prisma.employee
        .delete({ where: { id: createdEmployeeId } })
        .catch(() => undefined);
    }
    if (createdDepartmentId) {
      await prisma.department
        .delete({ where: { id: createdDepartmentId } })
        .catch(() => undefined);
    }
    if (createdJobLevelId) {
      await prisma.jobLevel
        .delete({ where: { id: createdJobLevelId } })
        .catch(() => undefined);
    }
    await prisma.$disconnect();
    await app.close();
  });

  it('lists companies for tenant admin (settings:view)', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/organization/companies')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.data[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
    });
  });

  it('denies organization access without settings:view', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/organization/companies/${companyId}/departments`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(403);
  });

  it('creates and lists departments', async () => {
    const suffix = Date.now();
    const created = await request(app.getHttpServer())
      .post(`/api/v1/organization/companies/${companyId}/departments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `QA Dept ${suffix}` })
      .expect(201);

    createdDepartmentId = created.body.data.id as string;
    expect(created.body.data.name).toBe(`QA Dept ${suffix}`);

    const tree = await request(app.getHttpServer())
      .get(`/api/v1/organization/companies/${companyId}/departments/tree`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const names = tree.body.data.flatMap(function flatten(
      node: { name: string; children: typeof tree.body.data },
    ): string[] {
      return [node.name, ...node.children.flatMap(flatten)];
    });
    expect(names).toContain(`QA Dept ${suffix}`);
  });

  it('creates job level and designation', async () => {
    const suffix = Date.now();
    const level = await request(app.getHttpServer())
      .post(`/api/v1/organization/companies/${companyId}/job-levels`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: `T${suffix}`, name: 'Test Level', rank: 99 })
      .expect(201);

    createdJobLevelId = level.body.data.id as string;

    const designation = await request(app.getHttpServer())
      .post(`/api/v1/organization/companies/${companyId}/designations`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Test Designation ${suffix}`,
        jobLevelId: createdJobLevelId,
      })
      .expect(201);

    expect(designation.body.data.jobLevel.code).toBe(`T${suffix}`);
  });

  it('creates employment type, team, and cost centre', async () => {
    const suffix = Date.now();

    await request(app.getHttpServer())
      .post(`/api/v1/organization/companies/${companyId}/employment-types`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Contractor ${suffix}` })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/organization/companies/${companyId}/teams`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Squad ${suffix}` })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/organization/companies/${companyId}/cost-centres`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Ops ${suffix}`, code: `CC-${suffix}` })
      .expect(201);
  });

  it('lists and creates employees with employee permissions', async () => {
    const suffix = Date.now();
    const list = await request(app.getHttpServer())
      .get(`/api/v1/employees?companyId=${companyId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(list.body.data)).toBe(true);

    const created = await request(app.getHttpServer())
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        companyId,
        employeeNumber: `EMP-TEST-${suffix}`,
        firstName: 'Test',
        lastName: 'User',
        hireDate: '2026-01-01',
        personalInfo: {
          contact: { email: `test${suffix}@example.com` },
        },
      })
      .expect(201);

    createdEmployeeId = created.body.data.id as string;
    expect(created.body.data.fullName).toBe('Test User');

    const fetched = await request(app.getHttpServer())
      .get(`/api/v1/employees/${createdEmployeeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(fetched.body.data.personalInfo.contact.email).toBe(
      `test${suffix}@example.com`,
    );

    await request(app.getHttpServer())
      .patch(`/api/v1/employees/${createdEmployeeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employmentStatus: 'on_leave' })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/v1/employees/${createdEmployeeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    createdEmployeeId = '';
  });
});
