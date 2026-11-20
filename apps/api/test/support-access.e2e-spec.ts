import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
import { createGlobalValidationPipe } from '../src/common/pipes/validation.pipe';

describe('Support Access Mechanism (SECURITY.md §2, AUDIT_LOG.md)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwtService: JwtService;

  let platformToken: string;
  let platformUserId: string;
  let tenantId: string;
  let tenantOwnerToken: string;
  let tenantOwnerUserId: string;
  let companyId: string;

  const jwtSecret =
    process.env.JWT_ACCESS_SECRET ?? 'hrm_secret_jwt_access_super_secure_2026';

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
    jwtService = moduleFixture.get<JwtService>(JwtService);

    // 1. Ensure platform staff user
    let platformRole = await prisma.platformRole.findFirst({
      where: { name: 'Platform Owner' },
    });
    if (!platformRole) {
      platformRole = await prisma.platformRole.create({
        data: {
          name: 'Platform Owner',
          description: 'Full platform administrative access',
        },
      });
    }

    const platformUser = await prisma.platformUser.upsert({
      where: { email: 'e2e.staff@platform.local' },
      create: {
        email: 'e2e.staff@platform.local',
        passwordHash: 'not-needed-for-token',
        firstName: 'Elena',
        lastName: 'Rostova',
        roleId: platformRole.id,
        isActive: true,
      },
      update: {
        isActive: true,
      },
    });
    platformUserId = platformUser.id;

    platformToken = await jwtService.signAsync(
      {
        sub: platformUser.id,
        email: platformUser.email,
        role_id: platformRole.id,
        role_name: platformRole.name,
        permissions: [
          { module: 'tenant', action: 'view' },
          { module: 'tenant', action: 'edit' },
        ],
        aud: 'platform',
      },
      { secret: jwtSecret, expiresIn: '1h' },
    );

    // 2. Fetch demo tenant and Company Owner
    const demoTenant = await prisma.tenant.findUnique({
      where: { subdomain: 'demo' },
      include: {
        companies: true,
      },
    });
    expect(demoTenant).toBeTruthy();
    tenantId = demoTenant!.id;
    companyId = demoTenant!.companies[0].id;

    // Clear preauthorization setting for demo tenant to start fresh
    await prisma.tenantSetting.deleteMany({
      where: {
        tenantId,
        category: 'security',
        key: 'support_access',
      },
    });

    const ownerUser = await prisma.user.findFirst({
      where: {
        tenantId,
        role: { name: 'Company Owner' },
      },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });
    expect(ownerUser).toBeTruthy();
    tenantOwnerUserId = ownerUser!.id;

    tenantOwnerToken = await jwtService.signAsync(
      {
        sub: ownerUser!.id,
        tenant_id: tenantId,
        role_id: ownerUser!.roleId,
        role_name: ownerUser!.role.name,
        employee_id: ownerUser!.employeeId,
        permissions: ownerUser!.role.permissions.map((p) => ({
          module: p.module,
          action: p.action,
        })),
        data_scope: 'all',
      },
      { secret: jwtSecret, expiresIn: '1h' },
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('rejects duration > 240 minutes (max 4 hours)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/platform/tenants/${tenantId}/support-access/request`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        reason: 'Investigating payroll calculation error for tenant',
        durationMinutes: 300,
        accessMode: 'read_only',
      });

    expect(res.status).toBe(400);
  });

  it('rejects short reasons (< 10 characters)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/platform/tenants/${tenantId}/support-access/request`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        reason: 'Fix bug',
        durationMinutes: 60,
        accessMode: 'read_only',
      });

    expect(res.status).toBe(400);
  });

  it('creates a pending request when workspace has NOT pre-authorised support access', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/platform/tenants/${tenantId}/support-access/request`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        reason: 'Investigating overtime rule calculation error in pay period 12',
        durationMinutes: 60,
        accessMode: 'read_only',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.autoApproved).toBe(false);
    expect(res.body.data.staffName).toBe('Elena Rostova');
  });

  let approvedRequestId: string;
  let impersonationToken: string;

  it('allows tenant Company Owner to approve the pending request', async () => {
    const pendingReq = await prisma.supportAccessRequest.findFirst({
      where: { tenantId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });
    expect(pendingReq).toBeTruthy();
    approvedRequestId = pendingReq!.id;

    const res = await request(app.getHttpServer())
      .post(
        `/api/v1/tenant/security/support-access/requests/${approvedRequestId}/approve`,
      )
      .set('Authorization', `Bearer ${tenantOwnerToken}`)
      .send({ accessMode: 'read_only' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('approved');
    expect(res.body.data.expiresAt).toBeTruthy();
  });

  it('issues a cryptographically signed impersonation token with support claims', async () => {
    const res = await request(app.getHttpServer())
      .post(
        `/api/v1/platform/tenants/${tenantId}/support-access/requests/${approvedRequestId}/token`,
      )
      .set('Authorization', `Bearer ${platformToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.accessMode).toBe('read_only');
    expect(res.body.data.staffName).toBe('Elena Rostova');
    impersonationToken = res.body.data.accessToken;
  });

  it('allows read requests with impersonation token and dual-logs with staff name visible', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/organization/companies/${companyId}/departments`)
      .set('Authorization', `Bearer ${impersonationToken}`);

    expect(res.status).toBe(200);

    // Check platform audit log
    const platformLog = await prisma.platformAuditLog.findFirst({
      where: {
        userId: platformUserId,
        action: 'support_access.api_call',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(platformLog).toBeTruthy();
    expect(platformLog?.reason).toContain('Elena Rostova');

    // Check tenant audit log
    const tenantLog = await prisma.auditLog.findFirst({
      where: {
        tenantId,
        module: 'support_access',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(tenantLog).toBeTruthy();
    expect(tenantLog?.device).toContain('Elena Rostova');
  });

  it('blocks mutation requests in read_only mode (403 Forbidden)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/organization/companies/${companyId}/departments`)
      .set('Authorization', `Bearer ${impersonationToken}`)
      .send({ name: 'Unauthorized Support Department' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SUPPORT_ACCESS_READ_ONLY');
  });

  describe('Write mode & Hard-Blocks', () => {
    let writeImpersonationToken: string;

    beforeAll(async () => {
      // Create and approve a read_write session
      const reqRes = await request(app.getHttpServer())
        .post(`/api/v1/platform/tenants/${tenantId}/support-access/request`)
        .set('Authorization', `Bearer ${platformToken}`)
        .send({
          reason: 'Corrective data adjustment for missing department mapping',
          durationMinutes: 45,
          accessMode: 'read_write',
        });

      const writeReqId = reqRes.body.data.id;

      await request(app.getHttpServer())
        .post(
          `/api/v1/tenant/security/support-access/requests/${writeReqId}/approve`,
        )
        .set('Authorization', `Bearer ${tenantOwnerToken}`)
        .send({ accessMode: 'read_write' });

      const tokRes = await request(app.getHttpServer())
        .post(
          `/api/v1/platform/tenants/${tenantId}/support-access/requests/${writeReqId}/token`,
        )
        .set('Authorization', `Bearer ${platformToken}`);

      writeImpersonationToken = tokRes.body.data.accessToken;
    });

    it('strictly blocks bank-detail reveal even in write mode (403 Forbidden)', async () => {
      const emp = await prisma.employee.findFirst({
        where: { tenantId },
      });
      expect(emp).toBeTruthy();

      const res = await request(app.getHttpServer())
        .get(
          `/api/v1/employees/${emp!.id}/tax-profile/reveal?field=bankAccountNumber`,
        )
        .set('Authorization', `Bearer ${writeImpersonationToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('SUPPORT_ACCESS_RESTRICTED');
    });

    it('strictly blocks payroll finalization even in write mode (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .post(
          `/api/v1/companies/${companyId}/payroll-runs/20000000-0000-4000-8000-000000000001/transition`,
        )
        .set('Authorization', `Bearer ${writeImpersonationToken}`)
        .send({ toStatus: 'finalized' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('SUPPORT_ACCESS_RESTRICTED');
    });

    it('strictly blocks payment batch execution even in write mode (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .post(
          `/api/v1/companies/${companyId}/payment-batches/20000000-0000-4000-8000-000000000001/mark-paid`,
        )
        .set('Authorization', `Bearer ${writeImpersonationToken}`)
        .send({ transactionReference: 'TX9999' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('SUPPORT_ACCESS_RESTRICTED');
    });
  });

  describe('Pre-authorisation flow', () => {
    it('auto-approves immediately when workspace has pre-authorised support access', async () => {
      // 1. Tenant owner enables pre-authorisation
      const preauthRes = await request(app.getHttpServer())
        .put('/api/v1/tenant/security/support-access/preauthorize')
        .set('Authorization', `Bearer ${tenantOwnerToken}`)
        .send({ preauthorized: true });

      expect(preauthRes.status).toBe(200);
      expect(preauthRes.body.data.preauthorizedSupportAccess).toBe(true);

      // 2. Platform staff requests access
      const reqRes = await request(app.getHttpServer())
        .post(`/api/v1/platform/tenants/${tenantId}/support-access/request`)
        .set('Authorization', `Bearer ${platformToken}`)
        .send({
          reason: 'Emergency server diagnostic inspection during support escalation',
          durationMinutes: 90,
          accessMode: 'read_only',
        });

      expect(reqRes.status).toBe(201);
      expect(reqRes.body.data.status).toBe('approved');
      expect(reqRes.body.data.autoApproved).toBe(true);
      expect(reqRes.body.data.expiresAt).toBeTruthy();
    });
  });

  describe('Revocation flow', () => {
    it('revoking active support session immediately rejects further requests (401 Unauthorized)', async () => {
      // Revoke the first approved request
      const revokeRes = await request(app.getHttpServer())
        .post(
          `/api/v1/platform/tenants/${tenantId}/support-access/requests/${approvedRequestId}/revoke`,
        )
        .set('Authorization', `Bearer ${platformToken}`)
        .send({ reason: 'Investigation completed early by staff' });

      expect(revokeRes.status).toBe(200);
      expect(revokeRes.body.data.status).toBe('revoked');

      // Subsequent call using the old impersonation token is rejected
      const apiRes = await request(app.getHttpServer())
        .get(`/api/v1/organization/companies/${companyId}/departments`)
        .set('Authorization', `Bearer ${impersonationToken}`);

      expect(apiRes.status).toBe(401);
      expect(apiRes.body.error.code).toBe('SUPPORT_SESSION_REVOKED');
    });
  });
});
