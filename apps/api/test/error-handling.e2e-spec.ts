import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './test-app';

describe('Error handling (ERROR_HANDLING.md §1–§2)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns standard validation error shape for invalid login body', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: 'short' })
      .expect(400);

    expect(response.body).toEqual({
      error: expect.objectContaining({
        code: 'VALIDATION_ERROR',
        message: expect.any(String),
        requestId: expect.any(String),
        details: expect.arrayContaining([
          expect.objectContaining({ field: expect.any(String), message: expect.any(String) }),
        ]),
      }),
    });
    expect(response.headers['x-request-id']).toBe(response.body.error.requestId);
  });

  it('returns UNAUTHENTICATED for invalid credentials', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@cmsnbd.com',
        password: 'wrong-password',
        tenantSubdomain: 'demo',
      })
      .expect(401);

    expect(response.body.error).toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: expect.any(String),
      requestId: expect.any(String),
    });
    expect(response.body.error.details).toBeUndefined();
  });

  it('returns FORBIDDEN when permission is missing', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'employee@cmsnbd.com',
        password: 'password',
        tenantSubdomain: 'demo',
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)
      .expect(403);

    expect(response.body.error).toMatchObject({
      code: 'FORBIDDEN',
      message: expect.stringContaining('settings:view'),
      requestId: expect.any(String),
    });
  });

  it('returns NOT_FOUND for missing resources', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@cmsnbd.com',
        password: 'password',
        tenantSubdomain: 'demo',
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/api/v1/employees/00000000-0000-4000-8000-000000009999')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)
      .expect(404);

    expect(response.body.error).toMatchObject({
      code: 'NOT_FOUND',
      requestId: expect.any(String),
    });
  });

  it('wraps successful responses in { data } (API_GUIDELINES.md §3)', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.body).toEqual({
      data: { status: 'ok' },
    });
  });
});
