import type { ComponentType } from 'react';
import {
  Activity,
  BellRing,
  Building2,
  CalendarClock,
  CircleDollarSign,
  CreditCard,
  Database,
  FileCheck2,
  FileClock,
  FlaskConical,
  Globe2,
  Headphones,
  Inbox,
  LayoutDashboard,
  Palette,
  PlusCircle,
  Receipt,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  UserCog,
  UserCheck,
} from 'lucide-react';

export type PlatformViewKey =
  | 'dashboard'
  | 'system-health'
  | 'tenants'
  | 'sandbox-tenants'
  | 'tenant-detail'
  | 'tenant-provisioning'
  | 'tenant-isolation'
  | 'branding-domains'
  | 'billing'
  | 'billing-invoices'
  | 'country-compliance'
  | 'compliance-calendar'
  | 'rule-approvals'
  | 'rule-sandbox'
  | 'provisioning-templates'
  | 'statutory-rules'
  | 'feature-flags'
  | 'platform-audit'
  | 'support-tickets'
  | 'support-sessions'
  | 'system-notifications'
  | 'platform-users'
  | 'my-account'
  | 'platform-settings';

export interface NavItem {
  key: PlatformViewKey;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  badge?: string;
  badgeTone?: 'emerald' | 'amber' | 'indigo' | 'blue' | 'slate';
  isPlaceholder?: boolean;
  plannedStage?: string;
  permission?: {
    module: string;
    action: string;
  };
}

export interface NavGroup {
  id: string;
  title: string;
  items: NavItem[];
}

