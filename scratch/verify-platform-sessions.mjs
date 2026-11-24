// verify-platform-sessions.mjs
// E2E Verification for Platform Login History and Sessions

const API_BASE = 'http://localhost:3000/api/v1';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function login(email, password, totpCode = '123456', userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36') {
  const step1 = await request('/platform/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, totpCode }),
    headers: { 'User-Agent': userAgent },
  });

  if (!step1.ok) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(step1.data)}`);
  }

  return step1.data.data;
}

async function run() {
  console.log('--- Starting Platform Login History & Sessions E2E Verification ---');

  // 1. Authenticate as Platform Owner
  console.log('\n1. Logging in as Platform Owner (platform.owner@cmsnbd.com)...');
  const ownerAuth = await login('platform.owner@cmsnbd.com', 'password', '123456', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36');
  const ownerToken = ownerAuth.accessToken;
  console.log('✓ Platform Owner authenticated successfully.');

  // 2. Authenticate as Platform Admin
  console.log('\n2. Logging in as Platform Admin (platform.admin@cmsnbd.com)...');
  const adminAuth = await login('platform.admin@cmsnbd.com', 'password', '123456', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15');
  const adminToken = adminAuth.accessToken;
  console.log('✓ Platform Admin authenticated successfully.');

  // 3. List Staff Sessions
  console.log('\n3. Testing GET /platform/staff/sessions...');
  const sessionsRes = await request('/platform/staff/sessions', {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  if (!sessionsRes.ok) {
    throw new Error(`Failed to list sessions: ${JSON.stringify(sessionsRes.data)}`);
  }
  const sessions = sessionsRes.data.data;
  console.log(`✓ Fetched ${sessions.length} staff sessions.`);

  const sampleSession = sessions[0];
  console.log('Sample session fields:', {
    id: sampleSession.id,
    userName: sampleSession.userName,
    userEmail: sampleSession.userEmail,
    role: sampleSession.userRoleName,
    ip: sampleSession.ipAddress,
    device: sampleSession.device,
    browser: sampleSession.browser,
    os: sampleSession.os,
    location: sampleSession.location,
    country: sampleSession.country,
    isUnusual: sampleSession.isUnusualLocation,
    isRevoked: sampleSession.isRevoked,
  });

  if (!sampleSession.device || !sampleSession.location) {
    throw new Error('Session is missing expected enriched device or location telemetry');
  }

  // 4. List Staff Login History
  console.log('\n4. Testing GET /platform/staff/login-history...');
  const historyRes = await request('/platform/staff/login-history?page=1&limit=10', {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  if (!historyRes.ok) {
    throw new Error(`Failed to list login history: ${JSON.stringify(historyRes.data)}`);
  }
  const history = historyRes.data.data;
  console.log(`✓ Fetched login history (total: ${history.total}, items in page: ${history.items.length}).`);

  const sampleLogin = history.items[0];
  console.log('Sample login telemetry fields:', {
    id: sampleLogin.id,
    email: sampleLogin.email,
    userName: sampleLogin.userName,
    role: sampleLogin.userRoleName,
    status: sampleLogin.status,
    twoFactorResult: sampleLogin.twoFactorResult,
    device: sampleLogin.device,
    location: sampleLogin.location,
    country: sampleLogin.country,
    isUnusual: sampleLogin.isUnusualLocation,
  });

  if (!sampleLogin.twoFactorResult) {
    throw new Error('Login record missing twoFactorResult classification');
  }

  // 5. Test Role-Based Revocation Restriction
  console.log('\n5. Testing Apex Role Hierarchy Enforcement on Session Revocation...');
  // Find an active owner session
  const ownerSession = sessions.find((s) => s.userEmail === 'platform.owner@cmsnbd.com' && !s.isRevoked);
  if (ownerSession) {
    console.log(`Attempting to revoke Platform Owner session (${ownerSession.id}) as Platform Admin...`);
    const unauthorizedRevoke = await request(`/platform/staff/sessions/${ownerSession.id}/revoke`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ reason: 'Admin testing unauthorized revoke' }),
    });

    if (unauthorizedRevoke.status === 403) {
      console.log('✓ Successfully blocked non-owner from revoking Platform Owner session (403 Forbidden: OWNER_RESTRICTION).');
    } else {
      throw new Error(`Expected 403 Forbidden, received status ${unauthorizedRevoke.status}: ${JSON.stringify(unauthorizedRevoke.data)}`);
    }
  }

  // 6. Test Admin Revoking a Staff Session
  console.log('\n6. Testing authorized session revocation as Platform Owner...');
  // Find an active admin session
  const adminSession = sessions.find((s) => s.userEmail === 'platform.admin@cmsnbd.com' && !s.isRevoked);
  if (adminSession) {
    console.log(`Revoking Platform Admin session (${adminSession.id})...`);
    const revokeRes = await request(`/platform/staff/sessions/${adminSession.id}/revoke`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ reason: 'Security anomaly test revocation' }),
    });

    if (!revokeRes.ok) {
      throw new Error(`Failed to revoke session: ${JSON.stringify(revokeRes.data)}`);
    }
    console.log('✓ Session revoked successfully:', revokeRes.data.data);
    if (!revokeRes.data.data.isRevoked) {
      throw new Error('Revoked session should have isRevoked: true');
    }
  }

  // 7. Test Security Stats Aggregation
  console.log('\n7. Testing GET /platform/staff/security-stats...');
  const statsRes = await request('/platform/staff/security-stats', {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  if (!statsRes.ok) {
    throw new Error(`Failed to get security stats: ${JSON.stringify(statsRes.data)}`);
  }
  console.log('✓ Security stats:', statsRes.data.data);

  console.log('\n========================================');
  console.log('All Platform Sessions & Login History checks PASSED!');
  console.log('========================================');
}

run().catch((err) => {
  console.error('\n❌ Verification FAILED:', err);
  process.exit(1);
});
