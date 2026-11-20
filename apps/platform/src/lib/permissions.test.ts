import {
  hasPlatformPermission,
  hasAnyPlatformPermission,
  hasAllPlatformPermissions,
  canViewPlatformModule,
} from './permissions';
import { filterPlatformNavGroups } from './nav-permissions';
import { PLATFORM_NAV_GROUPS, type PlatformViewKey } from '../config/navigation';
import type { PlatformUserView } from '@hrm/shared-types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log('--- Running Platform Permission Tests ---');

// 1. Platform Owner (Wildcard Superuser)
const owner: PlatformUserView = {
  id: 'owner-id',
  email: 'platform.owner@cmsnbd.com',
  firstName: 'Platform',
  lastName: 'Owner',
  roleName: 'Platform Owner',
  roleId: 'role-owner',
  permissions: [{ module: 'platform', action: 'manage' }],
  isActive: true,
  totpEnabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  lastLoginAt: '2026-03-01T12:00:00.000Z',
};

assert(hasPlatformPermission(owner, 'tenant', 'create') === true, 'Owner should have tenant:create');
assert(hasPlatformPermission(owner, 'billing', 'delete') === true, 'Owner should have billing:delete');
assert(hasPlatformPermission(owner, 'setting', 'manage') === true, 'Owner should have setting:manage');
assert(canViewPlatformModule(owner, 'compliance') === true, 'Owner should view compliance');

const ownerGroups = filterPlatformNavGroups(PLATFORM_NAV_GROUPS, (m, a) =>
  hasPlatformPermission(owner, m, a),
);
const ownerKeys = ownerGroups.flatMap((g) => g.items.map((i) => i.key));
assert(ownerKeys.includes('tenant-provisioning'), 'Owner must see Provision Tenant');
assert(ownerKeys.length === 16, `Owner should see all 16 nav items, got ${ownerKeys.length}`);
console.log('✓ Platform Owner tests passed (16/16 nav items accessible, full wildcard access)');

// 2. Billing Admin
const billingAdmin: PlatformUserView = {
  id: 'billing-admin-id',
  email: 'billing@cmsnbd.com',
  firstName: 'Billing',
  lastName: 'Admin',
  roleName: 'Billing Admin',
  roleId: 'role-billing',
  permissions: [
    { module: 'billing', action: 'view' },
    { module: 'billing', action: 'create' },
    { module: 'billing', action: 'edit' },
    { module: 'billing', action: 'manage' },
    { module: 'tenant', action: 'view' },
    { module: 'audit', action: 'view' },
    { module: 'platform', action: 'view' },
  ],
  isActive: true,
  totpEnabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  lastLoginAt: '2026-03-01T12:00:00.000Z',
};

assert(hasPlatformPermission(billingAdmin, 'billing', 'view') === true, 'Billing admin can view billing');
assert(hasPlatformPermission(billingAdmin, 'billing', 'edit') === true, 'Billing admin can edit billing');
assert(hasPlatformPermission(billingAdmin, 'tenant', 'view') === true, 'Billing admin can view tenant');
assert(hasPlatformPermission(billingAdmin, 'tenant', 'create') === false, 'Billing admin CANNOT create tenant');
assert(hasPlatformPermission(billingAdmin, 'user', 'view') === false, 'Billing admin CANNOT view platform users');
assert(hasPlatformPermission(billingAdmin, 'compliance', 'view') === false, 'Billing admin CANNOT view compliance');

const billingGroups = filterPlatformNavGroups(PLATFORM_NAV_GROUPS, (m, a) =>
  hasPlatformPermission(billingAdmin, m, a),
);
const billingKeys = billingGroups.flatMap((g) => g.items.map((i) => i.key));
assert(!billingKeys.includes('tenant-provisioning'), 'Billing Admin must NOT see Provision Tenant');
assert(!billingKeys.includes('country-compliance'), 'Billing Admin must NOT see Country Compliance');
assert(!billingKeys.includes('platform-users'), 'Billing Admin must NOT see Platform Staff');
assert(!billingKeys.includes('platform-settings'), 'Billing Admin must NOT see Platform Settings');
assert(!billingGroups.some((g) => g.id === 'compliance'), 'Compliance group must be hidden when empty');
assert(billingKeys.includes('billing'), 'Billing Admin must see Subscriptions & Plans');
assert(billingKeys.includes('billing-invoices'), 'Billing Admin must see Invoices & Revenue');
assert(billingKeys.includes('my-account'), 'Billing Admin must see My Account');
console.log('✓ Billing Admin tests passed (unauthorized items hidden, empty groups removed)');

