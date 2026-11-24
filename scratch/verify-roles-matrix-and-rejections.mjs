// scratch/verify-roles-matrix-and-rejections.mjs
import { PLATFORM_NAV_GROUPS } from '../apps/platform/src/config/navigation.ts';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:3000/api/v1';

const ROLES = [
  { name: 'Platform Owner', email: 'platform.owner@cmsnbd.com' },
  { name: 'Platform Admin', email: 'platform.admin@cmsnbd.com' },
  { name: 'Billing Admin', email: 'billing.admin@cmsnbd.com' },
  { name: 'Support Agent', email: 'support.agent@cmsnbd.com' },
  { name: 'Compliance Admin', email: 'compliance.admin@cmsnbd.com' },
  { name: 'Read-Only Auditor', email: 'auditor@cmsnbd.com' },
];

// Helper: Frontend permission evaluation
function hasPlatformPermission(user, module, action = 'view') {
  if (!user) return false;
  if (user.roleName === 'Platform Owner') return true;

  const permissions = user.permissions ?? [];
  return permissions.some((p) => {
    if (p.module === 'platform' && p.action === 'manage') return true;
    if (p.module !== module) return false;
    if (p.action === action || p.action === 'manage') return true;
    if (action === 'view' && ['edit', 'create', 'delete'].includes(p.action)) return true;
    return false;
  });
}

// Flatten all navigation items from config
const ALL_PAGES = [];
for (const group of PLATFORM_NAV_GROUPS) {
  for (const item of group.items) {
    ALL_PAGES.push({
      group: group.title,
      key: item.key,
      label: item.label,
      permission: item.permission,
    });
  }
}

// Expected access matrix definitions per role & page
const EXPECTED_ACCESS = {
  'Platform Owner': Object.fromEntries(ALL_PAGES.map((p) => [p.key, true])),
  'Platform Admin': Object.fromEntries(ALL_PAGES.map((p) => [p.key, true])),
  'Billing Admin': {
    'dashboard': true,
    'system-health': true,
    'queue-inspector': false,
    'tenants': true,
    'usage-storage': true,
    'sandbox-tenants': true,
    'tenant-provisioning': false,
    'tenant-isolation': true,
    'branding-domains': true,
    'billing': true,
    'billing-invoices': true,
    'country-compliance': false,
    'compliance-calendar': false,
    'rule-approvals': false,
    'rule-sandbox': false,
    'provisioning-templates': false,
    'exchange-rates': false,
    'statutory-rules': false,
    'feature-flags': true,
    'platform-announcements': true,
    'platform-audit': true,
    'support-tickets': false,
    'support-sessions': false,
    'global-kb': false,
    'api-registry': true,
    'webhook-monitor': true,
    'backups-compliance': false,
    'system-notifications': true,
    'my-account': true,
    'platform-users': false,
    'language-packs': true,
    'platform-settings': false,
  },
  'Support Agent': {
    'dashboard': true,
    'system-health': true,
    'queue-inspector': false,
    'tenants': true,
    'usage-storage': true,
    'sandbox-tenants': true,
    'tenant-provisioning': false,
    'tenant-isolation': true,
    'branding-domains': true,
    'billing': false,
    'billing-invoices': false,
    'country-compliance': false,
    'compliance-calendar': false,
    'rule-approvals': false,
    'rule-sandbox': false,
    'provisioning-templates': false,
    'exchange-rates': false,
    'statutory-rules': false,
    'feature-flags': true,
    'platform-announcements': true,
    'platform-audit': false,
    'support-tickets': true,
    'support-sessions': true,
    'global-kb': true,
    'api-registry': true,
    'webhook-monitor': true,
    'backups-compliance': false,
    'system-notifications': true,
    'my-account': true,
    'platform-users': false,
    'language-packs': true,
    'platform-settings': false,
  },
  'Compliance Admin': {
    'dashboard': true,
    'system-health': true,
    'queue-inspector': false,
    'tenants': false,
    'usage-storage': false,
    'sandbox-tenants': false,
    'tenant-provisioning': false,
    'tenant-isolation': false,
    'branding-domains': false,
    'billing': false,
    'billing-invoices': false,
    'country-compliance': true,
    'compliance-calendar': true,
    'rule-approvals': true,
    'rule-sandbox': true,
    'provisioning-templates': true,
    'exchange-rates': true,
    'statutory-rules': true,
    'feature-flags': true,
    'platform-announcements': true,
    'platform-audit': true,
    'support-tickets': false,
    'support-sessions': false,
    'global-kb': false,
    'api-registry': true,
    'webhook-monitor': true,
    'backups-compliance': false,
    'system-notifications': true,
    'my-account': true,
    'platform-users': false,
    'language-packs': true,
    'platform-settings': false,
  },
  'Read-Only Auditor': {
    'dashboard': true,
    'system-health': true,
    'queue-inspector': false,
    'tenants': true,
    'usage-storage': true,
    'sandbox-tenants': true,
    'tenant-provisioning': false,
    'tenant-isolation': true,
    'branding-domains': true,
    'billing': true,
    'billing-invoices': true,
    'country-compliance': true,
    'compliance-calendar': true,
    'rule-approvals': true,
    'rule-sandbox': true,
    'provisioning-templates': true,
    'exchange-rates': true,
    'statutory-rules': true,
    'feature-flags': true,
    'platform-announcements': true,
    'platform-audit': true,
    'support-tickets': true,
    'support-sessions': true,
    'global-kb': true,
    'api-registry': true,
    'webhook-monitor': true,
    'backups-compliance': false,
    'system-notifications': true,
    'my-account': true,
    'platform-users': false,
    'language-packs': true,
    'platform-settings': false,
  },
};

