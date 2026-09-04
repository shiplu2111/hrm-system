import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
import { createGlobalValidationPipe } from '../src/common/pipes/validation.pipe';

describe('Reports (MODULES.md §38)', () => {
  let app: INestApplication;
  let adminToken: string;
  let companyId: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['', 'health'] });
    app.useGlobalPipes(createGlobalValidationPipe());
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@cmsnbd.com', password: 'password', tenantSubdomain: 'demo' })
      .expect(201);
    adminToken = login.body.data.accessToken as string;

    const companies = await request(app.getHttpServer())
      .get('/api/v1/organization/companies')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    companyId = companies.body.data[0].id as string;
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the full payroll, attendance, and HR catalog', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/companies/${companyId}/reports/catalog`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const ids = res.body.data.reports.map((r: { id: string }) => r.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'payroll.employee-summary',
        'attendance.daily',
        'hr.headcount',
      ]),
    );
    expect(res.body.data.reports.length).toBeGreaterThanOrEqual(29);
  });

  it('runs headcount report JSON', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/companies/${companyId}/reports/hr.headcount`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data).toMatchObject({
      reportId: 'hr.headcount',
      category: 'hr',
      columns: expect.any(Array),
      rows: expect.any(Array),
      rowCount: expect.any(Number),
    });
  });

  it('exports payroll register as CSV', async () => {
    const res = await request(app.getHttpServer())
      .get(
        `/api/v1/companies/${companyId}/reports/payroll.register/export?format=csv`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text.split('\n')[0]).toContain('Run ID');
  });

  it('exports daily attendance as xlsx', async () => {
    const res = await request(app.getHttpServer())
      .get(
        `/api/v1/companies/${companyId}/reports/attendance.daily/export?format=xlsx`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(res.headers['content-type']).toMatch(/spreadsheetml/);
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect((res.body as Buffer).length).toBeGreaterThan(100);
  });
});
