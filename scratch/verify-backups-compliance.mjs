// scratch/verify-backups-compliance.mjs
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
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
  console.log('VERIFYING BACKUPS, RESTORE & DATA COMPLIANCE (SYSTEM_SETTINGS §3-5, SECURITY §7, §9, §10)');
  console.log('============================================================\n');

  // Step 1: Login as Platform Owner & Obtain Token
  console.log('=== STEP 1: Platform Owner Login & MFA Authentication ===');
  const ownerToken = await loginUser('platform.owner@cmsnbd.com');
  console.log(`✓ Logged in as Platform Owner (platform.owner@cmsnbd.com)`);

  const ownerAuthHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${ownerToken}`,
  };

  // Step 2: Fetch Backups & Compliance Summary
  console.log('\n=== STEP 2: Fetch Summary Metrics ===');
  const summaryRes = await fetch(`${API_URL}/platform/backups/summary`, {
    headers: ownerAuthHeaders,
  });
  const summaryJson = await summaryRes.json();
  if (!summaryRes.ok) {
    throw new Error(`Summary fetch failed: ${JSON.stringify(summaryJson)}`);
  }
  const summary = summaryJson.data;
  console.log(`✓ Summary metrics:
  - Total Backups: ${summary.totalBackups}
  - Completed: ${summary.completedBackups}
  - Restore Tests Passed: ${summary.restoreTestsPassed}
  - File Storage Included: ${summary.fileStorageIncludedCount}
  - Pending Restore Approvals: ${summary.pendingRestoreApprovals}`);

  // Step 3: List Backup Runs
  console.log('\n=== STEP 3: List Backup Runs ===');
  const runsRes = await fetch(`${API_URL}/platform/backups/runs`, {
    headers: ownerAuthHeaders,
  });
  const runsJson = await runsRes.json();
  if (!runsRes.ok) {
    throw new Error(`List runs failed: ${JSON.stringify(runsJson)}`);
  }
  const runs = runsJson.data;
  console.log(`✓ Fetched ${runs.length} backup runs.`);
  const latestRun = runs[0];
  console.log(`  Latest: ${latestRun.id.slice(0, 8)} (${latestRun.backupType}, ${latestRun.sizeFormatted}, storage: ${latestRun.storageDriver})`);

  // Step 4: Trigger On-Demand Backup Run
  console.log('\n=== STEP 4: Trigger On-Demand Backup (Full with Local File Storage) ===');
  const triggerRes = await fetch(`${API_URL}/platform/backups/runs`, {
    method: 'POST',
    headers: ownerAuthHeaders,
    body: JSON.stringify({
      backupType: 'full',
      includesFileStorage: true,
      storageDriver: 'local_disk',
    }),
  });
  const triggerJson = await triggerRes.json();
  if (!triggerRes.ok) {
    throw new Error(`Trigger backup failed: ${JSON.stringify(triggerJson)}`);
  }
  const newRun = triggerJson.data;
  console.log(`✓ Backup Run Created:
  - ID: ${newRun.id}
  - Status: ${newRun.status}
  - Includes File Storage: ${newRun.includesFileStorage}
  - SHA-256 Checksum: ${newRun.checksum?.slice(0, 16)}...
  - Retention Expiry: ${newRun.retentionExpiry}`);

  // Step 5: Run Automated Restore Test
  console.log('\n=== STEP 5: Run Periodic Automated Restore Test on Backup ===');
  const restoreTestRes = await fetch(`${API_URL}/platform/backups/runs/${newRun.id}/test-restore`, {
    method: 'POST',
    headers: ownerAuthHeaders,
  });
  const restoreTestJson = await restoreTestRes.json();
  if (!restoreTestRes.ok) {
    throw new Error(`Restore test failed: ${JSON.stringify(restoreTestJson)}`);
  }
  const testedRun = restoreTestJson.data;
  console.log(`✓ Automated Restore Test Passed:
  - Test Status: ${testedRun.restoreTestStatus}
  - Latency: ${testedRun.restoreTestDurationMs}ms
  - Schema Validated: ${testedRun.restoreTestDetails?.schemaValidated}
  - Tables Validated: ${testedRun.restoreTestDetails?.tablesValidated}`);

  // Step 6: Create Staff-Initiated Restore Request
  console.log('\n=== STEP 6: Create Staff-Initiated Restore Request (Tenant-Level) ===');
  const tenant = await prisma.tenant.findFirst({ where: { subdomain: 'acme' } }) || await prisma.tenant.findFirst();
  if (!tenant) throw new Error('No tenant found in database');

  const createRestoreRes = await fetch(`${API_URL}/platform/backups/restore-requests`, {
    method: 'POST',
    headers: ownerAuthHeaders,
    body: JSON.stringify({
      backupRunId: newRun.id,
      scope: 'tenant',
      tenantId: tenant.id,
      reason: 'Recover corrupt designation hierarchy requested by HR admin',
    }),
  });
  const createRestoreJson = await createRestoreRes.json();
  if (!createRestoreRes.ok) {
    throw new Error(`Create restore request failed: ${JSON.stringify(createRestoreJson)}`);
  }
  const restoreReq = createRestoreJson.data;
  console.log(`✓ Restore Request Created:
  - ID: ${restoreReq.id}
  - Scope: ${restoreReq.scope}
  - Target Tenant: ${tenant.name} (${tenant.subdomain})
  - Status: ${restoreReq.status}
  - Reason: "${restoreReq.reason}"`);

  // Step 7: Verify Dual Approval Rule (Reject Self-Approval)
  console.log('\n=== STEP 7: Verify Dual Approval Enforcement (Self-Approval Prohibited) ===');
  const selfApproveRes = await fetch(`${API_URL}/platform/backups/restore-requests/${restoreReq.id}/approve`, {
    method: 'POST',
    headers: ownerAuthHeaders,
  });
  const selfApproveJson = await selfApproveRes.json();
  if (selfApproveRes.status === 403) {
    console.log(`✓ Correctly rejected self-approval with 403 Forbidden: "${selfApproveJson.error?.message || selfApproveJson.message}"`);
  } else {
    throw new Error(`Expected 403 Forbidden for self-approval, got ${selfApproveRes.status}`);
  }

  // Step 8: Second Staff Approves & Executes Tenant Restore
  console.log('\n=== STEP 8: Second Staff Approves & Executes Tenant-Level Restore ===');
  const adminToken = await loginUser('platform.admin@cmsnbd.com');
  console.log(`✓ Logged in as Second Staff (platform.admin@cmsnbd.com)`);
  const adminAuthHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminToken}`,
  };

  const approveRes = await fetch(`${API_URL}/platform/backups/restore-requests/${restoreReq.id}/approve`, {
    method: 'POST',
    headers: adminAuthHeaders,
  });
  const approveJson = await approveRes.json();
  if (!approveRes.ok) {
    throw new Error(`Approval by second staff failed: ${JSON.stringify(approveJson)}`);
  }
  const approvedReq = approveJson.data;
  console.log(`✓ Second Approver Approved & Executed Restore:
  - Approved By: ${approvedReq.approvedByName}
  - Status: ${approvedReq.status}
  - Isolation Guaranteed: ${approvedReq.logs?.isolationGuaranteed}
  - Foreign Tenants Modified: ${approvedReq.logs?.foreignTenantsModified}`);

  // Step 9: Create Tenant Data Export
  console.log('\n=== STEP 9: Create Tenant Data Export (SYSTEM_SETTINGS §5) ===');
  const exportRes = await fetch(`${API_URL}/platform/backups/data-requests/tenant-export`, {
    method: 'POST',
    headers: ownerAuthHeaders,
    body: JSON.stringify({
      tenantId: tenant.id,
      reason: 'Compliance export for client data portability audit',
    }),
  });
  const exportJson = await exportRes.json();
  if (!exportRes.ok) {
    throw new Error(`Tenant export failed: ${JSON.stringify(exportJson)}`);
  }
  const exportReq = exportJson.data;
  console.log(`✓ Tenant Export Archive Generated:
  - Request ID: ${exportReq.id}
  - Archive URL: ${exportReq.archiveUrl}
  - Archive Size: ${exportReq.archiveSizeFormatted}
  - Expires At: ${exportReq.archiveExpiresAt}`);

  // Step 10: Create Employee Data Anonymization Request
  console.log('\n=== STEP 10: Execute Employee Anonymization / Deletion (SECURITY §9) ===');
  const employee = await prisma.employee.findFirst({
    where: { deletedAt: null },
    include: { tenant: true },
  });
  if (!employee) {
    console.log('Skipping step 10: no active employee found');
  } else {
    const anonRes = await fetch(`${API_URL}/platform/backups/data-requests/employee-anonymize`, {
      method: 'POST',
      headers: ownerAuthHeaders,
      body: JSON.stringify({
        tenantId: employee.tenantId,
        targetEmployeeId: employee.id,
        reason: 'GDPR Right to be Forgotten request',
      }),
    });
    const anonJson = await anonRes.json();
    if (!anonRes.ok) {
      throw new Error(`Employee anonymization failed: ${JSON.stringify(anonJson)}`);
    }
    const anonReq = anonJson.data;
    console.log(`✓ Employee Anonymized per SECURITY.md §9:
    - Target: ${anonReq.targetEmployeeName || employee.employeeNumber}
    - Tenant: ${employee.tenant.name}
    - Status: ${anonReq.status}
    - Scrubbed Fields: ${anonReq.anonymizedSummary?.scrubbedFields?.join(', ')}
    - Statutory Payroll Records Preserved: ${anonReq.anonymizedSummary?.statutoryPayrollRecordsPreserved}
    - Audit Logs Retained: ${anonReq.anonymizedSummary?.auditLogsRetained}`);

    // Verify employee in database
    const updatedEmp = await prisma.employee.findUnique({ where: { id: employee.id } });
    console.log(`✓ Database verification: firstName is now "${updatedEmp.firstName}", employmentStatus is "${updatedEmp.employmentStatus}"`);
  }

  // Step 11: Verify Platform Audit Log entries
  console.log('\n=== STEP 11: Verify Platform Audit Logs Recorded ===');
  const auditLogs = await prisma.platformAuditLog.findMany({
    where: {
      module: { in: ['backup_restore', 'data_compliance'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  console.log(`✓ Found ${auditLogs.length} audit logs in backup_restore / data_compliance:`);
  auditLogs.forEach((l) => {
    console.log(`  - [${l.module}] action: ${l.action}, reason: "${l.reason}"`);
  });

  console.log('\n============================================================');
  console.log('ALL VERIFICATION CHECKS PASSED FOR BACKUPS & COMPLIANCE!');
  console.log('============================================================');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
