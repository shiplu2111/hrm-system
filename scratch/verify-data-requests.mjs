// scratch/verify-data-requests.mjs
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const user = await prisma.platformUser.findFirst({
  where: { email: 'e2e.staff@platform.local' },
  include: { role: { include: { permissions: true } } },
});

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'hrm_secret_jwt_access_super_secure_2026';

const platformToken = jwt.sign(
  {
    sub: user.id,
    email: user.email,
    role_id: user.roleId,
    role_name: user.role.name,
    permissions: user.role.permissions.map((p) => ({ module: p.module, action: p.action })),
    aud: 'platform',
  },
  JWT_ACCESS_SECRET,
  { expiresIn: '1h' },
);

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${platformToken}`,
};

const BASE_URL = 'http://localhost:3000/api/v1/platform/backups';

async function run() {
  console.log('--- 1. Fetching Data Requests Queue ---');
  const res = await fetch(`${BASE_URL}/data-requests`, { headers });
  if (!res.ok) {
    throw new Error(`GET /data-requests failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  const requests = json.data;
  console.log(`Retrieved ${requests.length} data requests.`);

  console.log('\n--- 2. Validating Deadlines & Live Countdowns ---');
  for (const r of requests) {
    console.log(
      `[${r.type}] Tenant: ${r.tenantSubdomain || 'N/A'} | Status: ${r.status} | Deadline: ${
        r.deadline || 'None'
      } | Countdown: ${r.countdown?.formatted || 'None'} (Severity: ${r.countdown?.severity || 'N/A'})`,
    );
  }

  // Check if we have an overdue request
  const overdue = requests.find((r) => r.countdown?.severity === 'overdue');
  console.log('\nOverdue request detected:', overdue ? `YES (ID: ${overdue.id}, ${overdue.countdown.formatted})` : 'NO');

  // Check if we have completed request with legal retention exceptions
  const completedAnon = requests.find((r) => r.legalRetentionExceptions && r.legalRetentionExceptions.length > 0);
  console.log('\nCompleted request with legal exceptions:');
  if (completedAnon) {
    console.log(`ID: ${completedAnon.id}, Exceptions count: ${completedAnon.legalRetentionExceptions.length}`);
    for (const ex of completedAnon.legalRetentionExceptions) {
      console.log(` - Category: ${ex.category} | ${ex.title} | Basis: ${ex.statutoryBasis} | Period: ${ex.retentionPeriodYears}y | Records: ${ex.retainedRecordCount}`);
    }
  }

  // Check if we have completed request with completion record
  const withCompletion = requests.find((r) => r.completionRecord);
  console.log('\nCompleted request with completion record:');
  if (withCompletion) {
    console.log(`ID: ${withCompletion.id}`);
    console.log(`Summary: ${withCompletion.completionRecord.summary}`);
    console.log(`Completed By: ${withCompletion.completionRecord.completedByName}`);
    console.log(`Compliance Notes: ${withCompletion.completionRecord.complianceNotes}`);
  }

  // Test Approving a pending request
  const pendingReq = requests.find((r) => r.status === 'pending');
  if (pendingReq) {
    console.log(`\n--- 3. Testing Approval of Pending Request (${pendingReq.id}) ---`);
    const approveRes = await fetch(`${BASE_URL}/data-requests/${pendingReq.id}/approve`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ notes: 'Verified compliance authorization by platform operator' }),
    });
    if (!approveRes.ok) {
      console.error(`Approve failed: ${approveRes.status} ${await approveRes.text()}`);
    } else {
      const approveJson = await approveRes.json();
      console.log('Approval success! New status:', approveJson.data.status);
      console.log('Approved by:', approveJson.data.approvedByName);
      console.log('Completion record generated:', !!approveJson.data.completionRecord);
      if (approveJson.data.legalRetentionExceptions) {
        console.log('Legal retention exceptions applied:', approveJson.data.legalRetentionExceptions.length);
      }
    }
  }

  console.log('\n--- 4. Data Requests Verification Completed Successfully ---');
  await prisma.$disconnect();
}

run().catch((err) => {
  console.error('Verification failed:', err);
  prisma.$disconnect();
  process.exit(1);
});
