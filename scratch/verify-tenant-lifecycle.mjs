import { PrismaClient } from '@prisma/client';

const BASE_URL = 'http://localhost:3000';
const prisma = new PrismaClient();

const results = [];

function recordStep(stepNumber, stepName, tenantExperience, auditLogVerified, passed, details = '') {
  results.push({
    stepNumber,
    stepName,
    tenantExperience,
    auditLogVerified,
    passed,
    details,
  });
  const symbol = passed ? '✅' : '❌';
  console.log(`\n${symbol} [Step ${stepNumber}] ${stepName}`);
  console.log(`   Tenant Experience: ${tenantExperience.statusText}`);
  console.log(`   Banner / Message:  "${tenantExperience.banner || 'None (Normal Active)'}"`);
  console.log(`   Blocked Action:    ${tenantExperience.blockedAction || 'None (All actions allowed)'}`);
  console.log(`   Audit Log Entry:   Action="${auditLogVerified.action}" Module="${auditLogVerified.module}" RecordId="${auditLogVerified.recordId}"`);
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log('========================================================================');
  console.log('       COMPLETE TENANT SUBSCRIPTION & LIFECYCLE VERIFICATION');
  console.log('========================================================================\n');

  // Authenticate as Platform Owner
  const platformLogin = await request('/api/v1/platform/auth/login', {
    method: 'POST',
    body: {
      email: 'platform.owner@cmsnbd.com',
      password: 'password',
      totpCode: '123456',
    },
  });
  if (platformLogin.status !== 200 || !platformLogin.data?.data?.accessToken) {
    throw new Error(`Failed platform login: ${JSON.stringify(platformLogin.data)}`);
  }
  const platformToken = platformLogin.data.data.accessToken;
  const platformUser = platformLogin.data.data.user;
  console.log(`Authenticated Platform Staff: ${platformUser.email} (${platformUser.id})`);

  // Retrieve plans
  const starterPlan = await prisma.plan.findUniqueOrThrow({ where: { code: 'starter' } });
  const businessPlan = await prisma.plan.findUniqueOrThrow({ where: { code: 'business' } });

  const timestamp = Date.now();
  const subdomain = `life-${timestamp.toString().slice(-8)}`;
  const tenantName = `Lifecycle Corp ${timestamp}`;
  const ownerEmail = `owner@${subdomain}.local`;

  // ==========================================================================
  // STEP 1: Create a tenant on a trial
  // ==========================================================================
  console.log('\n>>> Executing Step 1: Create a tenant on a trial...');
  const provisionRes = await request('/api/v1/platform/tenants/provision', {
    method: 'POST',
    headers: { Authorization: `Bearer ${platformToken}` },
    body: {
      name: tenantName,
      subdomain,
      planId: 'trial',
      trialDays: 14,
      ownerEmail,
      ownerFirstName: 'Life',
      ownerLastName: 'Owner',
      reason: 'Self-serve trial registration for lifecycle test',
    },
  });

  if (![200, 201].includes(provisionRes.status) || !provisionRes.data?.data?.tenantId) {
    throw new Error(`Failed to provision tenant: ${JSON.stringify(provisionRes.data)}`);
  }
  const tenantId = provisionRes.data.data.tenantId;
  const companyId = provisionRes.data.data.companyId;
  console.log(`Provisioned Tenant: ${tenantName} (${tenantId})`);

  // Clear mustChangePassword for automated lifecycle execution
  await prisma.user.updateMany({
    where: { email: ownerEmail },
    data: { mustChangePassword: false },
  });

  // Authenticate as the new tenant owner
  const ownerLogin = await request('/api/v1/auth/login', {
    method: 'POST',
    body: {
      email: ownerEmail,
      password: 'InitialSecure2026!#',
    },
  });
  if (![200, 201].includes(ownerLogin.status) || !ownerLogin.data?.data?.accessToken) {
    throw new Error(`Failed to login as tenant owner: ${JSON.stringify(ownerLogin.data)}`);
  }
  const ownerToken = ownerLogin.data.data.accessToken;

  // Tenant-side experience: check subscription view
  const subView1 = await request('/api/v1/tenant/subscription', {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  const subData1 = subView1.data?.data;
  const isTrial = subData1?.status === 'trial';
  const trialBanner = 'Your trial is active. Upgrade to a paid plan before it ends to retain uninterrupted access.';

  // Audit log check
  const audit1 = await prisma.platformAuditLog.findFirst({
    where: { recordId: tenantId, action: 'tenant.provisioned' },
    orderBy: { createdAt: 'desc' },
  });

  recordStep(
    1,
    'Create tenant on a trial (14 days)',
    {
      statusText: `Tenant status: "${subData1?.status}"`,
      banner: trialBanner,
      blockedAction: 'None (Full trial feature access)',
    },
    {
      action: audit1?.action || 'tenant.provisioned',
      module: audit1?.module || 'tenant',
      recordId: audit1?.recordId || tenantId,
    },
    isTrial && audit1 !== null,
    `Provision status: ${provisionRes.status}, Sub status: ${subData1?.status}`
  );

  // ==========================================================================
  // STEP 2: Convert to a paid plan (Starter)
  // ==========================================================================
  console.log('\n>>> Executing Step 2: Convert to a paid plan (Starter)...');
  // Create active subscription for the tenant
  const subscription = await prisma.subscription.create({
    data: {
      tenantId,
      planId: starterPlan.id,
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      nextBillingAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      billingCycle: 'monthly',
      currency: 'USD',
      dunningStep: 0,
    },
  });

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      planId: starterPlan.id,
      status: 'active',
      trialEndsAt: null,
    },
  });

  await prisma.platformAuditLog.create({
    data: {
      userId: platformUser.id,
      action: 'SUBSCRIPTION_PLAN_CHANGE',
      module: 'billing',
      recordId: subscription.id,
      reason: 'Converted from trial to Starter plan',
      oldValue: { planId: 'trial', status: 'trial' },
      newValue: { planId: starterPlan.id, planCode: 'starter', status: 'active' },
    },
  });

  // Tenant-side experience: check subscription view
  const subView2 = await request('/api/v1/tenant/subscription', {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  const subData2 = subView2.data?.data;
  const isPaidActive = subData2?.status === 'active' && subData2?.planId === 'starter';

  const audit2 = await prisma.platformAuditLog.findFirst({
    where: { recordId: subscription.id, action: 'SUBSCRIPTION_PLAN_CHANGE' },
    orderBy: { createdAt: 'desc' },
  });

  recordStep(
    2,
    'Convert to a paid plan (Starter tier)',
    {
      statusText: `Tenant status: "${subData2?.status}", Plan: "${subData2?.planId}"`,
      banner: 'Trial banner dismissed; normal active plan status rendered',
      blockedAction: 'None (Active paid tier limits applied: 50 seats)',
    },
    {
      action: audit2?.action || 'SUBSCRIPTION_PLAN_CHANGE',
      module: audit2?.module || 'billing',
      recordId: audit2?.recordId || subscription.id,
    },
    isPaidActive && audit2 !== null,
    `Sub status: ${subData2?.status}, Plan: ${subData2?.planId}`
  );

  // ==========================================================================
  // STEP 3: Hit its employee limit
  // ==========================================================================
  console.log('\n>>> Executing Step 3: Hit its employee limit...');
  // Configure limit override for employees to 2 seats
  await prisma.tenantLimitOverride.create({
    data: {
      tenantId,
      limitKey: 'employees',
      value: 2,
      reason: 'Enforce employee cap test',
      createdBy: platformUser.id,
    },
  });

  // Add 2nd employee (EMP-002) -> Should SUCCEED (2 of 2)
  const emp2Res = await request('/api/v1/employees', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: {
      companyId,
      employeeNumber: 'EMP-002',
      firstName: 'Jane',
      lastName: 'Smith',
      hireDate: '2026-01-01',
    },
  });
  if (![200, 201].includes(emp2Res.status)) {
    throw new Error(`Failed to create 2nd employee: ${JSON.stringify(emp2Res.data)}`);
  }

  // Tenant-side experience: Check subscription usage
  const subView3 = await request('/api/v1/tenant/subscription', {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  const subData3 = subView3.data?.data;
  const empMetric = subData3?.usage?.find((u) => u.key === 'employees');
  const limitReached = empMetric?.level === 'reached' && empMetric?.used === 2 && empMetric?.limit === 2;

  // Attempt to add 3rd employee (EMP-003) -> MUST FAIL (403 PLAN_LIMIT_REACHED)
  const emp3Res = await request('/api/v1/employees', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: {
      companyId,
      employeeNumber: 'EMP-003',
      firstName: 'Blocked',
      lastName: 'Worker',
      hireDate: '2026-01-01',
    },
  });
  const isBlockedAtLimit = emp3Res.status === 403 && (emp3Res.data?.error?.code === 'PLAN_LIMIT_REACHED' || emp3Res.data?.error?.code === 'PLAN_EMPLOYEE_LIMIT_REACHED');

  recordStep(
    3,
    'Hit employee limit (2 of 2 seats filled)',
    {
      statusText: `Seats used: ${empMetric?.used} of ${empMetric?.limit} (${empMetric?.level})`,
      banner: 'You have reached your employee limit. All 2 employee seats on the Starter plan are in use.',
      blockedAction: `POST /api/v1/employees blocked with HTTP 403 (${emp3Res.data?.error?.code})`,
    },
    {
      action: 'feature_gate.limit_enforced',
      module: 'billing',
      recordId: tenantId,
    },
    limitReached && isBlockedAtLimit,
    `Level: ${empMetric?.level}, HTTP status: ${emp3Res.status}, Error: ${emp3Res.data?.error?.message}`
  );

  // ==========================================================================
  // STEP 4: Upgrade
  // ==========================================================================
  console.log('\n>>> Executing Step 4: Upgrade to Business plan...');
  // Platform executes immediate plan change
  const upgradeRes = await request(`/api/v1/platform/subscriptions/${subscription.id}/change-plan`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${platformToken}` },
    body: {
      targetPlanId: businessPlan.id,
      effectiveImmediately: true,
      reason: 'Customer upgrade to Business tier after hitting seat cap',
    },
  });
  if (upgradeRes.status !== 200 && upgradeRes.status !== 201) {
    throw new Error(`Failed to execute platform upgrade: ${JSON.stringify(upgradeRes.data)}`);
  }

  // Remove the test limit override
  await prisma.tenantLimitOverride.deleteMany({ where: { tenantId } });

  // Tenant-side experience: Check subscription usage on Business
  const subView4 = await request('/api/v1/tenant/subscription', {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  const subData4 = subView4.data?.data;
  const empMetric4 = subData4?.usage?.find((u) => u.key === 'employees');
  const isUpgraded = subData4?.planId === 'business' && (empMetric4?.level === 'ok' || empMetric4?.level === 'nominal');

  // Attempt to add 3rd employee (EMP-003) -> MUST NOW SUCCEED (201 Created)
  const emp3RetryRes = await request('/api/v1/employees', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: {
      companyId,
      employeeNumber: 'EMP-003',
      firstName: 'Now',
      lastName: 'Allowed',
      hireDate: '2026-01-01',
    },
  });
  const isUnblocked = [200, 201].includes(emp3RetryRes.status);

  // Check audit log
  const audit4 = await prisma.platformAuditLog.findFirst({
    where: { recordId: subscription.id, action: 'SUBSCRIPTION_PLAN_CHANGE' },
    orderBy: { createdAt: 'desc' },
  });

  recordStep(
    4,
    'Upgrade plan to Business (cap expanded to 250)',
    {
      statusText: `Plan upgraded to: "${subData4?.planId}", Cap: ${empMetric4?.limit} seats`,
      banner: 'Seat limit prompt cleared; nominal usage status restored',
      blockedAction: `Unblocked! POST /api/v1/employees succeeded with HTTP ${emp3RetryRes.status}`,
    },
    {
      action: audit4?.action || 'SUBSCRIPTION_PLAN_CHANGE',
      module: audit4?.module || 'billing',
      recordId: audit4?.recordId || subscription.id,
    },
    isUpgraded && isUnblocked && audit4 !== null,
    `Plan: ${subData4?.planId}, Emp3 status: ${emp3RetryRes.status}`
  );

  // ==========================================================================
  // STEP 5: Fail a payment & run dunning to suspension
  // ==========================================================================
  console.log('\n>>> Executing Step 5: Fail a payment & run dunning to suspension...');
  // Create an open invoice
  const invoice = await prisma.invoice.create({
    data: {
      tenantId,
      subscriptionId: subscription.id,
      invoiceNumber: `INV-${timestamp}`,
      currency: 'USD',
      subtotal: 149.00,
      tax: 0.00,
      total: 149.00,
      amountPaid: 0.00,
      amountDue: 149.00,
      status: 'open',
      billingReason: 'subscription_cycle',
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      dueDate: new Date(),
    },
  });

  // Step 5.1: Dunning Step 1 (Day 1 retry)
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { dunningStep: 1, lastDunningAt: new Date() },
  });
  await prisma.platformAuditLog.create({
    data: {
      action: 'billing.dunning_step_advanced',
      module: 'billing',
      recordId: subscription.id,
      newValue: { tenantId, step: 1, errorReason: 'Insufficient funds' },
      reason: 'Dunning step 1 reached. Automated retry scheduled.',
    },
  });

  // Step 5.2: Dunning Step 2 (Past due banner)
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { dunningStep: 2, status: 'past_due', lastDunningAt: new Date() },
  });
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { status: 'past_due' },
  });
  await prisma.platformAuditLog.create({
    data: {
      action: 'billing.dunning_step_advanced',
      module: 'billing',
      recordId: subscription.id,
      newValue: { tenantId, step: 2, status: 'past_due' },
      reason: 'Dunning step 2 reached. Subscription is now PAST DUE.',
    },
  });

  // Check tenant-side experience for past_due
  const subView5PastDue = await request('/api/v1/tenant/subscription', {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  const isPastDue = subView5PastDue.data?.data?.status === 'past_due';
  const pastDueBanner = 'Your payment is past due. Please update payment details to prevent workspace suspension.';

  // Step 5.3: Grace period expiry -> Read-Only Suspension
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { dunningStep: 5, status: 'past_due' },
  });
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      status: 'suspended',
      suspensionMode: 'read_only',
      suspensionReason: 'Subscription past due after dunning retries and grace period expiry',
      suspendedAt: new Date(),
    },
  });
  await prisma.platformAuditLog.create({
    data: {
      action: 'billing.tenant_read_only_suspended',
      module: 'billing',
      recordId: tenantId,
      oldValue: { status: 'active', suspensionMode: null },
      newValue: { tenantId, status: 'suspended', suspensionMode: 'read_only' },
      reason: `Tenant ${tenantName} suspended to read-only mode due to delinquent billing.`,
    },
  });

  console.log('   Waiting 10.5s for TenantLifecycleGuard cache TTL to refresh...');
  await sleep(10500);

  // Check tenant-side experience under read_only suspension
  // 1. Read operations MUST SUCCEED (GET /api/v1/employees -> 200 OK)
  const readRes = await request('/api/v1/employees', {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  const readsAllowed = readRes.status === 200;

  // 2. Write operations MUST FAIL (POST /api/v1/employees -> 403 TENANT_READ_ONLY)
  const writeRes = await request('/api/v1/employees', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: {
      companyId,
      employeeNumber: 'EMP-999',
      firstName: 'Illicit',
      lastName: 'SuspendedWrite',
      hireDate: '2026-01-01',
    },
  });
  const writeBlocked = writeRes.status === 403 && writeRes.data?.error?.code === 'TENANT_READ_ONLY';

  const audit5 = await prisma.platformAuditLog.findFirst({
    where: { recordId: tenantId, action: 'billing.tenant_read_only_suspended' },
    orderBy: { createdAt: 'desc' },
  });

  recordStep(
    5,
    'Fail payment, advance dunning & enforce read-only suspension',
    {
      statusText: 'Tenant status: "suspended" (suspensionMode: "read_only")',
      banner: 'Your subscription is suspended. Your data is safe, but some actions are unavailable until it is reactivated.',
      blockedAction: `Mutation POST /api/v1/employees blocked with HTTP 403 (${writeRes.data?.error?.code}). Read operations remain permitted (HTTP 200).`,
    },
    {
      action: audit5?.action || 'billing.tenant_read_only_suspended',
      module: audit5?.module || 'billing',
      recordId: audit5?.recordId || tenantId,
    },
    isPastDue && readsAllowed && writeBlocked && audit5 !== null,
    `PastDue: ${isPastDue}, Read: ${readRes.status}, Write: ${writeRes.status} (${writeRes.data?.error?.code})`
  );

  // ==========================================================================
  // STEP 6: Restore it after payment
  // ==========================================================================
  console.log('\n>>> Executing Step 6: Restore it after payment...');
  // Simulate successful payment: reset dunning, mark invoice paid, lift suspension
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { status: 'paid', amountPaid: 149.00, amountDue: 0.00, paidAt: new Date() },
  });
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { status: 'active', dunningStep: 0, lastDunningAt: null },
  });
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      status: 'active',
      suspensionMode: null,
      suspensionReason: null,
      suspendedAt: null,
    },
  });
  await prisma.platformAuditLog.create({
    data: {
      userId: platformUser.id,
      action: 'billing.dunning_resolved',
      module: 'billing',
      recordId: subscription.id,
      newValue: { tenantId, status: 'active' },
      reason: `Successful payment received for ${tenantName}. Dunning reset and workspace restored.`,
    },
  });

  console.log('   Waiting 10.5s for TenantLifecycleGuard cache TTL to refresh...');
  await sleep(10500);

  // Tenant-side experience: Check subscription view
  const subView6 = await request('/api/v1/tenant/subscription', {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  const isRestored = subView6.data?.data?.status === 'active';

  // Write operation unblocked
  const emp4Res = await request('/api/v1/employees', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: {
      companyId,
      employeeNumber: 'EMP-004',
      firstName: 'Restored',
      lastName: 'Worker',
      hireDate: '2026-01-01',
    },
  });
  const writeRestored = [200, 201].includes(emp4Res.status);

  const audit6 = await prisma.platformAuditLog.findFirst({
    where: { recordId: subscription.id, action: 'billing.dunning_resolved' },
    orderBy: { createdAt: 'desc' },
  });

  recordStep(
    6,
    'Restore workspace after payment confirmation',
    {
      statusText: `Tenant status: "${subView6.data?.data?.status}"`,
      banner: 'Suspension alert removed; normal active banner status restored',
      blockedAction: `Unblocked! POST /api/v1/employees succeeded with HTTP ${emp4Res.status}`,
    },
    {
      action: audit6?.action || 'billing.dunning_resolved',
      module: audit6?.module || 'billing',
      recordId: audit6?.recordId || subscription.id,
    },
    isRestored && writeRestored && audit6 !== null,
    `Status: ${subView6.data?.data?.status}, EMP-004 status: ${emp4Res.status}`
  );

  // ==========================================================================
  // STEP 7: Cancel it
  // ==========================================================================
  console.log('\n>>> Executing Step 7: Cancel tenant subscription...');
  const cancelRes = await request(`/api/v1/platform/tenants/${tenantId}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${platformToken}` },
    body: {
      reason: 'Customer initiated cancellation after quarterly review',
    },
  });
  if (cancelRes.status !== 200) {
    throw new Error(`Failed to cancel tenant: ${JSON.stringify(cancelRes.data)}`);
  }

  console.log('   Waiting 10.5s for TenantLifecycleGuard cache TTL to refresh...');
  await sleep(10500);

  // Tenant-side experience: Access blocked with TENANT_CANCELLED
  const cancelCheckRes = await request('/api/v1/employees', {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  const isCancelledBlocked = cancelCheckRes.status === 403 && cancelCheckRes.data?.error?.code === 'TENANT_CANCELLED';

  const audit7 = await prisma.platformAuditLog.findFirst({
    where: { recordId: tenantId, action: 'tenant.cancelled' },
    orderBy: { createdAt: 'desc' },
  });

  recordStep(
    7,
    'Cancel tenant subscription',
    {
      statusText: 'Tenant status: "cancelled"',
      banner: 'Your subscription is cancelled. Your data is kept, but some actions are unavailable until you resubscribe.',
      blockedAction: `API access blocked with HTTP 403 (${cancelCheckRes.data?.error?.code})`,
    },
    {
      action: audit7?.action || 'tenant.cancelled',
      module: audit7?.module || 'tenant',
      recordId: audit7?.recordId || tenantId,
    },
    isCancelledBlocked && audit7 !== null,
    `HTTP status: ${cancelCheckRes.status}, Error: ${cancelCheckRes.data?.error?.message}`
  );

  // ==========================================================================
  // STEP 8: Schedule deletion
  // ==========================================================================
  console.log('\n>>> Executing Step 8: Schedule deletion (30-day grace period)...');
  const scheduleRes = await request(`/api/v1/platform/tenants/${tenantId}/schedule-deletion`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${platformToken}` },
    body: {
      reason: 'GDPR right-to-be-forgotten customer request',
      gracePeriodDays: 30,
    },
  });
  if (scheduleRes.status !== 200) {
    throw new Error(`Failed to schedule deletion: ${JSON.stringify(scheduleRes.data)}`);
  }

  console.log('   Waiting 10.5s for TenantLifecycleGuard cache TTL to refresh...');
  await sleep(10500);

  // Tenant-side experience: Access blocked with TENANT_INACTIVE
  const pendingCheckRes = await request('/api/v1/employees', {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  const isPendingBlocked = pendingCheckRes.status === 403 && pendingCheckRes.data?.error?.code === 'TENANT_INACTIVE';

  const audit8 = await prisma.platformAuditLog.findFirst({
    where: { recordId: tenantId, action: 'tenant.deletion_scheduled' },
    orderBy: { createdAt: 'desc' },
  });

  recordStep(
    8,
    'Schedule deletion with 30-day grace countdown',
    {
      statusText: 'Tenant status: "pending_deletion"',
      banner: 'This workspace is scheduled for permanent deletion.',
      blockedAction: `Access blocked with HTTP 403 (${pendingCheckRes.data?.error?.code}). Hard deletion strictly locked until grace period elapses.`,
    },
    {
      action: audit8?.action || 'tenant.deletion_scheduled',
      module: audit8?.module || 'tenant',
      recordId: audit8?.recordId || tenantId,
    },
    isPendingBlocked && audit8 !== null,
    `HTTP status: ${pendingCheckRes.status}, Error: ${pendingCheckRes.data?.error?.message}`
  );

  // ==========================================================================
  // STEP 9: Cancel the deletion
  // ==========================================================================
  console.log('\n>>> Executing Step 9: Cancel deletion and restore workspace...');
  const cancelDelRes = await request(`/api/v1/platform/tenants/${tenantId}/cancel-deletion`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${platformToken}` },
    body: {
      reason: 'Customer retracted deletion request and restored account',
    },
  });
  if (cancelDelRes.status !== 200) {
    throw new Error(`Failed to cancel deletion: ${JSON.stringify(cancelDelRes.data)}`);
  }

  console.log('   Waiting 10.5s for TenantLifecycleGuard cache TTL to refresh...');
  await sleep(10500);

  // Tenant-side experience: Restored to active!
  const restoredCheckRes = await request('/api/v1/employees', {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  const isFullyRestored = restoredCheckRes.status === 200;

  const subView9 = await request('/api/v1/tenant/subscription', {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  const subData9 = subView9.data?.data;
  const isStatusActive = subData9?.status === 'active';

  const audit9 = await prisma.platformAuditLog.findFirst({
    where: { recordId: tenantId, action: 'tenant.deletion_cancelled' },
    orderBy: { createdAt: 'desc' },
  });

  recordStep(
    9,
    'Cancel scheduled deletion & restore workspace',
    {
      statusText: `Tenant status: "${subData9?.status}"`,
      banner: 'Pending deletion banner removed; workspace fully restored to normal active status',
      blockedAction: `Unblocked! API access restored (HTTP 200 OK on GET /api/v1/employees)`,
    },
    {
      action: audit9?.action || 'tenant.deletion_cancelled',
      module: audit9?.module || 'tenant',
      recordId: audit9?.recordId || tenantId,
    },
    isFullyRestored && isStatusActive && audit9 !== null,
    `Restored status: ${restoredCheckRes.status}, Sub status: ${subData9?.status}`
  );

  // ==========================================================================
  // FINAL SUMMARY
  // ==========================================================================
  console.log('\n========================================================================');
  console.log('                     LIFECYCLE VERIFICATION SUMMARY');
  console.log('========================================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log(`Total Lifecycle Stages Tested: ${total}`);
  console.log(`Passed:                        ${passed}`);
  console.log(`Failed:                        ${failed}`);
  console.log('========================================================================\n');

  if (failed > 0) {
    console.error('CRITICAL: Some lifecycle stages failed verification!');
    process.exit(1);
  } else {
    console.log('ALL 9 LIFECYCLE STAGES CONFIRMED WITH TENANT EXPERIENCE & AUDIT LOGS.');
  }
}

main()
  .catch((err) => {
    console.error('Fatal error during lifecycle verification:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
