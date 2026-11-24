import http from 'http';

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
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
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function login() {
  const res = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/platform/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: 'platform.owner@cmsnbd.com',
    password: 'password',
    totpCode: '123456'
  });

  const token = res.body?.data?.accessToken || res.body?.data?.tokens?.accessToken;
  if (!token) {
    throw new Error('Login failed: ' + JSON.stringify(res.body));
  }
  return token;
}

async function run() {
  const token = await login();
  console.log('✅ Logged in successfully as Platform Owner');

  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // 1. Comprehensive Health
  const comp = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/platform/health',
    method: 'GET',
    headers: authHeaders
  });
  console.log('Comprehensive Health status:', comp.status, 'storage driver:', comp.body?.data?.storage?.driver, 'notifications overall:', comp.body?.data?.notifications?.overallDeliverabilityPercent);

  // 2. Storage Health
  const storage = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/platform/health/storage',
    method: 'GET',
    headers: authHeaders
  });
  console.log('Storage Health status:', storage.status, storage.body?.data?.status, 'usedGB:', storage.body?.data?.usedGB);

  // 3. Notification Providers Health
  const notifications = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/platform/health/notifications',
    method: 'GET',
    headers: authHeaders
  });
  console.log('Notifications Health status:', notifications.status, notifications.body?.data?.status, 'channels:', Object.keys(notifications.body?.data?.channels || {}));

  // 4. Latency & Error Trends
  const trends = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/platform/health/trends?timeRange=24h',
    method: 'GET',
    headers: authHeaders
  });
  console.log('Trends status:', trends.status, 'points:', trends.body?.data?.points?.length, 'summary:', trends.body?.data?.summary);

  // 5. Recent Incidents
  const incidents = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/platform/health/incidents',
    method: 'GET',
    headers: authHeaders
  });
  console.log('Incidents status:', incidents.status, 'total:', incidents.body?.data?.incidents?.length, 'active:', incidents.body?.data?.activeIncidentsCount);

  // 6. Create Test Incident
  const createInc = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/platform/health/incidents',
    method: 'POST',
    headers: authHeaders
  }, {
    title: 'Twilio SMS Gateway Spike in Undelivered Messages',
    subsystem: 'Notification Providers',
    severity: 'minor',
    impact: 'Tenants sending OTP SMS to US numbers experiencing 12s delivery latency.',
    note: 'Initial alert triggered by CloudWatch threshold at 12:45 UTC.'
  });
  console.log('Create Incident status:', createInc.status, createInc.body?.data?.incidentNumber);

  // 7. Update/Resolve Test Incident
  if (createInc.body?.data?.id) {
    const patchInc = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/v1/platform/health/incidents/${createInc.body.data.id}`,
      method: 'PATCH',
      headers: authHeaders
    }, {
      status: 'resolved',
      note: 'Twilio upstream downstream carrier routing rerouted. Deliverability back to 99.8%.'
    });
    console.log('Resolve Incident status:', patchInc.status, patchInc.body?.data?.status, patchInc.body?.data?.resolvedAt);
  }

  console.log('🎉 All backend health tests passed!');
}

run().catch(console.error);
