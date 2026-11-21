import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

describe('White-Label Branding & Custom Domain Support (E2E Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let testTenantId: string;
  let testUserId: string;
  let testUserToken: string;
  let customDomainId: string;

  const testSubdomain = `wl-test-${Date.now()}`;
  const testEmail = `admin-${Date.now()}@wl-corp.local`;
  const testPassword = 'Password123!';
  const customDomainName = `hr.wl-corp-${Date.now()}.test`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['', 'health'] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // 1. Create a test tenant
    const tenant = await prisma.unscoped.tenant.create({
      data: {
        name: `White-Label Test Corp ${Date.now()}`,
        subdomain: testSubdomain,
        planId: 'enterprise',
        status: 'active',
      },
    });
    testTenantId = tenant.id;

    // 2. Find or create a role with 'settings' permissions for the tenant
    let role = await prisma.unscoped.role.findFirst({
      where: { tenantId: testTenantId },
    });
    if (!role) {
      role = await prisma.unscoped.role.create({
        data: {
          tenantId: testTenantId,
          name: 'Company Owner',
          permissions: {
            create: [
              { module: 'settings', action: 'view' },
              { module: 'settings', action: 'edit' },
              { module: 'employee', action: 'view' },
            ],
          },
        },
      });
    }

    // 3. Create test user
    const passwordHash = await bcrypt.hash(testPassword, 10);
    const user = await prisma.unscoped.user.create({
      data: {
        tenantId: testTenantId,
        roleId: role.id,
        email: testEmail,
        passwordHash,
        isActive: true,
      },
    });
    testUserId = user.id;

    // 4. Log in to get JWT access token
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
        tenantSubdomain: testSubdomain,
      })
      .expect(201);

    testUserToken = loginRes.body.data.accessToken;
  });

  afterAll(async () => {
    if (customDomainId) {
      await prisma.unscoped.tenantCustomDomain.deleteMany({
        where: { tenantId: testTenantId },
      });
    }
    if (testTenantId) {
      await prisma.unscoped.tenantBranding.deleteMany({
        where: { tenantId: testTenantId },
      });
      await prisma.unscoped.tenantSetting.deleteMany({
        where: { tenantId: testTenantId },
      });
      await prisma.unscoped.user.deleteMany({
        where: { tenantId: testTenantId },
      });
      await prisma.unscoped.permission.deleteMany({
        where: { role: { tenantId: testTenantId } },
      });
      await prisma.unscoped.role.deleteMany({
        where: { tenantId: testTenantId },
      });
      await prisma.unscoped.tenant.delete({
        where: { id: testTenantId },
      }).catch(() => null);
    }
    await app.close();
  });

  describe('1. Tenant Branding (Logo, Colors, Email Sender Name & Address)', () => {
    it('GET /api/v1/branding: fetches initial default branding', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/branding')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);

      expect(res.body.data.tenantId).toBe(testTenantId);
      expect(res.body.data.subdomain).toBe(testSubdomain);
      expect(res.body.data.primaryColor).toBe('#2563EB');
      expect(res.body.data.logoUrl).toBeNull();
    });

    it('PUT /api/v1/branding: updates logo, primary colour, and email sender identity', async () => {
      const brandingPayload = {
        logoUrl: 'https://cdn.wl-corp.local/assets/logo.png',
        faviconUrl: 'https://cdn.wl-corp.local/assets/favicon.ico',
        primaryColor: '#0D9488',
        secondaryColor: '#0F766E',
        appTitle: 'White-Label Enterprise Portal',
        emailSenderName: 'White-Label HR Team',
        emailSenderAddress: 'hr@wl-corp.local',
      };

      const res = await request(app.getHttpServer())
        .put('/api/v1/branding')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send(brandingPayload)
        .expect(200);

      expect(res.body.data.logoUrl).toBe(brandingPayload.logoUrl);
      expect(res.body.data.primaryColor).toBe('#0D9488');
      expect(res.body.data.secondaryColor).toBe('#0F766E');
      expect(res.body.data.emailSenderName).toBe('White-Label HR Team');
      expect(res.body.data.emailSenderAddress).toBe('hr@wl-corp.local');

      // Verify persistence in tenant_brandings table
      const dbBranding = await prisma.unscoped.tenantBranding.findUnique({
        where: { tenantId: testTenantId },
      });
      expect(dbBranding).toBeDefined();
      expect(dbBranding?.primaryColor).toBe('#0D9488');
      expect(dbBranding?.senderName).toBe('White-Label HR Team');

      // Verify synced into tenant_settings (category: branding, key: default)
      const dbSetting = await prisma.unscoped.tenantSetting.findFirst({
        where: { tenantId: testTenantId, category: 'branding', key: 'default' },
      });
      expect(dbSetting).toBeDefined();
      expect((dbSetting?.value as any)?.logoUrl).toBe(brandingPayload.logoUrl);
    });
  });

  describe('2. Custom Domain Support, DNS Records & Automated TLS Provisioning', () => {
    it('POST /api/v1/custom-domains: registers custom domain and returns required DNS records', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/custom-domains')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ domain: customDomainName })
        .expect(201);

      const domain = res.body.data;
      expect(domain.domain).toBe(customDomainName.toLowerCase());
      expect(domain.status).toBe('pending_verification');
      expect(domain.sslStatus).toBe('pending');
      expect(domain.verificationToken).toMatch(/^hrm-verify-[a-f0-9]{32}$/);
      expect(domain.dnsRecords.length).toBeGreaterThanOrEqual(2);

      // Check TXT verification record and CNAME target exist
      const txtRec = domain.dnsRecords.find((r: any) => r.type === 'TXT' && r.name.startsWith('_hrm-verify'));
      expect(txtRec).toBeDefined();
      expect(txtRec.expectedValue).toBe(domain.verificationToken);

      const cnameRec = domain.dnsRecords.find((r: any) => r.type === 'CNAME');
      expect(cnameRec).toBeDefined();

      customDomainId = domain.id;
    });

    it('POST /api/v1/custom-domains/:id/verify: verification job checks DNS and provisions TLS certificates', async () => {
      // The domain ends in '.test', so DnsVerificationService auto-verifies and triggers AutomaticTlsProvider
      const res = await request(app.getHttpServer())
        .post(`/api/v1/custom-domains/${customDomainId}/verify`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(201);

      expect(res.body.data.verified).toBe(true);
      expect(res.body.data.status).toBe('active');

      // Inspect custom domain details via GET
      const getRes = await request(app.getHttpServer())
        .get(`/api/v1/custom-domains/${customDomainId}`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);

      const domain = getRes.body.data;
      expect(domain.status).toBe('active');
      expect(domain.sslStatus).toBe('active');
      expect(domain.sslCertificateId).toMatch(/^cert_le_/);
      expect(domain.sslIssuedAt).toBeDefined();
      expect(domain.sslExpiresAt).toBeDefined();
      expect(domain.sslDetails.issuer).toContain("Let's Encrypt");
    });
  });

  describe('3. Tenant-Resolved Login from Custom Domain (AUTH_FLOW.md §5)', () => {
    it('GET /api/v1/auth/resolve-tenant: resolves tenant and branding from custom domain', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/auth/resolve-tenant?domain=${customDomainName}`)
        .expect(200);

      expect(res.body.data.tenantId).toBe(testTenantId);
      expect(res.body.data.subdomain).toBe(testSubdomain);
      expect(res.body.data.branding.primaryColor).toBe('#0D9488');
      expect(res.body.data.branding.logoUrl).toBe('https://cdn.wl-corp.local/assets/logo.png');
      expect(res.body.data.customDomain.domain).toBe(customDomainName.toLowerCase());
      expect(res.body.data.customDomain.sslStatus).toBe('active');
    });

    it('POST /api/v1/auth/login: logs in using customDomain in request body', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
          customDomain: customDomainName,
        })
        .expect(201);

      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.tenantId).toBe(testTenantId);
      expect(res.body.data.user.email).toBe(testEmail);
    });

    it('POST /api/v1/auth/login: logs in automatically via x-custom-domain header', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('x-custom-domain', customDomainName)
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(201);

      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.tenantId).toBe(testTenantId);
    });
  });
});
