// scratch/verify-job-queues.mjs
import http from 'http';

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const opts = { ...options, headers: { ...(options.headers || {}) } };
    let payload = null;
    if (data !== null) {
      payload = typeof data === 'string' ? data : JSON.stringify(data);
      opts.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(opts, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });
    req.on('error', reject);
    if (payload !== null) {
      req.write(payload);
    }
    req.end();
  });
}

async function login(email, password, totpCode = '123456') {
  const res = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/platform/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email, password, totpCode });

  const token = res.body?.data?.accessToken || res.body?.data?.tokens?.accessToken;
  return { token, res };
}

async function run() {
  console.log('=== VERIFYING BULLMQ JOB QUEUE INSPECTOR ===');

  // Step 1: Login as Platform Owner
  const { token: ownerToken } = await login('platform.owner@cmsnbd.com', 'password');
  if (!ownerToken) throw new Error('Owner login failed');
  console.log('✅ Logged in as Platform Owner');

  const authHeaders = {
    'Authorization': `Bearer ${ownerToken}`,
    'Content-Type': 'application/json'
  };

  // Step 2: Role-gate test - Login as Support Agent (or unprivileged user)
  console.log('\n--- 1. Testing Role-Gating Access Control ---');
  const { token: supportToken } = await login('support.agent@cmsnbd.com', 'password');
  if (supportToken) {
    const forbiddenRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/platform/queues/overview',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${supportToken}` }
    });
    console.log('Support Agent access attempt status:', forbiddenRes.status);
    if (forbiddenRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for Support Agent, got ${forbiddenRes.status}`);
    }
    console.log('✅ Support Agent correctly rejected with 403 Forbidden:', forbiddenRes.body?.error?.message || forbiddenRes.body?.message);
  }

  // Step 3: GET /api/v1/platform/queues/overview
  console.log('\n--- 2. Testing Queue Overview & Prominence ---');
  const overviewRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/platform/queues/overview',
    method: 'GET',
    headers: authHeaders
  });
  console.log('Overview HTTP status:', overviewRes.status);
  const queues = overviewRes.body?.data?.queues || [];
  console.log(`Total queues returned: ${queues.length}`);

  const payrollQ = queues.find(q => q.name === 'payroll-processing');
  const syncQ = queues.find(q => q.name === 'attendance-sync');

  if (!payrollQ || !payrollQ.isProminent || !payrollQ.isPayroll) {
    throw new Error('payroll-processing queue missing or not flagged prominent/payroll');
  }
  if (!syncQ || !syncQ.isProminent) {
    throw new Error('attendance-sync queue missing or not flagged prominent');
  }
  console.log(`✅ Prominent Queues verified: "${payrollQ.displayName}" (isPayroll: ${payrollQ.isPayroll}) and "${syncQ.displayName}" (isProminent: ${syncQ.isProminent})`);

  // Step 4: GET /api/v1/platform/queues/jobs
  console.log('\n--- 3. Testing Jobs by State (failed, active, waiting, completed) ---');
  const jobsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/platform/queues/jobs?queueName=payroll-processing&state=all',
    method: 'GET',
    headers: authHeaders
  });
  const items = jobsRes.body?.data?.items || [];
  console.log(`Retrieved ${items.length} jobs for payroll-processing.`);
  const states = items.map(j => j.state);
  console.log('Observed states:', [...new Set(states)].join(', '));

  // Step 5: Failed job details with error stack
  console.log('\n--- 4. Testing Failed Job Details & Error Stack ---');
  const allFailedRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/platform/queues/jobs?state=failed',
    method: 'GET',
    headers: authHeaders
  });
  const allFailedItems = allFailedRes.body?.data?.items || [];
  if (allFailedItems.length === 0) throw new Error('Expected at least one failed job across queues');
  const failedJob = allFailedItems[0];
  console.log(`Testing failed job ${failedJob.id} from queue ${failedJob.queueName}`);

  const detailRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/v1/platform/queues/${failedJob.queueName}/jobs/${failedJob.id}`,
    method: 'GET',
    headers: authHeaders
  });
  console.log('Job Details HTTP status:', detailRes.status);
  console.log('Failed reason:', detailRes.body?.data?.failedReason);
  console.log('Stacktrace lines:', detailRes.body?.data?.stacktrace?.length);
  if (!detailRes.body?.data?.stacktrace?.length) {
    throw new Error('Expected stacktrace lines for failed job');
  }
  console.log('✅ Diagnostic details and stacktrace verified.');

  // Step 6: Retry Action
  console.log('\n--- 5. Testing Job Retry Action ---');
  const retryRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/v1/platform/queues/${failedJob.queueName}/jobs/${failedJob.id}/retry`,
    method: 'POST',
    headers: authHeaders
  });
  console.log('Retry response:', retryRes.status, retryRes.body?.data?.message);
  if (retryRes.status !== 200 && retryRes.status !== 201) {
    throw new Error(`Failed to retry job, status: ${retryRes.status}`);
  }
  console.log('✅ Job re-queued successfully.');

  // Step 7: STRICT CONSTRAINT - Never allow deleting a payroll job without typed reason
  console.log('\n--- 6. Testing Mandatory Typed Reason on Payroll Job Delete ---');
  const targetPayrollJob = items[0] || { id: 'job-pr-active-002' };
  console.log(`Targeting payroll job: ${targetPayrollJob.id}`);

  // Attempt 1: Empty body
  const emptyDeleteRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/v1/platform/queues/payroll-processing/jobs/${targetPayrollJob.id}`,
    method: 'DELETE',
    headers: authHeaders
  }, {});
  console.log('Attempt 1 (No reason) status:', emptyDeleteRes.status);
  if (emptyDeleteRes.status !== 400) {
    throw new Error(`Expected 400 Bad Request when deleting payroll job without reason, got ${emptyDeleteRes.status}`);
  }
  console.log('✅ Correctly blocked deletion without reason:', emptyDeleteRes.body?.error?.message || emptyDeleteRes.body?.message);

  // Attempt 2: Too short reason (< 5 chars)
  const shortDeleteRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/v1/platform/queues/payroll-processing/jobs/${targetPayrollJob.id}`,
    method: 'DELETE',
    headers: authHeaders
  }, { reason: 'del' });
  console.log('Attempt 2 (Reason < 5 chars) status:', shortDeleteRes.status);
  if (shortDeleteRes.status !== 400) {
    throw new Error(`Expected 400 Bad Request when deleting payroll job with short reason, got ${shortDeleteRes.status}`);
  }
  console.log('✅ Correctly blocked deletion with short reason (< 5 chars).');

  // Attempt 3: Valid typed justification reason (>= 5 chars)
  const validReason = 'Stale demo batch pruned by Platform Administrator during system check';
  const validDeleteRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/v1/platform/queues/payroll-processing/jobs/${targetPayrollJob.id}`,
    method: 'DELETE',
    headers: authHeaders
  }, { reason: validReason });
  console.log('Attempt 3 (Valid typed reason) status:', validDeleteRes.status);
  if (validDeleteRes.status !== 200) {
    throw new Error(`Expected 200 OK when deleting payroll job with valid reason, got ${validDeleteRes.status}: ${JSON.stringify(validDeleteRes.body)}`);
  }
  console.log('✅ Payroll job safely deleted with audit log id:', validDeleteRes.body?.data?.auditLogId);
  console.log('Message:', validDeleteRes.body?.data?.message);

  console.log('\n🎉 ALL BULLMQ QUEUE INSPECTOR TESTS PASSED!');
}

run().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
