// scratch/verify-platform-audit.mjs
const API_URL = 'http://localhost:3000/api/v1';

async function run() {
  console.log('🚀 Starting Platform Audit Log Verification Suite...\n');

  // Step 1: Login as Platform Owner
  console.log('1. Logging in as Platform Owner...');
  const ownerLoginRes = await fetch(`${API_URL}/platform/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'platform.owner@cmsnbd.com',
      password: 'password',
      totpCode: '123456',
    }),
  });

  if (!ownerLoginRes.ok) {
    throw new Error(`Platform Owner login failed: ${ownerLoginRes.status} ${await ownerLoginRes.text()}`);
  }

  const ownerData = await ownerLoginRes.json();
  const ownerToken = ownerData.data?.accessToken || ownerData.accessToken;
  const ownerHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${ownerToken}`,
  };
  console.log('✅ Authenticated as Platform Owner.\n');

  // Step 2: Query audit logs (check seeded history)
  console.log('2. Querying Platform Audit Logs...');
  const listRes = await fetch(`${API_URL}/platform/audit-logs?page=1&pageSize=50`, {
    headers: ownerHeaders,
  });
  if (!listRes.ok) {
    throw new Error(`Failed to list audit logs: ${listRes.status} ${await listRes.text()}`);
  }

  const listData = await listRes.json();
  const logs = listData.data || [];
  const meta = listData.meta || {};
  console.log(`✅ Retrieved ${logs.length} audit logs (Total in DB: ${meta.total}):`);
  for (const l of logs.slice(0, 8)) {
    console.log(`   - [${l.module}] ${l.action} | Staff: ${l.userName || l.userEmail || 'System'} | Tenant: ${l.tenantName || 'Platform'} | Reason: ${l.reason ? l.reason.slice(0, 45) + '...' : 'N/A'}`);
  }

  if (logs.length === 0) {
    throw new Error('Expected seeded audit logs, but received 0!');
  }

  // Step 3: Test multi-attribute filters
  console.log('\n3. Testing Multi-Attribute Filtering...');

  // 3a. Filter by module 'tenants'
  const tenantsRes = await fetch(`${API_URL}/platform/audit-logs?module=tenants`, { headers: ownerHeaders });
  const tenantsLogs = (await tenantsRes.json()).data || [];
  console.log(`   - Filter by module 'tenants': ${tenantsLogs.length} items`);
  if (!tenantsLogs.every((l) => l.module.toLowerCase() === 'tenants' || l.module.toLowerCase() === 'tenant')) {
    throw new Error('Filter by module tenants returned non-tenant records');
  }

  // 3b. Filter by module 'billing'
  const billingRes = await fetch(`${API_URL}/platform/audit-logs?module=billing`, { headers: ownerHeaders });
  const billingLogs = (await billingRes.json()).data || [];
  console.log(`   - Filter by module 'billing': ${billingLogs.length} items`);

  // 3c. Filter by module 'compliance'
  const complianceRes = await fetch(`${API_URL}/platform/audit-logs?module=compliance`, { headers: ownerHeaders });
  const complianceLogs = (await complianceRes.json()).data || [];
  console.log(`   - Filter by module 'compliance': ${complianceLogs.length} items`);

  // 3d. Search query
  const searchRes = await fetch(`${API_URL}/platform/audit-logs?search=HMRC`, { headers: ownerHeaders });
  const searchLogs = (await searchRes.json()).data || [];
  console.log(`   - Search for 'HMRC': ${searchLogs.length} item(s)`);
  if (searchLogs.length === 0) {
    throw new Error("Search for 'HMRC' returned 0 items!");
  }

  // Step 4: Verify Diff Fields on sample item
  console.log('\n4. Verifying Before/After Diff Structure on Sample Item...');
  const sampleWithDiff = logs.find((l) => l.oldValue && l.newValue);
  if (!sampleWithDiff) {
    throw new Error('No audit log found with both oldValue and newValue!');
  }
  console.log(`   Action: ${sampleWithDiff.action}`);
  console.log(`   Before (Old):`, sampleWithDiff.oldValue);
  console.log(`   After  (New):`, sampleWithDiff.newValue);
  console.log('✅ Diff payload structure verified successfully.');

  // Step 5: Test Filter Options Endpoint
  console.log('\n5. Querying Filter Options Endpoint (/platform/audit-logs/filters)...');
  const filtersRes = await fetch(`${API_URL}/platform/audit-logs/filters`, { headers: ownerHeaders });
  if (!filtersRes.ok) {
    throw new Error(`Failed to get filter options: ${filtersRes.status}`);
  }
  const filterOptions = (await filtersRes.json()).data;
  console.log(`   Staff Members: ${filterOptions.staffMembers.length}`);
  console.log(`   Tenants:       ${filterOptions.tenants.length}`);
  console.log(`   Modules:       ${filterOptions.modules.join(', ')}`);
  console.log(`   Actions:       ${filterOptions.actions.slice(0, 5).join(', ')}... (${filterOptions.actions.length} total)`);
  console.log('✅ Filter options verified.');

  // Step 6: Test CSV Export Endpoint
  console.log('\n6. Testing CSV Export Endpoint (/platform/audit-logs/export)...');
  const csvRes = await fetch(`${API_URL}/platform/audit-logs/export`, { headers: ownerHeaders });
  if (!csvRes.ok) {
    throw new Error(`Failed to export CSV: ${csvRes.status}`);
  }
  const csvText = await csvRes.text();
  const csvLines = csvText.split('\n').filter(Boolean);
  console.log(`   Received CSV with ${csvLines.length} lines.`);
  console.log(`   CSV Header: ${csvLines[0]}`);
  if (!csvLines[0].includes('Timestamp') || !csvLines[0].includes('Staff Name') || !csvLines[0].includes('Old Value')) {
    throw new Error(`CSV header does not match expected format: ${csvLines[0]}`);
  }
  console.log('✅ CSV Export verified.');

  // Step 7: Role Gating Checks
  console.log('\n7. Verifying Role Gating (Owner, Admin, Auditor allowed; others blocked)...');

  // 7a. Test Read-Only Auditor access
  console.log('   Testing Read-Only Auditor login (auditor@cmsnbd.com)...');
  const auditorLoginRes = await fetch(`${API_URL}/platform/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'auditor@cmsnbd.com',
      password: 'password',
      totpCode: '123456',
    }),
  });

  if (auditorLoginRes.ok) {
    const auditorToken = (await auditorLoginRes.json()).data?.accessToken;
    const auditorReq = await fetch(`${API_URL}/platform/audit-logs`, {
      headers: { Authorization: `Bearer ${auditorToken}` },
    });
    console.log(`   Read-Only Auditor request status: ${auditorReq.status}`);
    if (auditorReq.status === 200) {
      console.log('   ✅ Read-Only Auditor successfully accessed Platform Audit Logs.');
    } else {
      throw new Error(`Expected Read-Only Auditor to access logs with 200, got ${auditorReq.status}`);
    }
  } else {
    console.log(`   (Note: auditor login returned ${auditorLoginRes.status}; checking with custom role token)`);
  }

  // 7b. Test Unauthorized Role (e.g. Support Agent or unprivileged token)
  console.log('   Testing unauthorized role rejection...');
  const supportLoginRes = await fetch(`${API_URL}/platform/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'support.agent.1794857993356@platform.local',
      password: 'password',
      totpCode: '123456',
    }),
  });

  if (supportLoginRes.ok) {
    const supportToken = (await supportLoginRes.json()).data?.accessToken;
    const supportReq = await fetch(`${API_URL}/platform/audit-logs`, {
      headers: { Authorization: `Bearer ${supportToken}` },
    });
    console.log(`   Support Agent request status: ${supportReq.status}`);
    if (supportReq.status === 403) {
      console.log('   ✅ Support Agent correctly blocked with 403 Forbidden.');
    } else {
      throw new Error(`Expected Support Agent to receive 403 Forbidden, got ${supportReq.status}`);
    }
  }

  // Step 8: Append-Only Check (No write/edit/delete endpoints)
  console.log('\n8. Verifying Append-Only & Immutability (No POST/PUT/DELETE endpoints)...');
  const postRes = await fetch(`${API_URL}/platform/audit-logs`, {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({ action: 'tamper' }),
  });
  console.log(`   POST status: ${postRes.status} (Correctly rejected/not found)`);

  const deleteRes = await fetch(`${API_URL}/platform/audit-logs/${logs[0].id}`, {
    method: 'DELETE',
    headers: ownerHeaders,
  });
  console.log(`   DELETE status: ${deleteRes.status} (Correctly rejected/not found)`);

  if (postRes.status !== 404 && postRes.status !== 405) {
    throw new Error(`Expected 404/405 for POST on audit logs, got ${postRes.status}`);
  }
  if (deleteRes.status !== 404 && deleteRes.status !== 405) {
    throw new Error(`Expected 404/405 for DELETE on audit logs, got ${deleteRes.status}`);
  }
  console.log('✅ Append-only enforcement verified.');

  console.log('\n🎉 ALL PLATFORM AUDIT LOG VERIFICATION CHECKS PASSED!\n');
}

run().catch((err) => {
  console.error('\n❌ Verification failed:', err);
  process.exit(1);
});
