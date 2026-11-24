// scratch/verify-usage-storage.mjs
// Verification and seed script for Platform Usage & Storage against Plan Limits

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:3000/api/v1';

async function main() {
  console.log('=== PLATFORM USAGE & STORAGE VERIFICATION ===');

  // Step 1: Login as Platform Owner
  console.log('1. Authenticating as Platform Owner...');
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
  if (!loginData.data?.accessToken) {
    throw new Error(`Platform login failed: ${JSON.stringify(loginData)}`);
  }
  const token = loginData.data.accessToken;
  console.log('   Authenticated as:', loginData.data.user.email);

  // Step 2: Seed realistic 30-day historical timeseries and near-limit tenants
  console.log('2. Seeding 30-day historical usage data in usage_daily...');
  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true, subdomain: true, planId: true },
  });

  const now = new Date();
  let seededCount = 0;

  for (const tenant of tenants) {
    const sub = tenant.subdomain;
    let baseEmployees = 25;
    let baseStorageGb = 2.0;
    let baseApiCalls = 800;

    if (sub === 'vertex') {
      // Starter plan (limit: 50 emp, 10 GB) -> Near limit (44 emp = 88%, 8.6 GB = 86%)
      baseEmployees = 44;
      baseStorageGb = 8.6;
      baseApiCalls = 4200;
    } else if (sub === 'northstar') {
      // Business plan (limit: 250 emp, 50 GB) -> Near limit (215 emp = 86%, 42.5 GB = 85%)
      baseEmployees = 215;
      baseStorageGb = 42.5;
      baseApiCalls = 21500;
    } else if (sub === 'techflow') {
      // Business plan (limit: 250 emp, 50 GB) -> Over limit (260 emp = 104%)
      baseEmployees = 260;
      baseStorageGb = 35.0;
      baseApiCalls = 18000;
    } else if (sub === 'acme' || sub === 'globex') {
      // Enterprise plan (Unlimited)
      baseEmployees = 1200;
      baseStorageGb = 280.0;
      baseApiCalls = 95000;
    } else if (sub === 'demo') {
      baseEmployees = 15;
      baseStorageGb = 1.2;
      baseApiCalls = 550;
    }

    // Seed past 30 days
    for (let dayOffset = 30; dayOffset >= 0; dayOffset--) {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - dayOffset);
      d.setUTCHours(0, 0, 0, 0);

      // Subtle growth variance over 30 days
      const progress = (30 - dayOffset) / 30;
      const dayFactor = 0.85 + progress * 0.15;
      const emp = Math.round(baseEmployees * dayFactor);
      const storageBytes = BigInt(Math.round(baseStorageGb * dayFactor * 1024 * 1024 * 1024));
      const calls = Math.round(baseApiCalls * dayFactor + (dayOffset % 5) * 50);

      await prisma.usageDaily.upsert({
        where: {
          tenantId_date: {
            tenantId: tenant.id,
            date: d,
          },
        },
        create: {
          tenantId: tenant.id,
          date: d,
          activeEmployees: emp,
          storageUsedBytes: storageBytes,
          apiCalls: calls,
          notificationsTotal: Math.round(emp * 0.5),
          notificationsEmail: Math.round(emp * 0.3),
          notificationsSms: 0,
          notificationsPush: Math.round(emp * 0.2),
          notificationsInApp: Math.round(emp * 0.4),
          attendanceEventsSynced: Math.round(emp * 1.8),
          metadata: {
            tenantName: tenant.name,
            subdomain: tenant.subdomain,
            seeded: true,
          },
        },
        update: {
          activeEmployees: emp,
          storageUsedBytes: storageBytes,
          apiCalls: calls,
        },
      });
      seededCount++;
    }
  }
  console.log(`   Seeded ${seededCount} daily usage records across ${tenants.length} tenants.`);

  // Step 3: Test GET /api/v1/platform/usage/overview
  console.log('3. Testing GET /api/v1/platform/usage/overview...');
  const overviewRes = await fetch(`${API_BASE}/platform/usage/overview`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!overviewRes.ok) throw new Error(`Overview endpoint failed: ${overviewRes.statusText}`);
  const overviewJson = await overviewRes.json();
  const overviewData = overviewJson.data;

  console.log('   Total tenants returned:', overviewData.total);
  console.log('   Summary:');
  console.log('     Normal Tenants:', overviewData.summary.normalCount);
  console.log('     Near Limit Tenants (≥80%):', overviewData.summary.nearLimitCount);
  console.log('     Over Limit Tenants (≥100%):', overviewData.summary.overLimitCount);
  console.log('     Total Employees:', overviewData.summary.totalEmployees);
  console.log('     Total Storage (GB):', overviewData.summary.totalStorageGb);
  console.log('     Total Daily API Calls:', overviewData.summary.totalApiCalls);

  if (overviewData.summary.nearLimitCount === 0) {
    throw new Error('Expected near limit tenants count > 0');
  }

  // Step 4: Test GET /api/v1/platform/usage/overview?status=near_limit
  console.log('4. Testing GET /api/v1/platform/usage/overview?status=near_limit...');
  const nearLimitRes = await fetch(`${API_BASE}/platform/usage/overview?status=near_limit`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const nearLimitJson = await nearLimitRes.json();
  console.log('   Near limit tenants filtered count:', nearLimitJson.data.items.length);
  for (const item of nearLimitJson.data.items) {
    console.log(
      `   - ${item.tenantName} (${item.planName}): maxUsage ${item.maxUsagePercent}%, status: ${item.overallStatus}, bottlenecks: ${item.nearLimitResources.join(', ')}`
    );
    if (item.maxUsagePercent < 80) {
      throw new Error(`Tenant ${item.tenantName} has usage ${item.maxUsagePercent}% which is < 80%`);
    }
  }

  // Step 5: Test GET /api/v1/platform/usage/trends
  console.log('5. Testing GET /api/v1/platform/usage/trends (Platform Aggregate)...');
  const trendsRes = await fetch(`${API_BASE}/platform/usage/trends?days=30`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const trendsJson = await trendsRes.json();
  console.log('   Aggregate trend points returned:', trendsJson.data.trends.length);
  if (trendsJson.data.trends.length === 0) {
    throw new Error('Expected trend points > 0');
  }

  // Step 6: Test GET /api/v1/platform/usage/trends with specific tenant
  const sampleTenant = nearLimitJson.data.items[0];
  console.log(`6. Testing GET /api/v1/platform/usage/trends for tenant ${sampleTenant.tenantName}...`);
  const tenantTrendRes = await fetch(
    `${API_BASE}/platform/usage/trends?tenantId=${sampleTenant.tenantId}&days=30`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const tenantTrendJson = await tenantTrendRes.json();
  const trendItem = tenantTrendJson.data.trends[tenantTrendJson.data.trends.length - 1];
  console.log(
    `   Tenant: ${tenantTrendJson.data.tenantName}, Plan: ${tenantTrendJson.data.planName}, latest emp: ${trendItem.activeEmployees}, limit: ${trendItem.employeeLimit}, 80% threshold: ${trendItem.employee80Threshold}`
  );

  // Step 7: Test GET /api/v1/platform/usage/export
  console.log('7. Testing GET /api/v1/platform/usage/export (CSV & JSON)...');
  const exportCsvRes = await fetch(`${API_BASE}/platform/usage/export?format=csv`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const exportCsvJson = await exportCsvRes.json();
  console.log('   CSV Filename:', exportCsvJson.data.filename);
  console.log('   CSV Row sample:\n   ', exportCsvJson.data.csv.split('\n').slice(0, 3).join('\n    '));

  const exportJsonRes = await fetch(`${API_BASE}/platform/usage/export?format=json`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const exportJson = await exportJsonRes.json();
  console.log('   JSON Filename:', exportJson.data.filename);
  console.log('   JSON Item count:', exportJson.data.json.length);

  await prisma.$disconnect();
  console.log('=== ALL USAGE & STORAGE VERIFICATION CHECKS PASSED ===');
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
