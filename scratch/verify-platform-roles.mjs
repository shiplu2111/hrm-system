// scratch/verify-platform-roles.mjs
import assert from 'node:assert';

const API_BASE = 'http://localhost:3000/api/v1';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
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

async function run() {
  console.log('=== PLATFORM ROLES & PERMISSIONS VERIFICATION ===\n');

  console.log('1. Authenticating as Platform Owner...');
  const ownerLoginRes = await request('/platform/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'platform.owner@cmsnbd.com',
      password: 'password',
      totpCode: '123456',
    }),
  });
  assert.strictEqual(ownerLoginRes.status, 200, 'Owner login must return 200');
  const ownerToken = ownerLoginRes.data.data.accessToken;
  const ownerHeaders = { Authorization: `Bearer ${ownerToken}` };
  console.log('✓ Platform Owner authenticated.');

  console.log('\n2. Authenticating as Platform Admin...');
  const adminLoginRes = await request('/platform/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'platform.admin@cmsnbd.com',
      password: 'password',
      totpCode: '123456',
    }),
  });
  assert.strictEqual(adminLoginRes.status, 200, 'Admin login must return 200');
  const adminToken = adminLoginRes.data.data.accessToken;
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };
  console.log('✓ Platform Admin authenticated.');

  console.log('\n3. Fetching Platform Role Definitions (ROLES_PERMISSIONS.md section 3 pattern)...');
  const defsRes = await request('/platform/staff/roles/definitions', { headers: ownerHeaders });
  assert.strictEqual(defsRes.status, 200, 'Definitions must return 200');
  const defs = defsRes.data.data;
  console.log(`✓ Fetched ${defs.length} module permission definitions:`);
  for (const d of defs) {
    console.log(`   - [${d.key}] "${d.label}": actions = [${d.actions.join(', ')}]`);
  }

  // Ensure key modules from prompt are present: Tenants, Billing, Compliance, Support Access, Settings, Audit
  const requiredModules = ['tenant', 'billing', 'compliance', 'support', 'setting', 'audit'];
  for (const reqMod of requiredModules) {
    assert(defs.some((d) => d.key === reqMod), `Required module '${reqMod}' must be present in definitions`);
  }
  console.log('✓ All required modules (Tenants, Billing, Compliance, Support Access, Settings, Audit) present.');

  console.log('\n4. Checking Active Owner Status & Warning...');
  const ownerStatusRes = await request('/platform/staff/roles/active-owner-check', { headers: ownerHeaders });
  assert.strictEqual(ownerStatusRes.status, 200, 'Active owner status must return 200');
  const ownerStatus = ownerStatusRes.data.data;
  console.log(`   Active Owner Count: ${ownerStatus.activeOwnerCount}`);
  console.log(`   Is At Risk: ${ownerStatus.isAtRisk}`);
  console.log(`   Warning: "${ownerStatus.warning}"`);
  assert(typeof ownerStatus.activeOwnerCount === 'number', 'activeOwnerCount must be a number');
  assert(typeof ownerStatus.isAtRisk === 'boolean', 'isAtRisk must be a boolean');

  console.log('\n5. Listing Platform Roles with User Counts and Permissions...');
  const rolesRes = await request('/platform/staff/roles', { headers: ownerHeaders });
  assert.strictEqual(rolesRes.status, 200, 'List roles must return 200');
  const roles = rolesRes.data.data;
  console.log(`✓ Retrieved ${roles.length} roles:`);
  for (const r of roles) {
    console.log(`   - ${r.name} (${r.isSystem ? 'SYSTEM' : 'CUSTOM'}): ${r.permissions.length} grants, ${r.userCount} users`);
  }

  console.log('\n6. Testing Custom Role Creation (Platform Owner)...');
  const customRoleName = `SecOps Auditor ${Date.now().toString().slice(-4)}`;
  const createRes = await request('/platform/staff/roles', {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({
      name: customRoleName,
      description: 'Audits compliance, tenant status, and system logs',
      permissions: [
        { module: 'audit', action: 'view' },
        { module: 'compliance', action: 'view' },
        { module: 'tenant', action: 'view' },
      ],
    }),
  });
  assert.strictEqual(createRes.status, 201, 'Role creation must return 201');
  const createdRole = createRes.data.data;
  console.log(`✓ Created custom role: "${createdRole.name}" (ID: ${createdRole.id}) with ${createdRole.permissions.length} grants.`);

  console.log('\n7. Testing Non-Owner Privilege Escalation Prevention...');
  const escalateAttempt = await request('/platform/staff/roles', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: `Rogue Escalation ${Date.now().toString().slice(-4)}`,
      description: 'Non-owner trying to grant platform:manage',
      permissions: [
        { module: 'platform', action: 'manage' },
      ],
    }),
  });
  assert.strictEqual(escalateAttempt.status, 403, 'Granting platform:manage by non-owner must return 403');
  console.log(`✓ Privilege escalation rejected with 403: "${escalateAttempt.data.error.message}"`);

  console.log('\n8. Testing Role Update with Matrix Changes...');
  const updateRes = await request(`/platform/staff/roles/${createdRole.id}`, {
    method: 'PATCH',
    headers: ownerHeaders,
    body: JSON.stringify({
      description: 'Updated: Audits compliance, tenants, and views platform settings',
      permissions: [
        { module: 'audit', action: 'view' },
        { module: 'compliance', action: 'view' },
        { module: 'tenant', action: 'view' },
        { module: 'setting', action: 'view' },
      ],
    }),
  });
  assert.strictEqual(updateRes.status, 200, 'Role update must return 200');
  const updatedRole = updateRes.data.data;
  assert.strictEqual(updatedRole.permissions.length, 4, 'Updated permissions count must be 4');
  console.log(`✓ Custom role updated: new permission count is ${updatedRole.permissions.length}.`);

  console.log('\n9. Testing Last Active Owner Protection (Stripping Owner Permissions)...');
  const ownerRole = roles.find((r) => r.name === 'Platform Owner');
  assert(ownerRole, 'Platform Owner role must exist');

  const illegalStripRes = await request(`/platform/staff/roles/${ownerRole.id}`, {
    method: 'PATCH',
    headers: ownerHeaders,
    body: JSON.stringify({
      permissions: [
        // Omission of platform:manage and user:manage
        { module: 'tenant', action: 'view' },
      ],
    }),
  });
  assert.strictEqual(illegalStripRes.status, 400, 'Stripping owner permissions must return 400');
  console.log(`✓ Stripping owner root permissions rejected with 400: "${illegalStripRes.data.error.message}"`);

  console.log('\n10. Testing System Role Deletion Protection...');
  const deleteSystemRoleRes = await request(`/platform/staff/roles/${ownerRole.id}`, {
    method: 'DELETE',
    headers: ownerHeaders,
  });
  assert.strictEqual(deleteSystemRoleRes.status, 400, 'Deleting system role must return 400');
  console.log(`✓ System role deletion blocked with 400: "${deleteSystemRoleRes.data.error.message}"`);

  console.log('\n11. Testing Custom Role Deletion...');
  const deleteCustomRes = await request(`/platform/staff/roles/${createdRole.id}`, {
    method: 'DELETE',
    headers: ownerHeaders,
  });
  assert.strictEqual(deleteCustomRes.status, 200, 'Deleting custom role must return 200');
  console.log(`✓ Custom role deleted successfully: ${JSON.stringify(deleteCustomRes.data.data)}`);

  console.log('\n=== ALL PLATFORM ROLES & PERMISSION MATRIX VERIFICATIONS PASSED ===\n');
}

run().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
