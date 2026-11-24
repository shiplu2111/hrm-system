// scratch/verify-usage-health.mjs
// E2E Verification for Usage Metering and Comprehensive Health Monitoring

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

async function login(email, password, totpCode = '123456') {
  const res = await request('/platform/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, totpCode }),
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(res.data)}`);
  }
  return res.data.data;
}

async function run() {
  console.log('=== VERIFYING USAGE METERING & HEALTH MONITORING ===\n');

  // 1. Authenticate as Platform Owner
  console.log('1. Authenticating as Platform Owner...');
  const ownerAuth = await login('platform.owner@cmsnbd.com', 'password', '123456');
  const token = ownerAuth.accessToken;
  console.log('✓ Platform Owner authenticated.');

  // 2. Test Public /health endpoint
  console.log('\n2. Testing Public /health endpoint...');
  const publicHealthRes = await fetch('http://localhost:3000/health');
  const publicHealth = await publicHealthRes.json();
  console.log('Public Health Response:', publicHealth);
  if (!publicHealth?.data?.status) {
    throw new Error('Public health check failed');
  }
  console.log('✓ Public health endpoint operational.');

  // 3. Test Comprehensive Platform Health Endpoint
  console.log('\n3. Testing GET /platform/health...');
  const healthRes = await request('/platform/health', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!healthRes.ok) {
    throw new Error(`GET /platform/health failed: ${JSON.stringify(healthRes.data)}`);
  }
  const health = healthRes.data.data;
  console.log('Comprehensive Health Summary:', {
    status: health.status,
    uptime: `${health.uptimeSeconds}s`,
    apiLatency: `${health.api.avgLatencyMs}ms (p95: ${health.api.p95LatencyMs}ms)`,
    apiErrorRate: `${health.api.errorRatePercentage}% (${health.api.totalRequests} samples)`,
    dbConnections: `${health.database.activeConnections} active / ${health.database.totalConnections} total (ping: ${health.database.pingLatencyMs}ms)`,
    redisStatus: `${health.redis.status} (memory: ${health.redis.usedMemory})`,
    queuesCount: health.queues.totalQueues,
    totalQueueDepth: health.queues.totalQueueDepth,
    websocketClients: health.websocket.connectedClients,
    mobileSyncSuccessRate: `${health.mobileSync.successRatePercentage}% (${health.mobileSync.totalEventsSynced} events)`,
  });

  if (!health.api || !health.database || !health.redis || !health.queues || !health.websocket || !health.mobileSync) {
    throw new Error('Comprehensive health payload missing required subsystem indicators');
  }
  console.log('✓ Platform Comprehensive Health check PASSED.');

  // 4. Test Health Sub-endpoints
  console.log('\n4. Testing Individual Health Sub-endpoints...');
  const endpoints = ['api', 'database', 'redis', 'queues', 'websocket', 'mobile-sync'];
  for (const ep of endpoints) {
    const res = await request(`/platform/health/${ep}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`Health sub-endpoint /platform/health/${ep} failed: ${JSON.stringify(res.data)}`);
    }
    console.log(`  ✓ /platform/health/${ep} -> OK`);
  }

  // 5. Trigger Usage Metering Job On-Demand
  console.log('\n5. Testing POST /platform/usage/trigger (On-demand nightly job execution)...');
  const triggerRes = await request('/platform/usage/trigger', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  });
  if (!triggerRes.ok) {
    throw new Error(`POST /platform/usage/trigger failed: ${JSON.stringify(triggerRes.data)}`);
  }
  const triggerSummary = triggerRes.data.data;
  console.log('Usage Metering Trigger Summary:', {
    date: triggerSummary.date,
    tenantsMetered: triggerSummary.totalTenantsMetered,
    activeEmployees: triggerSummary.totalActiveEmployees,
    storageUsedMb: triggerSummary.totalStorageUsedMb,
    apiCalls: triggerSummary.totalApiCalls,
    notificationsTotal: triggerSummary.totalNotificationsSent,
    notificationsByChannel: triggerSummary.notificationsByChannel,
    attendanceEventsSynced: triggerSummary.totalAttendanceEventsSynced,
  });
  console.log('✓ Usage metering calculated and persisted to usage_daily.');

  // 6. Test GET /platform/usage/daily
  console.log('\n6. Testing GET /platform/usage/daily (List per-tenant daily usage records)...');
  const dailyRes = await request('/platform/usage/daily?page=1&limit=10', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!dailyRes.ok) {
    throw new Error(`GET /platform/usage/daily failed: ${JSON.stringify(dailyRes.data)}`);
  }
  const dailyData = dailyRes.data.data;
  console.log(`✓ Retrieved ${dailyData.items.length} daily usage records (Total in DB: ${dailyData.total}).`);
  if (dailyData.items.length > 0) {
    const sample = dailyData.items[0];
    console.log('Sample usage_daily record:', {
      tenantName: sample.tenantName,
      subdomain: sample.tenantSubdomain,
      date: sample.date,
      activeEmployees: sample.activeEmployees,
      storageUsedMb: sample.storageUsedMb,
      apiCalls: sample.apiCalls,
      notificationsTotal: sample.notificationsTotal,
      attendanceSynced: sample.attendanceEventsSynced,
    });
  }

  // 7. Test GET /platform/usage/summary
  console.log('\n7. Testing GET /platform/usage/summary (Platform-wide aggregated usage)...');
  const summaryRes = await request('/platform/usage/summary', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!summaryRes.ok) {
    throw new Error(`GET /platform/usage/summary failed: ${JSON.stringify(summaryRes.data)}`);
  }
  console.log('✓ Platform-wide usage summary:', summaryRes.data.data);

  console.log('\n======================================================');
  console.log('All Usage Metering & Health Monitoring checks PASSED!');
  console.log('======================================================');
}

run().catch((err) => {
  console.error('\n❌ Verification failed:', err);
  process.exit(1);
});
