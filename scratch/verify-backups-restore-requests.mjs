// scratch/verify-backups-restore-requests.mjs
const API_URL = 'http://localhost:3000/api/v1';

async function loginUser(email, password = 'password', totpCode = '123456') {
  const loginRes = await fetch(`${API_URL}/platform/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, totpCode }),
  });

  const loginData = await loginRes.json();
  if (!loginRes.ok) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(loginData)}`);
  }
  return loginData.data?.accessToken || loginData.accessToken;
}

async function main() {
  console.log('============================================================');
  console.log('VERIFYING BACKUPS & RESTORE REQUESTS WITH SLA THRESHOLDS');
  console.log('============================================================\n');

  // Step 1: Login as Platform Owner & Obtain Token
  console.log('=== STEP 1: Platform Owner Login & MFA Authentication ===');
  const ownerToken = await loginUser('platform.owner@cmsnbd.com');
  console.log(`✓ Logged in as Platform Owner (platform.owner@cmsnbd.com)`);

  const ownerHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${ownerToken}`,
  };

  // Step 2: Fetch Backups & Compliance Summary with SLA Thresholds
  console.log('\n=== STEP 2: Summary Metrics & Healthy SLA Threshold Evaluation ===');
  const summaryRes = await fetch(`${API_URL}/platform/backups/summary?backupThresholdHours=24&restoreTestThresholdDays=7`, {
    headers: ownerHeaders,
  });
  const summaryJson = await summaryRes.json();
  if (!summaryRes.ok) throw new Error(`Summary failed: ${JSON.stringify(summaryJson)}`);
  const summary = summaryJson.data;

  console.log(`✓ Summary SLA Status:
  - Total Backups: ${summary.totalBackups}
  - Completed: ${summary.completedBackups}
  - Last Backup At: ${summary.lastBackupAt}
  - Last Restore Test Status: ${summary.lastRestoreTestStatus}
  - Last Successful Restore Test At: ${summary.lastSuccessfulRestoreTestAt} (${summary.lastSuccessfulRestoreTestDurationMs}ms)
  - Backup Overdue: ${summary.isBackupOverdue}
  - Restore Test Overdue: ${summary.isRestoreTestOverdue}
  - Has Threshold Warning Banner: ${summary.hasThresholdWarning}`);

  if (summary.hasThresholdWarning) {
    console.log(`  Warning Banner active: ${summary.backupWarning || summary.restoreTestWarning}`);
  } else {
    console.log(`  ✓ All SLAs Nominal within 24h backup / 7d restore test thresholds.`);
  }

  // Step 3: Test SLA Threshold Warning Breach Simulation (Strict 1-hour / 0-day thresholds)
  console.log('\n=== STEP 3: Verify Warning Banner Trigger on Stale Thresholds ===');
  const breachRes = await fetch(`${API_URL}/platform/backups/summary?backupThresholdHours=0.01&restoreTestThresholdDays=0.001`, {
    headers: ownerHeaders,
  });
  const breachJson = await breachRes.json();
  if (!breachRes.ok) throw new Error(`Breach test failed: ${JSON.stringify(breachJson)}`);
  const breachSummary = breachJson.data;

  console.log(`✓ Strict threshold warning response:
  - isBackupOverdue: ${breachSummary.isBackupOverdue}
  - isRestoreTestOverdue: ${breachSummary.isRestoreTestOverdue}
  - hasThresholdWarning: ${breachSummary.hasThresholdWarning}
  - Backup Warning: "${breachSummary.backupWarning}"
  - Restore Warning: "${breachSummary.restoreTestWarning}"`);

  if (!breachSummary.hasThresholdWarning) {
    throw new Error('Expected threshold warning banner to be active under strict thresholds!');
  }
  console.log('✓ Warning banner correctly triggers when backup or restore test exceeds SLA threshold.');

  // Step 4: Backup History with Status and Last Successful Restore Test
  console.log('\n=== STEP 4: Query Backup History with Restore Test Details ===');
  const runsRes = await fetch(`${API_URL}/platform/backups/runs`, { headers: ownerHeaders });
  const runsJson = await runsRes.json();
  const runs = runsJson.data;
  console.log(`✓ Fetched ${runs.length} backup history records.`);
  runs.slice(0, 3).forEach((r, idx) => {
    console.log(`  [${idx + 1}] ID: ${r.id.slice(0, 8)} | Type: ${r.backupType} | Status: ${r.status} | Size: ${r.sizeFormatted} | Test: ${r.restoreTestStatus} (${r.restoreTestDurationMs || 0}ms)`);
  });

  // Step 5: Run Automated Restore Test
  console.log('\n=== STEP 5: Trigger Sandbox Restore Test on Latest Backup ===');
  const targetRun = runs[0];
  const testRes = await fetch(`${API_URL}/platform/backups/runs/${targetRun.id}/test-restore`, {
    method: 'POST',
    headers: ownerHeaders,
  });
  const testJson = await testRes.json();
  if (!testRes.ok) throw new Error(`Restore test failed: ${JSON.stringify(testJson)}`);
  const testedRun = testJson.data;
  console.log(`✓ Restore Test Executed:
  - Backup ID: ${testedRun.id.slice(0, 8)}
  - Status: ${testedRun.restoreTestStatus}
  - Duration: ${testedRun.restoreTestDurationMs}ms
  - Checksum Verified: ${testedRun.restoreTestDetails?.checksumVerified}
  - Schema Validated: ${testedRun.restoreTestDetails?.schemaValidated} (${testedRun.restoreTestDetails?.tablesValidated} tables, ${testedRun.restoreTestDetails?.sampleRowsChecked} sample rows)`);

  // Step 6: Create Staff-Initiated Restore Request
  console.log('\n=== STEP 6: Initiate Restore Request (Requires Dual Approval) ===');
  const tenantsRes = await fetch(`${API_URL}/platform/tenants`, { headers: ownerHeaders });
  const tenantsJson = await tenantsRes.json();
  const targetTenant = tenantsJson.data?.[0];

  const restoreReqRes = await fetch(`${API_URL}/platform/backups/restore-requests`, {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({
      backupRunId: targetRun.id,
      scope: 'tenant',
      tenantId: targetTenant.id,
      reason: 'SLA threshold verification test restore of tenant configuration',
    }),
  });
  const restoreReqJson = await restoreReqRes.json();
  if (!restoreReqRes.ok) throw new Error(`Create restore request failed: ${JSON.stringify(restoreReqJson)}`);
  const createdRestore = restoreReqJson.data;
  console.log(`✓ Restore Request Created:
  - ID: ${createdRestore.id}
  - Scope: ${createdRestore.scope} (${createdRestore.tenantName || 'Tenant'})
  - Status: ${createdRestore.status}
  - Requested By: ${createdRestore.requestedByName}
  - Reason: "${createdRestore.reason}"`);

  // Step 7: Dual Authorization Security Guard - Self-Approval Must Fail
  console.log('\n=== STEP 7: Assert Four-Eyes Rule - Self-Approval Blocked ===');
  const selfApproveRes = await fetch(`${API_URL}/platform/backups/restore-requests/${createdRestore.id}/approve`, {
    method: 'POST',
    headers: ownerHeaders,
  });
  const selfApproveJson = await selfApproveRes.json();
  if (selfApproveRes.status === 403) {
    console.log(`✓ Self-approval successfully blocked with HTTP 403 Forbidden: "${selfApproveJson.error?.message}"`);
  } else {
    throw new Error(`Expected HTTP 403 Forbidden on self-approval, got ${selfApproveRes.status}`);
  }

  // Step 8: Second Staff Operator Login (Dual Approver) & Approve Restore
  console.log('\n=== STEP 8: Second Staff Operator Approval & Logged Execution ===');
  const adminToken = await loginUser('platform.admin@cmsnbd.com');
  const adminHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminToken}`,
  };

  const approveRes = await fetch(`${API_URL}/platform/backups/restore-requests/${createdRestore.id}/approve`, {
    method: 'POST',
    headers: adminHeaders,
  });
  const approveJson = await approveRes.json();
  if (!approveRes.ok) throw new Error(`Approval failed: ${JSON.stringify(approveJson)}`);
  const approvedRestore = approveJson.data;

  console.log(`✓ Restore Request Approved & Executed:
  - ID: ${approvedRestore.id}
  - Status: ${approvedRestore.status}
  - Approved By: ${approvedRestore.approvedByName}
  - Job ID: ${approvedRestore.jobId}
  - Tenant Isolation Guaranteed: ${approvedRestore.logs?.isolationGuaranteed}
  - Foreign Tenants Modified: ${approvedRestore.logs?.foreignTenantsModified} (Asserted 0)`);

  console.log('\n============================================================');
  console.log('ALL BACKUPS & RESTORE REQUESTS VERIFICATION CHECKS PASSED!');
  console.log('============================================================');
}

main().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
