import { PrismaClient } from '@prisma/client';

const BASE_URL = 'http://localhost:3000';
const prisma = new PrismaClient();

const results = [];

function recordResult(boundary, testName, expectedStatus, expectedCode, actualStatus, actualCode, passed, details = '') {
  results.push({
    boundary,
    testName,
    expectedStatus,
    expectedCode,
    actualStatus,
    actualCode,
    passed,
    details,
  });
  const symbol = passed ? '✅' : '❌';
  console.log(`${symbol} [${boundary}] ${testName} -> HTTP ${actualStatus} (${actualCode}) [Expected: ${expectedStatus} / ${expectedCode}]`);
  if (!passed && details) {
    console.error(`   Error details:`, details);
  }
}

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

async function run() {
  console.log('================================================================');
  console.log('   HRM SECURITY BOUNDARY & ISOLATION VERIFICATION SUITE');
  console.log('================================================================\n');

  // 0. Setup: Obtain authentic tokens
  console.log('--- Phase 0: Authenticating Test Personas ---');
  
  // Tenant Login (Payroll Admin)
  const tenantLoginRes = await request('/api/v1/auth/login', {
    method: 'POST',
    body: { email: 'payroll@cmsnbd.com', password: 'password' },
  });
  if (![200, 201].includes(tenantLoginRes.status) || !tenantLoginRes.data?.data?.accessToken) {
    throw new Error(`Failed to log in as tenant user: ${JSON.stringify(tenantLoginRes.data)}`);
  }
  const tenantJwt = tenantLoginRes.data.data.accessToken;
  const tenantId = tenantLoginRes.data.data.user.tenantId;
  console.log(`Tenant token acquired for tenant: ${tenantId}`);

  // Platform Login (Support Agent)
  const platformLoginRes = await request('/api/v1/platform/auth/login', {
    method: 'POST',
    body: { email: 'support.agent@cmsnbd.com', password: 'password', totpCode: '123456' },
  });
  if (![200, 201].includes(platformLoginRes.status) || !platformLoginRes.data?.data?.accessToken) {
    throw new Error(`Failed to log in as platform staff: ${JSON.stringify(platformLoginRes.data)}`);
  }
  const platformStaffJwt = platformLoginRes.data.data.accessToken;
  const platformStaffUser = platformLoginRes.data.data.user;
  console.log(`Platform staff token acquired for staff: ${platformStaffUser.email} (${platformStaffUser.id})\n`);

  // ==========================================================================
  // BOUNDARY 1: Using a Tenant JWT on /platform/*
  // ==========================================================================
  console.log('--- Boundary 1: Using a Tenant JWT on /platform/* ---');
  {
    // 1a. Tenant token on platform auth me
    const res1a = await request('/api/v1/platform/auth/me', {
      headers: { Authorization: `Bearer ${tenantJwt}` },
    });
    const code1a = res1a.data?.error?.code ?? '';
    recordResult(
      'Boundary 1',
      'Tenant JWT on GET /api/v1/platform/auth/me',
      401,
      'TENANT_TOKEN_NOT_ALLOWED',
      res1a.status,
      code1a,
      res1a.status === 401 && code1a === 'TENANT_TOKEN_NOT_ALLOWED',
      JSON.stringify(res1a.data)
    );

    // 1b. Tenant token on platform tenants directory
    const res1b = await request('/api/v1/platform/tenants', {
      headers: { Authorization: `Bearer ${tenantJwt}` },
    });
    const code1b = res1b.data?.error?.code ?? '';
    recordResult(
      'Boundary 1',
      'Tenant JWT on GET /api/v1/platform/tenants',
      401,
      'TENANT_TOKEN_NOT_ALLOWED',
      res1b.status,
      code1b,
      res1b.status === 401 && code1b === 'TENANT_TOKEN_NOT_ALLOWED',
      JSON.stringify(res1b.data)
    );

    // 1c. Tenant token on platform audit log
    const res1c = await request('/api/v1/platform/audit-logs', {
      headers: { Authorization: `Bearer ${tenantJwt}` },
    });
    const code1c = res1c.data?.error?.code ?? '';
    recordResult(
      'Boundary 1',
      'Tenant JWT on GET /api/v1/platform/audit-logs',
      401,
      'TENANT_TOKEN_NOT_ALLOWED',
      res1c.status,
      code1c,
      res1c.status === 401 && code1c === 'TENANT_TOKEN_NOT_ALLOWED',
      JSON.stringify(res1c.data)
    );
  }
  console.log('');

  // ==========================================================================
  // BOUNDARY 2: Using a Platform JWT on Tenant APIs
  // ==========================================================================
  console.log('--- Boundary 2: Using a Platform JWT on Tenant APIs ---');
  {
    const company = await prisma.company.findFirst({ where: { tenantId } });
    const companyId = company?.id ?? '10000000-0000-4000-8000-000000000001';

    // 2a. Platform token on tenant employees API
    const res2a = await request('/api/v1/employees', {
      headers: { Authorization: `Bearer ${platformStaffJwt}` },
    });
    const code2a = res2a.data?.error?.code ?? '';
    recordResult(
      'Boundary 2',
      'Platform JWT on GET /api/v1/employees',
      401,
      'PLATFORM_TOKEN_NOT_ALLOWED',
      res2a.status,
      code2a,
      res2a.status === 401 && code2a === 'PLATFORM_TOKEN_NOT_ALLOWED',
      JSON.stringify(res2a.data)
    );

    // 2b. Platform token on tenant payroll periods API
    const res2b = await request(`/api/v1/companies/${companyId}/payroll-periods`, {
      headers: { Authorization: `Bearer ${platformStaffJwt}` },
    });
    const code2b = res2b.data?.error?.code ?? '';
    recordResult(
      'Boundary 2',
      'Platform JWT on GET /api/v1/companies/:companyId/payroll-periods',
      401,
      'PLATFORM_TOKEN_NOT_ALLOWED',
      res2b.status,
      code2b,
      res2b.status === 401 && code2b === 'PLATFORM_TOKEN_NOT_ALLOWED',
      JSON.stringify(res2b.data)
    );

    // 2c. Platform token on tenant leave requests API
    const res2c = await request(`/api/v1/companies/${companyId}/leave-requests`, {
      headers: { Authorization: `Bearer ${platformStaffJwt}` },
    });
    const code2c = res2c.data?.error?.code ?? '';
    recordResult(
      'Boundary 2',
      'Platform JWT on GET /api/v1/companies/:companyId/leave-requests',
      401,
      'PLATFORM_TOKEN_NOT_ALLOWED',
      res2c.status,
      code2c,
      res2c.status === 401 && code2c === 'PLATFORM_TOKEN_NOT_ALLOWED',
      JSON.stringify(res2c.data)
    );
  }
  console.log('');

  // ==========================================================================
  // BOUNDARY 3: Reading Tenant Employee or Payroll Data from Platform Plane
  //             Without an Active Support Session
  // ==========================================================================
  console.log('--- Boundary 3: Reading Tenant Data Without Active Support Session ---');
  {
    // 3a. Platform staff cannot bypass isolation via direct tenant API query
    const res3a = await request('/api/v1/employees?tenantId=' + tenantId, {
      headers: { Authorization: `Bearer ${platformStaffJwt}` },
    });
    const code3a = res3a.data?.error?.code ?? '';
    recordResult(
      'Boundary 3',
      'Direct tenant employee read with platform token',
      401,
      'PLATFORM_TOKEN_NOT_ALLOWED',
      res3a.status,
      code3a,
      res3a.status === 401 && code3a === 'PLATFORM_TOKEN_NOT_ALLOWED',
      JSON.stringify(res3a.data)
    );

    // 3b. Attempting to issue support token for non-existent session
    const fakeSessionId = '00000000-0000-0000-0000-000000000000';
    const res3b = await request(`/api/v1/platform/support-access/sessions/${fakeSessionId}/token`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${platformStaffJwt}` },
    });
    const code3b = res3b.data?.error?.code ?? '';
    recordResult(
      'Boundary 3',
      'Issue token for non-existent support session',
      404,
      'NOT_FOUND',
      res3b.status,
      code3b,
      res3b.status === 404 && code3b === 'NOT_FOUND',
      JSON.stringify(res3b.data)
    );

    // 3c. Attempting to issue support token for unapproved (pending) session
    const pendingRequest = await prisma.supportAccessRequest.create({
      data: {
        tenantId,
        platformUserId: platformStaffUser.id,
        staffName: `${platformStaffUser.firstName} ${platformStaffUser.lastName}`.trim(),
        staffEmail: platformStaffUser.email,
        reason: 'Unapproved test session',
        durationMinutes: 60,
        accessMode: 'read_only',
        status: 'pending',
      },
    });

    const res3c = await request(`/api/v1/platform/support-access/sessions/${pendingRequest.id}/token`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${platformStaffJwt}` },
    });
    const code3c = res3c.data?.error?.code ?? '';
    recordResult(
      'Boundary 3',
      'Issue token for unapproved (status: pending) support session',
      400,
      'SUPPORT_GRANT_NOT_ACTIVE',
      res3c.status,
      code3c,
      res3c.status === 400 && code3c === 'SUPPORT_GRANT_NOT_ACTIVE',
      JSON.stringify(res3c.data)
    );

    // Clean up temporary pending request
    await prisma.supportAccessRequest.delete({ where: { id: pendingRequest.id } });
  }
  console.log('');

  // ==========================================================================
  // BOUNDARY 4: Writing Under a Read-Only Support Session
  // ==========================================================================
  console.log('--- Boundary 4: Writing Under a Read-Only Support Session ---');
  {
    // Create an approved read-only support session
    const readOnlySession = await prisma.supportAccessRequest.create({
      data: {
        tenantId,
        platformUserId: platformStaffUser.id,
        staffName: `${platformStaffUser.firstName} ${platformStaffUser.lastName}`.trim(),
        staffEmail: platformStaffUser.email,
        reason: 'Investigating timesheet discrepancies',
        durationMinutes: 60,
        accessMode: 'read_only',
        status: 'approved',
        approvedAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    // Obtain impersonation token
    const tokenRes = await request(`/api/v1/platform/support-access/sessions/${readOnlySession.id}/token`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${platformStaffJwt}` },
    });
    if (tokenRes.status !== 200 || !tokenRes.data?.data?.accessToken) {
      throw new Error(`Failed to issue read-only support token: ${JSON.stringify(tokenRes.data)}`);
    }
    const readOnlySupportJwt = tokenRes.data.data.accessToken;

    // 4a. Read operation MUST succeed (200 OK)
    const res4a = await request('/api/v1/employees', {
      headers: { Authorization: `Bearer ${readOnlySupportJwt}` },
    });
    recordResult(
      'Boundary 4',
      'GET /api/v1/employees under read_only session (Read Allowed)',
      200,
      'OK',
      res4a.status,
      res4a.status === 200 ? 'OK' : res4a.data?.error?.code,
      res4a.status === 200,
      JSON.stringify(res4a.data)
    );

    // 4b. Write operation (POST /api/v1/employees) MUST FAIL (403 Forbidden, SUPPORT_ACCESS_READ_ONLY)
    const res4b = await request('/api/v1/employees', {
      method: 'POST',
      headers: { Authorization: `Bearer ${readOnlySupportJwt}` },
      body: { firstName: 'Illicit', lastName: 'Write' },
    });
    const code4b = res4b.data?.error?.code ?? '';
    recordResult(
      'Boundary 4',
      'POST /api/v1/employees under read_only session (Write Blocked)',
      403,
      'SUPPORT_ACCESS_READ_ONLY',
      res4b.status,
      code4b,
      res4b.status === 403 && code4b === 'SUPPORT_ACCESS_READ_ONLY',
      JSON.stringify(res4b.data)
    );

    // 4c. Update operation (PATCH /api/v1/employees/:id) MUST FAIL (403 Forbidden, SUPPORT_ACCESS_READ_ONLY)
    const res4c = await request('/api/v1/employees/10000000-0000-4000-8000-000000000042', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${readOnlySupportJwt}` },
      body: { firstName: 'Hacked' },
    });
    const code4c = res4c.data?.error?.code ?? '';
    recordResult(
      'Boundary 4',
      'PATCH /api/v1/employees/:id under read_only session (Write Blocked)',
      403,
      'SUPPORT_ACCESS_READ_ONLY',
      res4c.status,
      code4c,
      res4c.status === 403 && code4c === 'SUPPORT_ACCESS_READ_ONLY',
      JSON.stringify(res4c.data)
    );

    // 4d. Delete operation (DELETE /api/v1/employees/:id) MUST FAIL (403 Forbidden, SUPPORT_ACCESS_READ_ONLY)
    const res4d = await request('/api/v1/employees/10000000-0000-4000-8000-000000000042', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${readOnlySupportJwt}` },
    });
    const code4d = res4d.data?.error?.code ?? '';
    recordResult(
      'Boundary 4',
      'DELETE /api/v1/employees/:id under read_only session (Delete Blocked)',
      403,
      'SUPPORT_ACCESS_READ_ONLY',
      res4d.status,
      code4d,
      res4d.status === 403 && code4d === 'SUPPORT_ACCESS_READ_ONLY',
      JSON.stringify(res4d.data)
    );

    // Clean up read-only session
    await prisma.supportAccessRequest.delete({ where: { id: readOnlySession.id } });
  }
  console.log('');

  // ==========================================================================
  // BOUNDARY 5: Finalizing Payroll or Revealing Bank Details Under ANY Support Session
  //             (Even Read-Write Mode)
  // ==========================================================================
  console.log('--- Boundary 5: Finalizing Payroll or Revealing Bank Details Under Support Session ---');
  {
    // Create an approved read-write support session
    const readWriteSession = await prisma.supportAccessRequest.create({
      data: {
        tenantId,
        platformUserId: platformStaffUser.id,
        staffName: `${platformStaffUser.firstName} ${platformStaffUser.lastName}`.trim(),
        staffEmail: platformStaffUser.email,
        reason: 'Emergency payroll formula troubleshooting',
        durationMinutes: 60,
        accessMode: 'read_write',
        status: 'approved',
        approvedAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    // Obtain impersonation token
    const tokenRes = await request(`/api/v1/platform/support-access/sessions/${readWriteSession.id}/token`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${platformStaffJwt}` },
    });
    if (tokenRes.status !== 200 || !tokenRes.data?.data?.accessToken) {
      throw new Error(`Failed to issue read-write support token: ${JSON.stringify(tokenRes.data)}`);
    }
    const readWriteSupportJwt = tokenRes.data.data.accessToken;

    // 5a. Reveal bank details MUST FAIL (403 Forbidden, SUPPORT_ACCESS_RESTRICTED)
    const res5a = await request(
      '/api/v1/employees/10000000-0000-4000-8000-000000000042/tax-profile/reveal?field=bankAccountNumber',
      {
        headers: { Authorization: `Bearer ${readWriteSupportJwt}` },
      }
    );
    const code5a = res5a.data?.error?.code ?? '';
    recordResult(
      'Boundary 5',
      'GET /tax-profile/reveal?field=bankAccountNumber under support session',
      403,
      'SUPPORT_ACCESS_RESTRICTED',
      res5a.status,
      code5a,
      res5a.status === 403 && code5a === 'SUPPORT_ACCESS_RESTRICTED',
      JSON.stringify(res5a.data)
    );

    // 5b. Payroll transition to "finalized" MUST FAIL (403 Forbidden, SUPPORT_ACCESS_RESTRICTED)
    const company = await prisma.company.findFirst({ where: { tenantId } });
    const companyId = company?.id ?? '10000000-0000-4000-8000-000000000001';

    const res5b = await request(
      `/api/v1/companies/${companyId}/payroll-periods/10000000-0000-4000-8000-000000000001/runs/transition`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${readWriteSupportJwt}` },
        body: { toStatus: 'finalized', confirmedCount: 1, confirmedNetTotal: 1000 },
      }
    );
    const code5b = res5b.data?.error?.code ?? '';
    recordResult(
      'Boundary 5',
      'POST /payroll-periods/:id/runs/transition (toStatus: finalized) under support session',
      403,
      'SUPPORT_ACCESS_RESTRICTED',
      res5b.status,
      code5b,
      res5b.status === 403 && code5b === 'SUPPORT_ACCESS_RESTRICTED',
      JSON.stringify(res5b.data)
    );

    // 5c. Single-run transition to "finalized" MUST FAIL (403 Forbidden, SUPPORT_ACCESS_RESTRICTED)
    const res5c = await request(
      `/api/v1/companies/${companyId}/payroll-runs/10000000-0000-4000-8000-000000000001/transition`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${readWriteSupportJwt}` },
        body: { toStatus: 'finalized' },
      }
    );
    const code5c = res5c.data?.error?.code ?? '';
    recordResult(
      'Boundary 5',
      'POST /payroll-runs/:id/transition (toStatus: finalized) under support session',
      403,
      'SUPPORT_ACCESS_RESTRICTED',
      res5c.status,
      code5c,
      res5c.status === 403 && code5c === 'SUPPORT_ACCESS_RESTRICTED',
      JSON.stringify(res5c.data)
    );

    // 5d. Transition to "paid" MUST FAIL (403 Forbidden, SUPPORT_ACCESS_RESTRICTED)
    const res5d = await request(
      `/api/v1/companies/${companyId}/payroll-periods/10000000-0000-4000-8000-000000000001/runs/transition`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${readWriteSupportJwt}` },
        body: { toStatus: 'paid' },
      }
    );
    const code5d = res5d.data?.error?.code ?? '';
    recordResult(
      'Boundary 5',
      'POST /payroll-periods/:id/runs/transition (toStatus: paid) under support session',
      403,
      'SUPPORT_ACCESS_RESTRICTED',
      res5d.status,
      code5d,
      res5d.status === 403 && code5d === 'SUPPORT_ACCESS_RESTRICTED',
      JSON.stringify(res5d.data)
    );

    // 5e. Payment batch mark-paid MUST FAIL (403 Forbidden, SUPPORT_ACCESS_RESTRICTED)
    const res5e = await request(
      `/api/v1/companies/${companyId}/payment-batches/10000000-0000-4000-8000-000000000001/mark-paid`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${readWriteSupportJwt}` },
      }
    );
    const code5e = res5e.data?.error?.code ?? '';
    recordResult(
      'Boundary 5',
      'POST /payment-batches/:id/mark-paid under support session',
      403,
      'SUPPORT_ACCESS_RESTRICTED',
      res5e.status,
      code5e,
      res5e.status === 403 && code5e === 'SUPPORT_ACCESS_RESTRICTED',
      JSON.stringify(res5e.data)
    );

    // Clean up session
    await prisma.supportAccessRequest.delete({ where: { id: readWriteSession.id } });
  }
  console.log('');

  // ==========================================================================
  // BOUNDARY 6: Using an Expired Support Token
  // ==========================================================================
  console.log('--- Boundary 6: Using an Expired Support Token ---');
  {
    // 6a. Database grant expired (expiresAt < now)
    const expiredSession = await prisma.supportAccessRequest.create({
      data: {
        tenantId,
        platformUserId: platformStaffUser.id,
        staffName: `${platformStaffUser.firstName} ${platformStaffUser.lastName}`.trim(),
        staffEmail: platformStaffUser.email,
        reason: 'Expired session testing',
        durationMinutes: 60,
        accessMode: 'read_only',
        status: 'approved',
        approvedAt: new Date(Date.now() - 2 * 3600 * 1000),
        expiresAt: new Date(Date.now() + 10 * 1000), // Initially valid for issuing
      },
    });

    const tokenRes = await request(`/api/v1/platform/support-access/sessions/${expiredSession.id}/token`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${platformStaffJwt}` },
    });
    if (tokenRes.status !== 200 || !tokenRes.data?.data?.accessToken) {
      throw new Error(`Failed to issue support token: ${JSON.stringify(tokenRes.data)}`);
    }
    const tokenToTest = tokenRes.data.data.accessToken;

    // Simulate session expiration in the database
    await prisma.supportAccessRequest.update({
      where: { id: expiredSession.id },
      data: {
        expiresAt: new Date(Date.now() - 3600 * 1000), // 1 hour ago
      },
    });

    const res6a = await request('/api/v1/employees', {
      headers: { Authorization: `Bearer ${tokenToTest}` },
    });
    const code6a = res6a.data?.error?.code ?? '';
    recordResult(
      'Boundary 6',
      'GET /api/v1/employees with expired support session grant (expiresAt in past)',
      401,
      'SUPPORT_SESSION_EXPIRED',
      res6a.status,
      code6a,
      res6a.status === 401 && code6a === 'SUPPORT_SESSION_EXPIRED',
      JSON.stringify(res6a.data)
    );

    // Verify DB status transitioned to 'expired'
    const updatedDbSession = await prisma.supportAccessRequest.findUnique({
      where: { id: expiredSession.id },
    });
    const dbStatusUpdated = updatedDbSession?.status === 'expired';
    recordResult(
      'Boundary 6',
      'Database status automatically transitions to "expired" on access attempt',
      200,
      'expired',
      200,
      updatedDbSession?.status,
      dbStatusUpdated,
      `Status in DB: ${updatedDbSession?.status}`
    );

    // 6b. Cryptographically expired token (forged or past JWT exp claim)
    // Create an expired JWT token using the known secret
    const jwt = await import('jsonwebtoken');
    const secret = process.env.JWT_ACCESS_SECRET ?? 'hrm_secret_jwt_access_super_secure_2026';
    const expiredJwt = jwt.default.sign(
      {
        sub: '10000000-0000-4000-8000-000000000062',
        tenant_id: tenantId,
        role_id: '10000000-0000-4000-8000-000000000033',
        role_name: 'Payroll Admin',
        support_access: true,
        support_request_id: expiredSession.id,
        access_mode: 'read_only',
        exp: Math.floor(Date.now() / 1000) - 60, // expired 60s ago
      },
      secret
    );

    const res6b = await request('/api/v1/employees', {
      headers: { Authorization: `Bearer ${expiredJwt}` },
    });
    const code6b = res6b.data?.error?.code ?? '';
    recordResult(
      'Boundary 6',
      'GET /api/v1/employees with cryptographically expired JWT (exp < now)',
      401,
      'UNAUTHENTICATED',
      res6b.status,
      code6b,
      res6b.status === 401 && (code6b === 'UNAUTHENTICATED' || code6b === 'UNAUTHORIZED'),
      JSON.stringify(res6b.data)
    );

    // Clean up
    await prisma.supportAccessRequest.delete({ where: { id: expiredSession.id } });
  }
  console.log('');

  // ==========================================================================
  // Summary
  // ==========================================================================
  console.log('================================================================');
  console.log('                 SECURITY VERIFICATION SUMMARY');
  console.log('================================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log(`Total Security Assertions: ${total}`);
  console.log(`Passed:                   ${passed}`);
  console.log(`Failed:                   ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    console.error('CRITICAL: Some security boundaries failed verification!');
    process.exit(1);
  } else {
    console.log('ALL 6 SECURITY BOUNDARIES CONFIRMED AND ENFORCED.');
  }
}

run()
  .catch((err) => {
    console.error('Fatal error during verification:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