export const PLATFORM_NAV_GROUPS: NavGroup[] = [
  {
    id: 'overview',
    title: 'Overview',
    items: [
      {
        key: 'dashboard',
        label: 'Platform Overview',
        description: 'Multi-tenant health metrics, aggregate MRR, and platform activity',
        icon: LayoutDashboard,
        permission: { module: 'platform', action: 'view' },
      },
      {
        key: 'system-health',
        label: 'System Health',
        description: 'Cluster metrics, database connection pools, and Redis latency',
        icon: Activity,
        badge: '99.98%',
        badgeTone: 'emerald',
        permission: { module: 'platform', action: 'view' },
      },
    ],
  },
  {
    id: 'tenants',
    title: 'Tenants',
    items: [
      {
        key: 'tenants',
        label: 'Tenants Directory',
        description: 'Manage tenant workspaces, company lifecycles, and tenant status',
        icon: Building2,
        permission: { module: 'tenant', action: 'view' },
      },
      {
        key: 'sandbox-tenants',
        label: 'Sandbox Tenants',
        description: 'Demo environments seeded with sample data for sales demos',
        icon: FlaskConical,
        badge: 'Demo',
        badgeTone: 'amber',
        permission: { module: 'tenant', action: 'view' },
      },
      {
        key: 'tenant-provisioning',
        label: 'Provision Tenant',
        description: 'Onboard and configure isolated tenant workspaces and root admins',
        icon: PlusCircle,
        permission: { module: 'tenant', action: 'create' },
      },
      {
        key: 'tenant-isolation',
        label: 'Tenant Isolation',
        description: 'Verification of RLS policies, schemas, and tenant boundary enforcement',
        icon: Database,
        badge: 'Enforced',
        badgeTone: 'blue',
        permission: { module: 'tenant', action: 'view' },
      },
      {
        key: 'branding-domains',
        label: 'Branding & Custom Domains',
        description: "Platform view of any tenant's branding, custom domain verification, DNS records, and plan gate",
        icon: Palette,
        badge: 'Live',
        badgeTone: 'emerald',
        permission: { module: 'tenant', action: 'view' },
      },
    ],
  },
  {
    id: 'billing',
    title: 'Billing',
    items: [
      {
        key: 'billing',
        label: 'Subscriptions & Plans',
        description: 'Tier definitions, seat caps, plan upgrades, and payment gateways',
        icon: CreditCard,
        permission: { module: 'billing', action: 'view' },
      },
      {
        key: 'billing-invoices',
        label: 'Revenue & Financial Reports',
        description: 'MRR, ARR, expansion vs churn movements, plan/country breakdown, and CSV export',
        icon: Receipt,
        badge: 'Live',
        badgeTone: 'emerald',
        permission: { module: 'billing', action: 'view' },
      },
    ],
  },
  {
    id: 'compliance',
    title: 'Compliance',
    items: [
      {
        key: 'country-compliance',
        label: 'Country Configuration',
        description: 'Statutory employment rules, tax brackets, and official holiday calendars',
        icon: Globe2,
        badge: 'Live',
        badgeTone: 'emerald',
        permission: { module: 'country', action: 'view' },
      },
      {
        key: 'compliance-calendar',
        label: 'Compliance Calendar',
        description: 'Month and list calendar views, deadline rules, tenant preview, and retirement tracking',
        icon: CalendarClock,
        badge: 'Live',
        badgeTone: 'emerald',
        permission: { module: 'country', action: 'view' },
      },
      {
        key: 'rule-approvals',
        label: 'Rule Approvals Inbox',
        description: 'Four-Eyes compliance review queue for pending rule versions across all countries',
        icon: Inbox,
        badge: 'Inbox',
        badgeTone: 'amber',
        permission: { module: 'country', action: 'view' },
      },
      {
        key: 'rule-sandbox',
        label: 'Rule Test Sandbox',
        description: 'Dry-run Rule Resolver and payroll calculations with sample profiles or draft rule overrides',
        icon: FlaskConical,
        badge: 'Simulator',
        badgeTone: 'indigo',
        permission: { module: 'country', action: 'view' },
      },
      {
        key: 'provisioning-templates',
        label: 'Default Templates',
        description: 'Document types, leave policies, notifications, roles, checklists for new tenants (Stage C.0)',
        icon: Sparkles,
        badge: 'Stage C.0',
        badgeTone: 'emerald',
        permission: { module: 'country', action: 'view' },
      },
      {
        key: 'statutory-rules',
        label: 'Statutory Baselines',
        description: 'Cross-jurisdiction labor compliance matrices and overtime ceilings',
        icon: FileCheck2,
        isPlaceholder: true,
        plannedStage: 'Stage C (Compliance)',
        badge: 'Coming soon',
        badgeTone: 'slate',
        permission: { module: 'compliance', action: 'view' },
      },
    ],
  },
  {
    id: 'operations',
    title: 'Operations',
    items: [
      {
        key: 'feature-flags',
        label: 'Feature Flags',
        description: 'Tenant rollout rings, experimental module flags, and kill-switches',
        icon: SlidersHorizontal,
        permission: { module: 'platform', action: 'view' },
      },
      {
        key: 'platform-audit',
        label: 'Platform Audit Logs',
        description: 'Append-only audit trail of all privileged platform operator actions',
        icon: FileClock,
        badge: 'Immutable',
        badgeTone: 'indigo',
        permission: { module: 'audit', action: 'view' },
      },
      {
        key: 'support-tickets',
        label: 'Support Tickets',
        description: 'Cross-tenant incident response and authorized admin assistance',
        icon: Headphones,
        badge: '37',
        badgeTone: 'amber',
        permission: { module: 'support', action: 'view' },
      },
      {
        key: 'support-sessions',
        label: 'Support Sessions Log',
        description: 'Audited log of platform staff impersonation sessions and action counts',
        icon: UserCheck,
        badge: 'Audited',
        badgeTone: 'amber',
        permission: { module: 'tenant', action: 'view' },
      },
      {
        key: 'system-notifications',
        label: 'System Broadcasts',
        description: 'Platform-wide maintenance windows and emergency banners',
        icon: BellRing,
        isPlaceholder: true,
        plannedStage: 'Stage D (Operations)',
        badge: 'Coming soon',
        badgeTone: 'slate',
        permission: { module: 'platform', action: 'view' },
      },
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    items: [
      {
        key: 'my-account',
        label: 'My Account & Security',
        description: 'Manage password, TOTP 2FA configuration, active sessions, and login logs',
        icon: UserCheck,
      },
      {
        key: 'platform-users',
        label: 'Platform Staff & Roles',
        description: 'Operator accounts, RBAC permissions, and mandatory 2FA enforcement',
        icon: UserCog,
        permission: { module: 'user', action: 'view' },
      },
      {
        key: 'platform-settings',
        label: 'Platform Settings',
        description: 'Global fallback SMTP, S3 storage buckets, and security thresholds',
        icon: Settings,
        permission: { module: 'setting', action: 'view' },
      },
    ],
  },
];
