// scratch/verify-support-tickets.mjs
const API_BASE = 'http://localhost:3000/api/v1';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  if (!res.ok) {
    throw new Error(`Request to ${path} failed with ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function login(email, password, totpCode = '123456') {
  const loginRes = await request('/platform/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, totpCode }),
  });
  const token = loginRes?.data?.accessToken || loginRes?.data?.tokens?.accessToken || loginRes?.accessToken;
  if (!token) throw new Error(`Login failed to return accessToken: ${JSON.stringify(loginRes)}`);
  return token;
}

async function run() {
  console.log('--- 1. Authenticating as Platform Owner ---');
  const token = await login('platform.owner@cmsnbd.com', 'password', '123456');
  console.log('Authenticated! Token obtained.');

  const authHeaders = { Authorization: `Bearer ${token}` };

  console.log('\n--- 2. Fetching Cross-Tenant Support Tickets Queue ---');
  const queueRes = await request('/platform/support-tickets?pageSize=20', {
    headers: authHeaders,
  });

  const data = queueRes.data;
  console.log(`Retrieved ${data.items.length} tickets across tenants.`);
  console.log('Queue counts:', JSON.stringify(data.counts));
  console.log('Queue SLA counts:', JSON.stringify(data.slaCounts));

  if (data.items.length === 0) {
    throw new Error('No tickets found in queue!');
  }

  const firstTicket = data.items[0];
  console.log(`Sample Ticket: ${firstTicket.ticketNumber} - "${firstTicket.subject}"`);
  console.log(`Tenant: ${firstTicket.tenantName} (${firstTicket.planName || firstTicket.planId} plan)`);
  console.log('SLA Metrics:', JSON.stringify(firstTicket.sla));

  console.log('\n--- 3. Testing Queue Filtering (by status and priority) ---');
  const openRes = await request('/platform/support-tickets?status=open', {
    headers: authHeaders,
  });
  console.log(`Open tickets count: ${openRes.data.items.length}`);

  console.log('\n--- 4. Fetching Platform Staff Assignees ---');
  const staffRes = await request('/platform/support-tickets/staff', {
    headers: authHeaders,
  });
  console.log(`Found ${staffRes.data.length} staff assignees:`, staffRes.data.map(s => `${s.firstName} ${s.lastName}`).join(', '));

  console.log('\n--- 5. Fetching Ticket Detail ---');
  const detailRes = await request(`/platform/support-tickets/${firstTicket.id}`, {
    headers: authHeaders,
  });
  const detail = detailRes.data;
  console.log(`Detail loaded for ${detail.ticketNumber}`);
  console.log(`Active support session: ${detail.activeSupportSession ? JSON.stringify(detail.activeSupportSession) : 'None'}`);
  console.log(`Existing messages: ${detail.messages.length}`);

  console.log('\n--- 6. Creating Internal Staff Note (Private to Platform) ---');
  const noteRes = await request(`/platform/support-tickets/${firstTicket.id}/messages`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      body: 'INTERNAL NOTE: Initial triage conducted. Inspecting tenant audit logs for payroll block.',
      isInternal: true,
    }),
  });
  console.log(`Internal note created: id=${noteRes.data.id}, isInternal=${noteRes.data.isInternal}, author=${noteRes.data.authorName}`);

  console.log('\n--- 7. Creating Public Customer Reply ---');
  const replyRes = await request(`/platform/support-tickets/${firstTicket.id}/messages`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      body: 'Hello, our platform support engineering team is investigating your inquiry now.',
      isInternal: false,
    }),
  });
  console.log(`Customer reply created: id=${replyRes.data.id}, isInternal=${replyRes.data.isInternal}, author=${replyRes.data.authorName}`);

  console.log('\n--- 8. Verifying Ticket Status Transition & Updated Messages ---');
  const afterReplyDetail = await request(`/platform/support-tickets/${firstTicket.id}`, {
    headers: authHeaders,
  });
  console.log(`New Status: ${afterReplyDetail.data.status}`);
  console.log(`Assignee: ${afterReplyDetail.data.assigneeName}`);
  console.log(`SLA Status: ${afterReplyDetail.data.sla.status} (${afterReplyDetail.data.sla.label})`);

  console.log('\n--- 9. Testing Ticket Status & Priority Patch ---');
  const patchRes = await request(`/platform/support-tickets/${firstTicket.id}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      priority: 'urgent',
      status: 'in_progress',
    }),
  });
  console.log(`Patched ticket: priority=${patchRes.data.priority}, status=${patchRes.data.status}`);

  console.log('\n--- 10. Testing One-Click Support Access Request (Stage D) ---');
  const accessRes = await request(`/platform/tenants/${firstTicket.tenantId}/support-access/request`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      reason: `Support investigation for ticket ${firstTicket.ticketNumber}: ${firstTicket.subject}`,
      durationMinutes: 60,
      accessMode: 'read_write',
    }),
  });
  console.log(`Support access created: id=${accessRes.data?.id || accessRes.id}, status=${accessRes.data?.status || accessRes.status}`);

  console.log('\n=========================================');
  console.log('ALL SUPPORT TICKET VERIFICATIONS PASSED!');
  console.log('=========================================');
}

run().catch((err) => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
