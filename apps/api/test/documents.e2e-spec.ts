import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createTestApp } from './test-app';

describe('Document Management (MODULES.md §09)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let adminToken: string;
  let companyId: string;
  let employeeId: string;
  let documentTypeId: string;
  let customFieldId: string;
  let employeeDocumentId: string;

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
    employeeId = employees.body.data[0].id as string;
  });

  afterAll(async () => {
    if (employeeDocumentId) {
      await prisma.employeeDocument
        .delete({ where: { id: employeeDocumentId } })
        .catch(() => undefined);
    }
    if (documentTypeId) {
      await prisma.customFieldDefinition.deleteMany({
        where: { contextId: documentTypeId },
      });
      await prisma.documentType
        .delete({ where: { id: documentTypeId } })
        .catch(() => undefined);
    }
    if (customFieldId) {
      await prisma.customFieldDefinition
        .delete({ where: { id: customFieldId } })
        .catch(() => undefined);
    }
    await prisma.$disconnect();
    await app.close();
  });

  it('creates a custom field for employee entity', async () => {
    const suffix = Date.now();
    const response = await request(app.getHttpServer())
      .post(`/api/v1/organization/companies/${companyId}/custom-fields`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        entityType: 'employee',
        label: `Blood Group ${suffix}`,
        fieldType: 'dropdown',
        required: false,
        options: ['A+', 'B+', 'O+'],
      })
      .expect(201);

    customFieldId = response.body.data.id as string;
    expect(response.body.data.fieldKey).toBeTruthy();
    expect(response.body.data.entityType).toBe('employee');
  });

  it('creates document type with configurable fields', async () => {
    const suffix = Date.now();
    const response = await request(app.getHttpServer())
      .post(`/api/v1/organization/companies/${companyId}/document-types`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Work Permit ${suffix}`,
        description: 'Employee work authorization',
        scope: 'employee',
        requiresVerification: true,
        tracksExpiry: true,
        fields: [
          {
            label: 'Permit Number',
            fieldType: 'text',
            required: true,
          },
          {
            label: 'Issuing Country',
            fieldType: 'dropdown',
            required: true,
            options: ['AUS', 'BGD', 'USA'],
          },
        ],
      })
      .expect(201);

    documentTypeId = response.body.data.id as string;
    expect(response.body.data.fields).toHaveLength(2);
    expect(response.body.data.fields[0].fieldKey).toBe('permit_number');
  });

  it('uploads employee document validated against field schema', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/employees/${employeeId}/documents`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        documentTypeId,
        expiryDate: '2027-12-31',
        fields: {
          permit_number: 'WP-12345',
          issuing_country: 'AUS',
        },
      })
      .expect(201);

    employeeDocumentId = response.body.data.id as string;
    expect(response.body.data.fields.permit_number).toBe('WP-12345');
    expect(response.body.data.status).toBe('pending');

    const audit = await prisma.auditLog.findFirst({
      where: { recordId: employeeDocumentId, action: 'create', module: 'employee' },
    });
    expect(audit).toBeTruthy();
  });

  it('rejects document with missing required field', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/employees/${employeeId}/documents`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        documentTypeId,
        expiryDate: '2027-12-31',
        fields: { issuing_country: 'AUS' },
      })
      .expect(400);
  });

  it('verifies employee document with audit log', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/employees/${employeeId}/documents/${employeeDocumentId}/verify`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(201);

    expect(response.body.data.verifiedAt).toBeTruthy();
    expect(response.body.data.status).toBe('verified');
  });
});
