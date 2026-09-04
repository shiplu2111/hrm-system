import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
import { createGlobalValidationPipe } from '../src/common/pipes/validation.pipe';

describe('Security (SECURITY.md §§2–5)', () => {
  let app: INestApplication;
  let adminToken: string;
  let refreshToken: string;
  let employeeId: string;
  let sessionId: string;

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
      .send({
        email: 'admin@cmsnbd.com',
        password: 'password',
        tenantSubdomain: 'demo',
      })
      .expect(201);

    adminToken = login.body.data.accessToken as string;
    refreshToken = login.body.data.refreshToken as string;

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

  it('lists sessions for the signed-in user', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toMatchObject({
      id: expect.any(String),
      createdAt: expect.any(String),
      isCurrent: expect.any(Boolean),
    });
    sessionId = res.body.data[0].id as string;
  });

  it('returns masked tax profile without full tax ID', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/employees/${employeeId}/tax-profile`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.taxIdNumberMasked).toMatch(/\*/);
    expect(res.body.data.taxIdNumberMasked).not.toBe('TFN-005');
    if (res.body.data.bankAccountNumberMasked) {
      expect(res.body.data.bankAccountNumberMasked).toMatch(/\*/);
    }
  });

  it('reveals tax ID on demand with payroll edit permission', async () => {
    const res = await request(app.getHttpServer())
      .get(
        `/api/v1/employees/${employeeId}/tax-profile/reveal?field=taxIdNumber`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.value).toContain('TFN-');
  });

  it('rejects weak passwords on change-password', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ currentPassword: 'password', newPassword: 'short' })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('revokes a session by id', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/auth/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('logs out with refresh token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ refreshToken })
      .expect(201);
  });

  it('rate-limits excessive login attempts', async () => {
    const attempts = Array.from({ length: 12 }, () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'nobody@example.com',
          password: 'wrong-password-xyz',
          tenantSubdomain: 'demo',
        }),
    );
    const results = await Promise.all(attempts);
    expect(results.some((res) => res.status === 429)).toBe(true);
  });
});
