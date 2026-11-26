import {
  hasExplicitPlatformPermission,
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
assert(ownerKeys.includes('leads'), 'Owner must see Leads');
assert(ownerKeys.includes('demo-requests'), 'Owner must see Demo Requests');
console.log(`✓ Platform Owner tests passed (${ownerKeys.length} nav items accessible, full wildcard access)`);

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
assert(!supportKeys.includes('leads'), 'Support must NOT see Leads');
assert(!supportKeys.includes('demo-requests'), 'Support must NOT see Demo Requests');
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

// 6. Sales Role
const salesRep: PlatformUserView = {
  id: 'sales-rep-id',
  email: 'sales.rep@cmsnbd.com',
  firstName: 'Sales',
  lastName: 'Rep',
  roleName: 'Sales',
  roleId: 'role-sales',
  permissions: [
    { module: 'leads', action: 'view' },
    { module: 'leads', action: 'edit' },
    { module: 'leads', action: 'manage' },
    { module: 'platform', action: 'view' },
  ],
  isActive: true,
  totpEnabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  lastLoginAt: '2026-03-01T12:00:00.000Z',
};

assert(hasPlatformPermission(salesRep, 'leads', 'view') === true, 'Sales can view leads');
assert(hasPlatformPermission(salesRep, 'leads', 'edit') === true, 'Sales can edit/assign leads');
assert(hasPlatformPermission(salesRep, 'tenant', 'view') === false, 'Sales CANNOT view tenants');
assert(hasPlatformPermission(salesRep, 'support', 'view') === false, 'Sales CANNOT view support');

const salesGroups = filterPlatformNavGroups(PLATFORM_NAV_GROUPS, (m, a) =>
  hasPlatformPermission(salesRep, m, a),
);
const salesKeys = salesGroups.flatMap((g) => g.items.map((i) => i.key));
assert(salesKeys.includes('leads'), 'Sales must see Leads');
assert(salesKeys.includes('demo-requests'), 'Sales must see Demo Requests');
assert(!salesKeys.includes('tenants'), 'Sales must NOT see Tenants Directory');
assert(!salesKeys.includes('platform-users'), 'Sales must NOT see Platform Staff');
console.log('✓ Sales role tests passed (Leads & Demo Requests accessible, non-sales domains hidden)');

// 7. Explicit-only cms:raw_html permission checks
const publisherNoRaw: PlatformUserView = {
  ...salesRep,
  roleName: 'Content Publisher',
  permissions: [
    { module: 'cms', action: 'view' },
    { module: 'cms', action: 'create' },
    { module: 'cms', action: 'edit' },
    { module: 'cms', action: 'manage' },
  ],
};
const publisherWithRaw: PlatformUserView = {
  ...publisherNoRaw,
  permissions: [...publisherNoRaw.permissions, { module: 'cms', action: 'raw_html' }],
};

assert(
  hasPlatformPermission(owner, 'cms', 'raw_html') === false,
  'Platform Owner without explicit cms:raw_html cannot enter raw HTML',
);
assert(
  hasPlatformPermission(publisherNoRaw, 'cms', 'raw_html') === false,
  'cms:manage must NOT implicitly grant cms:raw_html',
);
assert(
  hasExplicitPlatformPermission(publisherWithRaw, 'cms', 'raw_html') === true,
  'Explicit cms:raw_html claim grants raw HTML mode',
);

// Content Dashboard nav visibility gate
assert(ownerKeys.includes('cms-dashboard'), 'Platform Owner sees Content Dashboard');
assert(ownerKeys.includes('cms-pages'), 'Platform Owner sees CMS Pages list');
assert(ownerKeys.includes('cms-create-page'), 'Platform Owner sees Create Page');
assert(ownerKeys.includes('cms-blog'), 'Platform Owner sees Blog & Authors');
assert(ownerKeys.includes('cms-changelog'), 'Platform Owner sees Changelog');
assert(ownerKeys.includes('cms-careers'), 'Platform Owner sees Careers');
assert(ownerKeys.includes('cms-faqs'), 'Platform Owner sees FAQ Library');
assert(ownerKeys.includes('cms-media'), 'Platform Owner sees Media Library');
assert(ownerKeys.includes('cms-menus'), 'Platform Owner sees Navigation Menus');
assert(ownerKeys.includes('cms-redirects'), 'Platform Owner sees Redirects');
assert(ownerKeys.includes('cms-site-settings'), 'Platform Owner sees Site Settings');
assert(!billingKeys.includes('cms-dashboard'), 'Billing Admin must NOT see Content Dashboard');
assert(!billingKeys.includes('cms-pages'), 'Billing Admin must NOT see CMS Pages list');
assert(!billingKeys.includes('cms-create-page'), 'Billing Admin must NOT see Create Page');
assert(!billingKeys.includes('cms-blog'), 'Billing Admin must NOT see Blog & Authors');
assert(!billingKeys.includes('cms-changelog'), 'Billing Admin must NOT see Changelog');
assert(!billingKeys.includes('cms-careers'), 'Billing Admin must NOT see Careers');
assert(!billingKeys.includes('cms-faqs'), 'Billing Admin must NOT see FAQ Library');
assert(!billingKeys.includes('cms-media'), 'Billing Admin must NOT see Media Library');
assert(!billingKeys.includes('cms-menus'), 'Billing Admin must NOT see Navigation Menus');
assert(!billingKeys.includes('cms-redirects'), 'Billing Admin must NOT see Redirects');
assert(!billingKeys.includes('cms-site-settings'), 'Billing Admin must NOT see Site Settings');
assert(!salesKeys.includes('cms-dashboard'), 'Sales must NOT see Content Dashboard');
assert(!salesKeys.includes('cms-pages'), 'Sales must NOT see CMS Pages list');
assert(!salesKeys.includes('cms-create-page'), 'Sales must NOT see Create Page');
assert(!salesKeys.includes('cms-media'), 'Sales must NOT see Media Library');
assert(!salesKeys.includes('cms-menus'), 'Sales must NOT see Navigation Menus');
assert(!salesKeys.includes('cms-redirects'), 'Sales must NOT see Redirects');
assert(!salesKeys.includes('cms-site-settings'), 'Sales must NOT see Site Settings');

const contentEditor: PlatformUserView = {
  ...salesRep,
  roleName: 'Content Editor',
  permissions: [
    { module: 'cms', action: 'view' },
    { module: 'cms', action: 'create' },
    { module: 'cms', action: 'edit' },
  ],
};
const editorGroups = filterPlatformNavGroups(PLATFORM_NAV_GROUPS, (m, a) =>
  hasPlatformPermission(contentEditor, m, a),
);
const editorKeys = editorGroups.flatMap((g) => g.items.map((i) => i.key));
assert(editorKeys.includes('cms-dashboard'), 'Content Editor must see Content Dashboard');
assert(editorKeys.includes('cms-pages'), 'Content Editor must see CMS Pages list');
assert(editorKeys.includes('cms-create-page'), 'Content Editor must see Create Page');
assert(editorKeys.includes('cms-blog'), 'Content Editor must see Blog & Authors');
assert(editorKeys.includes('cms-changelog'), 'Content Editor must see Changelog');
assert(editorKeys.includes('cms-careers'), 'Content Editor must see Careers');
assert(editorKeys.includes('cms-faqs'), 'Content Editor must see FAQ Library');
assert(editorKeys.includes('cms-media'), 'Content Editor must see Media Library');
assert(editorKeys.includes('cms-menus'), 'Content Editor must see Navigation Menus');
assert(editorKeys.includes('cms-redirects'), 'Content Editor must see Redirects');
assert(editorKeys.includes('cms-site-settings'), 'Content Editor can view Site Settings');
assert(
  hasPlatformPermission(contentEditor, 'cms', 'create') === true,
  'Content Editor can quick-create pages/posts',
);
assert(
  hasPlatformPermission(contentEditor, 'cms', 'manage') === false,
  'Content Editor cannot publish/manage',
);

console.log('✓ Explicit cms:raw_html and Content Dashboard gate checks passed');

console.log('All Platform Permission tests passed successfully!');