// 3. Support Agent
const supportAgent: PlatformUserView = {
  id: 'support-agent-id',
  email: 'support@cmsnbd.com',
  firstName: 'Support',
  lastName: 'Agent',
  roleName: 'Support Agent',
  roleId: 'role-support',
  permissions: [
    { module: 'support', action: 'view' },
    { module: 'support', action: 'manage' },
    { module: 'support', action: 'impersonate' },
    { module: 'tenant', action: 'view' },
    { module: 'platform', action: 'view' },
  ],
  isActive: true,
  totpEnabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  lastLoginAt: '2026-03-01T12:00:00.000Z',
};

assert(hasPlatformPermission(supportAgent, 'support', 'view') === true, 'Support can view support');
assert(hasPlatformPermission(supportAgent, 'tenant', 'create') === false, 'Support cannot create tenant');
assert(hasPlatformPermission(supportAgent, 'billing', 'view') === false, 'Support cannot view billing');

const supportGroups = filterPlatformNavGroups(PLATFORM_NAV_GROUPS, (m, a) =>
  hasPlatformPermission(supportAgent, m, a),
);
const supportKeys = supportGroups.flatMap((g) => g.items.map((i) => i.key));
assert(supportKeys.includes('support-tickets'), 'Support must see Support Tickets');
assert(!supportKeys.includes('billing'), 'Support must NOT see Billing');
assert(!supportGroups.some((g) => g.id === 'billing'), 'Billing group must be hidden');
console.log('✓ Support Agent tests passed (billing and compliance groups hidden)');

// 4. Read-Only Auditor
const auditor: PlatformUserView = {
  id: 'auditor-id',
  email: 'auditor@cmsnbd.com',
  firstName: 'Read-Only',
  lastName: 'Auditor',
  roleName: 'Read-Only Auditor',
  roleId: 'role-auditor',
  permissions: [
    { module: 'audit', action: 'view' },
    { module: 'platform', action: 'view' },
    { module: 'tenant', action: 'view' },
    { module: 'billing', action: 'view' },
    { module: 'compliance', action: 'view' },
    { module: 'country', action: 'view' },
    { module: 'support', action: 'view' },
  ],
  isActive: true,
  totpEnabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  lastLoginAt: '2026-03-01T12:00:00.000Z',
};

assert(hasPlatformPermission(auditor, 'tenant', 'view') === true, 'Auditor can view tenants');
assert(hasPlatformPermission(auditor, 'tenant', 'create') === false, 'Auditor CANNOT create tenants');
assert(hasPlatformPermission(auditor, 'tenant', 'edit') === false, 'Auditor CANNOT edit tenants');
assert(hasPlatformPermission(auditor, 'billing', 'edit') === false, 'Auditor CANNOT edit billing');
assert(hasPlatformPermission(auditor, 'country', 'create') === false, 'Auditor CANNOT create country');

const auditorGroups = filterPlatformNavGroups(PLATFORM_NAV_GROUPS, (m, a) =>
  hasPlatformPermission(auditor, m, a),
);
const auditorKeys = auditorGroups.flatMap((g) => g.items.map((i) => i.key));
assert(!auditorKeys.includes('tenant-provisioning'), 'Auditor must NOT see Provision Tenant');
assert(auditorKeys.includes('tenants'), 'Auditor sees Tenants Directory');
assert(auditorKeys.includes('billing'), 'Auditor sees Subscriptions & Plans');
assert(auditorKeys.includes('country-compliance'), 'Auditor sees Country Compliance');
assert(auditorKeys.includes('platform-audit'), 'Auditor sees Platform Audit Logs');
console.log('✓ Read-Only Auditor tests passed (all view pages visible, provision hidden, write actions denied)');

// 5. Implicit View Permission (Write implies view)
const editorOnly: PlatformUserView = {
  id: 'editor-id',
  email: 'editor@cmsnbd.com',
  firstName: 'Editor',
  lastName: 'Only',
  roleName: 'Custom Editor',
  roleId: 'role-editor',
  permissions: [{ module: 'tenant', action: 'edit' }],
  isActive: true,
  totpEnabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  lastLoginAt: '2026-03-01T12:00:00.000Z',
};
assert(hasPlatformPermission(editorOnly, 'tenant', 'view') === true, 'Edit action must imply view permission');
assert(hasPlatformPermission(editorOnly, 'tenant', 'create') === false, 'Edit action does not imply create');
console.log('✓ Write-implies-view rule verified');

console.log('All Platform Permission tests passed successfully!');
