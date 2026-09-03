import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient, TenantSettingCategory } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
import { createGlobalValidationPipe } from '../src/common/pipes/validation.pipe';
import { MailService } from '../src/settings/mail.service';
import { smtpSettingKeyForCompany } from '../src/settings/smtp-settings.utils';

describe('Company SMTP settings (NOTIFICATION_LOGIC.md §11)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let adminToken: string;
  let employeeToken: string;
  let companyId: string;
  let tenantId: string;
  const sendTestEmail = jest.fn().mockResolvedValue(undefined);

  beforeAll(async () => {
    if (!process.env.FIELD_ENCRYPTION_KEY) {
      process.env.FIELD_ENCRYPTION_KEY = 'test-field-encryption-key-32chars!';
    }

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue({ sendTestEmail, sendMail: sendTestEmail })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['', 'health'] });
    app.useGlobalPipes(createGlobalValidationPipe());
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();

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
    const company = await prisma.company.findUniqueOrThrow({
      where: { id: companyId },
    });
    tenantId = company.tenantId;
  });

  afterAll(async () => {
    await prisma.tenantSetting.deleteMany({
      where: {
        tenantId,
        category: TenantSettingCategory.smtp,
        key: smtpSettingKeyForCompany(companyId),
      },
    });
    await prisma.$disconnect();
    await app.close();
  });

  it('returns empty SMTP settings before configuration', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/organization/companies/${companyId}/settings/smtp`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.data).toMatchObject({
      configured: false,
      passwordConfigured: false,
      passwordMasked: null,
      port: 587,
      useTls: true,
    });
  });

  it('denies SMTP settings without settings:view permission', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/organization/companies/${companyId}/settings/smtp`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(403);
  });

  it('saves SMTP settings with encrypted password and masks on read', async () => {
    const save = await request(app.getHttpServer())
      .put(`/api/v1/organization/companies/${companyId}/settings/smtp`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        host: 'smtp.example.com',
        port: 587,
        username: 'mailer@example.com',
        password: 'super-secret-smtp-password',
        fromAddress: 'noreply@example.com',
        fromName: 'Demo Corp',
        useTls: true,
      })
      .expect(200);

    expect(save.body.data).toMatchObject({
      configured: true,
      host: 'smtp.example.com',
      passwordConfigured: true,
      passwordMasked: '••••••••',
    });
    expect(JSON.stringify(save.body.data)).not.toContain(
      'super-secret-smtp-password',
    );

    const stored = await prisma.tenantSetting.findUniqueOrThrow({
      where: {
        tenantId_category_key: {
          tenantId,
          category: TenantSettingCategory.smtp,
          key: smtpSettingKeyForCompany(companyId),
        },
      },
    });

    expect(JSON.stringify(stored.value)).not.toContain(
      'super-secret-smtp-password',
    );

    const read = await request(app.getHttpServer())
      .get(`/api/v1/organization/companies/${companyId}/settings/smtp`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(read.body.data.passwordMasked).toBe('••••••••');
    expect(JSON.stringify(read.body.data)).not.toContain(
      'super-secret-smtp-password',
    );
  });

  it('keeps existing password when update omits password', async () => {
    await request(app.getHttpServer())
      .put(`/api/v1/organization/companies/${companyId}/settings/smtp`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        host: 'smtp.updated.example.com',
        port: 465,
        username: 'mailer@example.com',
        fromAddress: 'noreply@example.com',
        fromName: 'Demo Corp Updated',
        useTls: true,
      })
      .expect(200);

    const stored = await prisma.tenantSetting.findUniqueOrThrow({
      where: {
        tenantId_category_key: {
          tenantId,
          category: TenantSettingCategory.smtp,
          key: smtpSettingKeyForCompany(companyId),
        },
      },
    });

    expect(stored.value).toMatchObject({
      host: 'smtp.updated.example.com',
      port: 465,
      fromName: 'Demo Corp Updated',
    });
    expect((stored.value as { passwordEnc?: string }).passwordEnc).toBeTruthy();
  });

  it('sends test email using saved settings', async () => {
    sendTestEmail.mockClear();

    const response = await request(app.getHttpServer())
      .post(`/api/v1/organization/companies/${companyId}/settings/smtp/test`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ toEmail: 'admin@cmsnbd.com' })
      .expect(200);

    expect(response.body.data).toEqual({
      sent: true,
      toEmail: 'admin@cmsnbd.com',
    });
    expect(sendTestEmail).toHaveBeenCalledTimes(1);
    expect(sendTestEmail.mock.calls[0][1]).toBe('admin@cmsnbd.com');
  });
});
