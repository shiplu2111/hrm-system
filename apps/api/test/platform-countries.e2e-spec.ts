import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './test-app';

describe('Platform country configuration API', () => {
  let app: INestApplication;
  let superToken: string;
  let tenantToken: string;
  let countryId: string;

  beforeAll(async () => {
    app = await createTestApp();

    const superLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'super@cmsnbd.com',
        password: 'password',
      })
      .expect(201);

    superToken = superLogin.body.data.accessToken as string;

    const tenantLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@cmsnbd.com',
        password: 'password',
        tenantSubdomain: 'demo',
      })
      .expect(201);

    tenantToken = tenantLogin.body.data.accessToken as string;
  });

  afterAll(async () => {
    await app.close();
  });

  it('denies tenant admins from platform country APIs', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/platform/countries')
      .set('Authorization', `Bearer ${tenantToken}`)
      .expect(403);
  });

  it('lists countries for super admin', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/platform/countries')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200);

    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ isoCode: 'AUS', name: 'Australia' }),
      ]),
    );

    countryId = response.body.data.find(
      (country: { isoCode: string }) => country.isoCode === 'AUS',
    ).id;
  });

  it('returns tax brackets and country rules configuration', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/platform/countries/${countryId}/configuration`)
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200);

    expect(response.body.data.country.isoCode).toBe('AUS');
    expect(response.body.data.taxBrackets.length).toBeGreaterThan(0);
    expect(response.body.data.rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleType: 'leave' }),
        expect.objectContaining({ ruleType: 'ot' }),
        expect.objectContaining({ ruleType: 'public_holiday' }),
      ]),
    );
  });

  it('updates leave rules without code deployment', async () => {
    const configBefore = await request(app.getHttpServer())
      .get(`/api/v1/platform/countries/${countryId}/configuration`)
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200);

    const leaveRule = configBefore.body.data.rules.find(
      (rule: { ruleType: string }) => rule.ruleType === 'leave',
    );

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/platform/countries/${countryId}/rules/${leaveRule.id}`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        payload: {
          ...leaveRule.payload,
          annualLeaveMinimumWeeks: 5,
        },
      })
      .expect(200);

    expect(response.body.data.payload.annualLeaveMinimumWeeks).toBe(5);
  });
});
