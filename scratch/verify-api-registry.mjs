// scratch/verify-api-registry.mjs
import * as crypto from 'crypto';

const API_BASE = 'http://localhost:3000/api/v1';

async function generateTotp(secret) {
  // Standard RFC 6238 TOTP
  const epoch = Math.floor(Date.now() / 1000);
  const timeStep = 30;
  const counter = Math.floor(epoch / timeStep);
  const b = Buffer.alloc(8);
  b.writeBigInt64BE(BigInt(counter));

  // base32 decode
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of secret.toUpperCase()) {
    const val = base32Chars.indexOf(char);
    if (val !== -1) bits += val.toString(2).padStart(5, '0');
  }
  const key = Buffer.alloc(Math.floor(bits.length / 8));
  for (let i = 0; i < key.length; i++) {
    key[i] = parseInt(bits.substring(i * 8, i * 8 + 8), 2);
  }

  const hmac = crypto.createHmac('sha1', key).update(b).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (code % 1000000).toString().padStart(6, '0');
}

async function loginAsPlatformOwner() {
  console.log('1. Logging in as Platform Owner...');
  const loginRes = await fetch(`${API_BASE}/platform/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'platform.owner@cmsnbd.com',
      password: 'password',
      totpCode: '123456',
    }),
  });

  const loginData = await loginRes.json();
  if (!loginRes.ok) {
    throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
  }

  const token = loginData.data?.accessToken || loginData.accessToken;
  console.log('Successfully authenticated as Platform Owner.');
  return token;
}

async function run() {
  const token = await loginAsPlatformOwner();
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  console.log('\n2. Testing GET /api/v1/platform/api-registry/summary...');
  const sumRes = await fetch(`${API_BASE}/platform/api-registry/summary`, {
    headers: authHeaders,
  });
  const sumData = await sumRes.json();
  console.log('Summary response:', sumData.data);
  if (!sumData.data || typeof sumData.data.totalActiveKeys !== 'number') {
    throw new Error('Summary response invalid');
  }

  console.log('\n3. Testing GET /api/v1/platform/api-registry/keys...');
  const keysRes = await fetch(`${API_BASE}/platform/api-registry/keys`, {
    headers: authHeaders,
  });
  const keysData = await keysRes.json();
  console.log(`Found ${keysData.data?.length} API keys across tenants.`);
  if (!keysData.data || keysData.data.length === 0) {
    throw new Error('No API keys returned');
  }
  const sampleKey = keysData.data[0];
  console.log('Sample key:', {
    tenantName: sampleKey.tenantName,
    name: sampleKey.name,
    prefix: sampleKey.prefix,
    callVolume: sampleKey.callVolume,
    status: sampleKey.status,
    scopes: sampleKey.scopes,
  });

  console.log('\n4. Testing Key Revocation rejection without reason (HTTP 400)...');
  const rejectRes = await fetch(
    `${API_BASE}/platform/api-registry/keys/${sampleKey.id}/revoke`,
    {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ reason: '   ' }),
    },
  );
  if (rejectRes.status !== 400) {
    throw new Error(`Expected 400 but got ${rejectRes.status}`);
  }
  console.log('Passed: correctly rejected missing reason.');

  console.log('\n5. Testing Key Revocation with valid reason...');
  // Find an active key to revoke
  const activeKey = keysData.data.find((k) => k.status === 'active');
  if (activeKey) {
    const revokeRes = await fetch(
      `${API_BASE}/platform/api-registry/keys/${activeKey.id}/revoke`,
      {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          reason: 'Test immediate revocation from platform control plane',
        }),
      },
    );
    const revokeData = await revokeRes.json();
    console.log('Revocation result:', {
      id: revokeData.data?.id,
      name: revokeData.data?.name,
      status: revokeData.data?.status,
      revokedAt: revokeData.data?.revokedAt,
    });
    if (revokeData.data?.status !== 'revoked') {
      throw new Error('Status was not changed to revoked');
    }
  }

  console.log('\n6. Testing GET /api/v1/platform/api-registry/rate-limits...');
  const rlRes = await fetch(`${API_BASE}/platform/api-registry/rate-limits`, {
    headers: authHeaders,
  });
  const rlData = await rlRes.json();
  console.log(`Found ${rlData.data?.length} tenant rate limits.`);
  const sampleTenant = rlData.data[0];
  console.log('Sample tenant rate limit:', {
    tenantName: sampleTenant.tenantName,
    planTier: sampleTenant.planTier,
    defaultRateLimitPerMin: sampleTenant.defaultRateLimitPerMin,
    effectiveRateLimitPerMin: sampleTenant.effectiveRateLimitPerMin,
    hasOverride: !!sampleTenant.override,
  });

  console.log('\n7. Testing Set Rate-Limit Override on tenant...');
  const overrideRes = await fetch(
    `${API_BASE}/platform/api-registry/rate-limits/${sampleTenant.tenantId}`,
    {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        rateLimitPerMin: 3200,
        burstLimit: 6400,
        reason: 'Temporary Black Friday batch payroll sync',
      }),
    },
  );
  const overrideData = await overrideRes.json();
  console.log('Set override result:', {
    effectiveRateLimitPerMin: overrideData.data?.effectiveRateLimitPerMin,
    effectiveBurstLimit: overrideData.data?.effectiveBurstLimit,
    override: overrideData.data?.override,
  });
  if (overrideData.data?.effectiveRateLimitPerMin !== 3200) {
    throw new Error('Effective rate limit did not update to 3200');
  }

  console.log('\n8. Testing Reverting Override to Plan Baseline...');
  const deleteRes = await fetch(
    `${API_BASE}/platform/api-registry/rate-limits/${sampleTenant.tenantId}`,
    {
      method: 'DELETE',
      headers: authHeaders,
    },
  );
  const deleteData = await deleteRes.json();
  console.log('Reset override result:', {
    effectiveRateLimitPerMin: deleteData.data?.effectiveRateLimitPerMin,
    override: deleteData.data?.override,
  });
  if (deleteData.data?.override !== null) {
    throw new Error('Override was not removed');
  }

  console.log('\nALL VERIFICATION TESTS PASSED SUCCESSFULLY! ✓');
}

run().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