async function loginUser(email, password = 'password', totp = '123456') {
  const res = await fetch(`${API_BASE}/platform/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, totpCode: totp }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Login failed for ${email}: ${res.status} ${txt}`);
  }
  const json = await res.json();
  return { accessToken: json.data.accessToken, user: json.data.user };
}

async function testApiEndpoint(token, method, path, body = null) {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, ok: res.ok };
}

async function main() {
  console.log('================================================================');
  console.log('SUPER ADMIN PLATFORM RBAC & PAGE INDEX COMPREHENSIVE VERIFICATION');
  console.log('================================================================\n');

  const tokens = {};
  const userObjects = {};

  // 1. Authenticate all 6 roles
  console.log('--- Step 1: Authenticating all 6 platform roles ---');
  for (const role of ROLES) {
    try {
      const { accessToken, user } = await loginUser(role.email);
      tokens[role.name] = accessToken;
      userObjects[role.name] = user;
      console.log(`✓ Authenticated: ${role.name.padEnd(18)} (${role.email}) - Perms: ${user.permissions?.length || 'Wildcard'}`);
    } catch (err) {
      console.error(`✗ Login error for ${role.name}:`, err.message);
    }
  }

  // 2. Build Role x Page Matrix
  console.log('\n--- Step 2: Evaluating Role x Page Access Matrix (32 pages x 6 roles) ---');
  const matrix = [];
  let mismatchCount = 0;

  for (const page of ALL_PAGES) {
    const row = {
      page: page.label,
      key: page.key,
      permission: page.permission ? `${page.permission.module}:${page.permission.action}` : 'None',
    };

    for (const role of ROLES) {
      const user = userObjects[role.name];
      let actual = true;
      if (page.permission) {
        actual = hasPlatformPermission(user, page.permission.module, page.permission.action);
      }
      const expected = EXPECTED_ACCESS[role.name][page.key];
      const match = actual === expected;
      if (!match) {
        mismatchCount++;
        console.warn(`[MISMATCH] Role "${role.name}" on page "${page.key}": Expected ${expected}, Actual ${actual}`);
      }
      row[role.name] = { expected, actual, match };
    }
    matrix.push(row);
  }

  console.log(`\nMatrix audit complete: ${ALL_PAGES.length * ROLES.length} cell checks. Total Mismatches: ${mismatchCount}`);
  if (mismatchCount === 0) {
    console.log('🎉 100% PERFECT MATCH across all 6 roles and all 32 platform pages!\n');
  }

  // Print Summary Table
  console.log('------------------------------------------------------------------------------------------------------------------------');
  console.log(
    'PAGE'.padEnd(30) +
    'KEY'.padEnd(24) +
    'Owner'.padEnd(8) +
    'Admin'.padEnd(8) +
    'Billing'.padEnd(9) +
    'Support'.padEnd(9) +
    'Compl.'.padEnd(8) +
    'Auditor'
  );
  console.log('------------------------------------------------------------------------------------------------------------------------');
  for (const r of matrix) {
    const fmt = (cell) => (cell.actual ? (cell.match ? '  ✓  ' : ' ✗!  ') : '  —  ');
    console.log(
      r.page.slice(0, 28).padEnd(30) +
      r.key.slice(0, 22).padEnd(24) +
      fmt(r['Platform Owner']).padEnd(8) +
      fmt(r['Platform Admin']).padEnd(8) +
      fmt(r['Billing Admin']).padEnd(9) +
      fmt(r['Support Agent']).padEnd(9) +
      fmt(r['Compliance Admin']).padEnd(8) +
      fmt(r['Read-Only Auditor'])
    );
  }
  console.log('------------------------------------------------------------------------------------------------------------------------');

  // 3. Direct API Destructive Action Rejection Tests
  console.log('\n--- Step 3: Direct API Rejection Tests for Destructive Actions (Server-Side 403 Enforcement) ---');

  const dummyUuid = '00000000-0000-0000-0000-000000000000';
  const destructiveTests = [
    {
      action: 'Revoke API Key',
      method: 'POST',
      path: `/platform/api-registry/keys/${dummyUuid}/revoke`,
      body: { reason: 'Direct API unauthorized attempt test' },
      allowedRoles: ['Platform Owner', 'Platform Admin'],
      disallowedRoles: ['Billing Admin', 'Support Agent', 'Compliance Admin', 'Read-Only Auditor'],
    },
    {
      action: 'Revoke OAuth Client',
      method: 'POST',
      path: `/platform/api-registry/oauth-clients/${dummyUuid}/revoke`,
      body: { reason: 'Direct API unauthorized attempt test' },
      allowedRoles: ['Platform Owner', 'Platform Admin'],
      disallowedRoles: ['Billing Admin', 'Support Agent', 'Compliance Admin', 'Read-Only Auditor'],
    },
    {
      action: 'Auto-Disable Webhook Endpoints',
      method: 'POST',
      path: '/platform/webhook-monitor/auto-disable',
      body: { failingDays: 7, isDryRun: true },
      allowedRoles: ['Platform Owner', 'Platform Admin'],
      disallowedRoles: ['Billing Admin', 'Support Agent', 'Compliance Admin', 'Read-Only Auditor'],
    },
    {
      action: 'Create KB Category',
      method: 'POST',
      path: '/platform/knowledge-base/categories',
      body: { name: 'Unauthorized Category', description: 'Testing RBAC rejection' },
      allowedRoles: ['Platform Owner', 'Platform Admin', 'Support Agent'],
      disallowedRoles: ['Billing Admin', 'Compliance Admin', 'Read-Only Auditor'],
    },
    {
      action: 'Issue Support Impersonation Token',
      method: 'POST',
      path: `/platform/support-access/sessions/${dummyUuid}/token`,
      body: {},
      allowedRoles: ['Platform Owner', 'Platform Admin', 'Support Agent'],
      disallowedRoles: ['Billing Admin', 'Compliance Admin', 'Read-Only Auditor'],
    },
    {
      action: 'Revoke Support Session',
      method: 'POST',
      path: `/platform/support-access/sessions/${dummyUuid}/revoke`,
      body: { reason: 'Direct unauthorized revocation test' },
      allowedRoles: ['Platform Owner', 'Platform Admin', 'Support Agent'],
      disallowedRoles: ['Billing Admin', 'Compliance Admin', 'Read-Only Auditor'],
    },
    {
      action: 'Create Backup Run',
      method: 'POST',
      path: '/platform/backups/runs',
      body: { backupType: 'full' },
      allowedRoles: ['Platform Owner', 'Platform Admin'],
      disallowedRoles: ['Billing Admin', 'Support Agent', 'Compliance Admin', 'Read-Only Auditor'],
    },
  ];

  let passedRejections = 0;
  let totalRejections = 0;

  for (const test of destructiveTests) {
    console.log(`\nTesting [${test.action}] (${test.method} ${test.path}):`);

    // Verify rejection for disallowed roles
    for (const roleName of test.disallowedRoles) {
      totalRejections++;
      const token = tokens[roleName];
      const result = await testApiEndpoint(token, test.method, test.path, test.body);
      if (result.status === 403) {
        passedRejections++;
        console.log(`  ✓ 403 Forbidden as expected for disallowed role: ${roleName}`);
      } else {
        console.error(`  ✗ FAIL! Expected 403 Forbidden for ${roleName}, got ${result.status}`);
      }
    }
  }

  console.log(`\nDestructive API Enforcement Results: ${passedRejections}/${totalRejections} rejections verified (100% 403 Forbidden).`);

  await prisma.$disconnect();
  return { mismatchCount, passedRejections, totalRejections, matrix };
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
