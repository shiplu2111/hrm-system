// scratch/verify-webhook-monitor.mjs
const API_URL = 'http://localhost:3000/api/v1';

async function loginAsPlatformOwner() {
  console.log('1. Logging in as Platform Owner...');
  const loginRes = await fetch(`${API_URL}/platform/auth/login`, {
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
  console.log('✅ Successfully authenticated as Platform Owner.\n');
  return token;
}

async function run() {
  const token = await loginAsPlatformOwner();
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 1. Summary
  console.log('2. Testing GET /api/v1/platform/webhook-monitor/summary...');
  const sumRes = await fetch(`${API_URL}/platform/webhook-monitor/summary`, {
    headers: authHeaders,
  });
  if (!sumRes.ok) {
    throw new Error(`Summary failed: ${sumRes.status} ${await sumRes.text()}`);
  }
  const sumData = await sumRes.json();
  console.log('Summary metrics:', sumData.data);
  if (typeof sumData.data?.totalDeliveries24h !== 'number') {
    throw new Error('Summary response invalid');
  }

  // 2. Deliveries Log
  console.log('\n3. Testing GET /api/v1/platform/webhook-monitor/deliveries...');
  const delRes = await fetch(
    `${API_URL}/platform/webhook-monitor/deliveries?limit=20`,
    {
      headers: authHeaders,
    },
  );
  if (!delRes.ok) {
    throw new Error(`Deliveries failed: ${delRes.status} ${await delRes.text()}`);
  }
  const delData = await delRes.json();
  const deliveries = delData.data || [];
  console.log(`Found ${deliveries.length} deliveries across tenants:`);
  for (const d of deliveries.slice(0, 5)) {
    console.log(
      `   - [${d.deliveryState.toUpperCase()}] Tenant: ${d.tenantName} | Event: ${d.eventType} | Status Code: ${d.httpStatus || 'N/A'} | Attempts: ${d.attempts}/${d.maxAttempts} | Next Retry: ${d.nextAttemptAt || 'None'}`,
    );
  }

  if (deliveries.length === 0) {
    throw new Error('Expected seeded deliveries, got 0!');
  }

  // 3. Filter test
  console.log('\n4. Testing deliveries filter (failed status & search)...');
  const failedRes = await fetch(
    `${API_URL}/platform/webhook-monitor/deliveries?status=failed`,
    {
      headers: authHeaders,
    },
  );
  const failedData = await failedRes.json();
  console.log(`Found ${failedData.data?.length} failed deliveries.`);
  if (!failedData.data?.every((d) => d.status === 'failed')) {
    throw new Error('Filter by failed status returned non-failed items');
  }

  // 4. Delivery Detail
  const sampleDelivery = deliveries[0];
  console.log(`\n5. Testing GET delivery detail for ID ${sampleDelivery.id}...`);
  const detailRes = await fetch(
    `${API_URL}/platform/webhook-monitor/deliveries/${sampleDelivery.id}`,
    {
      headers: authHeaders,
    },
  );
  const detailData = await detailRes.json();
  console.log('Delivery payload keys:', Object.keys(detailData.data?.payload || {}));

  // 5. Manual Redeliver Action
  const failedDelivery = deliveries.find((d) => d.status === 'failed');
  if (failedDelivery) {
    console.log(`\n6. Testing manual redeliver on failed delivery ${failedDelivery.id}...`);
    const redeliverRes = await fetch(
      `${API_URL}/platform/webhook-monitor/deliveries/${failedDelivery.id}/redeliver`,
      {
        method: 'POST',
        headers: authHeaders,
      },
    );
    if (!redeliverRes.ok) {
      throw new Error(`Redeliver failed: ${redeliverRes.status} ${await redeliverRes.text()}`);
    }
    const redeliverData = await redeliverRes.json();
    console.log('Redeliver result:', {
      message: redeliverData.data?.message,
      newStatus: redeliverData.data?.delivery?.status,
      attempts: redeliverData.data?.delivery?.attempts,
    });
    if (redeliverData.data?.delivery?.status !== 'queued') {
      throw new Error('Delivery status was not reset to queued');
    }
  }

  // 6. Endpoints Health
  console.log('\n7. Testing GET /api/v1/platform/webhook-monitor/endpoints...');
  const epRes = await fetch(`${API_URL}/platform/webhook-monitor/endpoints`, {
    headers: authHeaders,
  });
  const epData = await epRes.json();
  const endpoints = epData.data || [];
  console.log(`Found ${endpoints.length} webhook endpoints across tenants:`);
  for (const ep of endpoints) {
    console.log(
      `   - ${ep.name} (${ep.tenantName}) | Status: ${ep.status} | 7d OK: ${ep.delivered7d} / Fail: ${ep.failed7d} | Failing Days: ${ep.consecutiveFailingDays}d`,
    );
  }

  // 7. Auto-Disable Dry Run
  console.log('\n8. Testing Auto-Disable Simulation (dryRun: true, failingDays: 3)...');
  const dryRunRes = await fetch(`${API_URL}/platform/webhook-monitor/auto-disable`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ failingDays: 3, dryRun: true }),
  });
  const dryRunData = await dryRunRes.json();
  console.log('Dry run result:', {
    thresholdDays: dryRunData.data?.thresholdDays,
    endpointsEvaluated: dryRunData.data?.endpointsEvaluated,
    candidateCount: dryRunData.data?.disabledEndpoints?.length,
    disabledCount: dryRunData.data?.disabledCount,
    dryRun: dryRunData.data?.dryRun,
  });
  if (dryRunData.data?.disabledCount !== 0) {
    throw new Error('Dry run should have disabledCount = 0');
  }

  // 8. Auto-Disable Execution
  console.log('\n9. Testing Auto-Disable Execution (dryRun: false, failingDays: 3)...');
  const autoDisableRes = await fetch(
    `${API_URL}/platform/webhook-monitor/auto-disable`,
    {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ failingDays: 3, dryRun: false }),
    },
  );
  const autoDisableData = await autoDisableRes.json();
  console.log('Auto-disable result:', {
    disabledCount: autoDisableData.data?.disabledCount,
    notificationsSent: autoDisableData.data?.notificationsSent,
    disabledEndpoints: autoDisableData.data?.disabledEndpoints,
  });
  if (autoDisableData.data?.disabledCount < 1) {
    throw new Error('Expected at least 1 failing endpoint to be auto-disabled');
  }

  // 9. Verify Audit Logs for Webhooks
  console.log('\n10. Verifying Platform Audit Logs for module webhooks...');
  const auditRes = await fetch(
    `${API_URL}/platform/audit-logs?module=webhooks`,
    {
      headers: authHeaders,
    },
  );
  const auditData = await auditRes.json();
  console.log(`Found ${auditData.data?.length} audit log entries for webhooks:`);
  for (const log of auditData.data || []) {
    console.log(`   - [${log.action}] Record: ${log.recordId} | Reason: ${log.reason}`);
  }

  console.log('\nALL WEBHOOK MONITOR VERIFICATION TESTS PASSED SUCCESSFULLY! ✓');
}

run().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
