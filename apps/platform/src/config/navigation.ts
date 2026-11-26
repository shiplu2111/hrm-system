import type { ComponentType } from 'react';
import {
  Activity,
  ArrowRightLeft,
  BellRing,
  BookOpen,
  Briefcase,
  Building2,
  CalendarClock,
  CalendarCheck2,
  CircleDollarSign,
  Coins,
  CreditCard,
  Database,
  FileCheck2,
  FileClock,
  FilePlus2,
  FileText,
  FlaskConical,
  Globe2,
  HardDrive,
  Headphones,
  HelpCircle,
  Image as ImageIcon,
  Inbox,
  KeyRound,
  Languages,
  Layers,
  LayoutDashboard,
  ListTree,
  Megaphone,
  Palette,
  PlusCircle,
  Receipt,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Target,
  UserCog,
  UserCheck,
  Webhook,
  Workflow,
  Wrench,
} from 'lucide-react';

export type PlatformViewKey =
  | 'dashboard'
  | 'system-health'
  | 'queue-inspector'
  | 'usage-storage'
  | 'tenants'
  | 'sandbox-tenants'
  | 'tenant-detail'
  | 'tenant-provisioning'
  | 'tenant-isolation'
  | 'branding-domains'
  | 'billing'
  | 'billing-invoices'
  | 'leads'
  | 'demo-requests'
  | 'country-compliance'
  | 'compliance-calendar'
  | 'rule-approvals'
  | 'rule-sandbox'
  | 'cms-dashboard'
  | 'cms-pages'
  | 'cms-create-page'
  | 'cms-blog'
  | 'cms-changelog'
  | 'cms-careers'
  | 'cms-faqs'
  | 'cms-media'
  | 'cms-menus'
  | 'cms-redirects'
  | 'cms-site-settings'
  | 'provisioning-templates'
  | 'exchange-rates'
  | 'language-packs'
  | 'statutory-rules'
  | 'feature-flags'
  | 'platform-audit'
  | 'support-tickets'
  | 'support-sessions'
  | 'global-kb'
  | 'api-registry'
  | 'webhook-monitor'
  | 'backups-compliance'
  | 'system-notifications'
  | 'platform-users'
  | 'my-account'
  | 'platform-announcements'
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
      {
        key: 'queue-inspector',
        label: 'Job Queue Inspector',
        description: 'BullMQ queues, jobs by state, failed job stacks, retry & remove with safety guards',
        icon: Workflow,
        badge: 'BullMQ',
        badgeTone: 'emerald',
        permission: { module: 'platform', action: 'edit' },
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
        key: 'usage-storage',
        label: 'Usage & Storage',
        description: 'Per-tenant employees, storage, and API quotas vs. plan limits with 80% saturation detection',
        icon: HardDrive,
        badge: 'Limits',
        badgeTone: 'amber',
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
    id: 'sales',
    title: 'Sales & Growth',
    items: [
      {
        key: 'leads',
        label: 'Leads',
        description: 'Website sales leads & contact inquiries with qualification workflow and CSV export',
        icon: Target,
        badge: 'Sales',
        badgeTone: 'indigo',
        permission: { module: 'leads', action: 'view' },
      },
      {
        key: 'demo-requests',
        label: 'Demo Requests',
        description: 'Public Book a Demo requests with assignee routing, notes, and audit history',
        icon: CalendarCheck2,
        badge: 'Demo',
        badgeTone: 'amber',
        permission: { module: 'leads', action: 'view' },
      },
    ],
  },
  {
    id: 'cms',
    title: 'Website CMS',
    items: [
      {
        key: 'cms-dashboard',
        label: 'Content Dashboard',
        description:
          'Drafts, scheduled publishes, legal approvals, Bengali translation gaps, broken links, recent changes, and quick create',
        icon: FileText,
        badge: 'CMS',
        badgeTone: 'indigo',
        permission: { module: 'cms', action: 'view' },
      },
      {
        key: 'cms-pages',
        label: 'Pages',
        description: 'All system and custom website pages with lock protection, versions, translations, previews, and publishing controls',
        icon: Layers,
        permission: { module: 'cms', action: 'view' },
      },
      {
        key: 'cms-create-page',
        label: 'Create Page',
        description: 'Create custom CMS pages with templates, live slug validation, drag-and-drop blocks, and optional menu placement',
        icon: FilePlus2,
        permission: { module: 'cms', action: 'create' },
      },
      {
        key: 'cms-blog',
        label: 'Blog & Authors',
        description: 'Blog posts with rich-text editor, scheduled publishing, categories, authors, reading time, and RSS feed',
        icon: BookOpen,
        permission: { module: 'cms', action: 'view' },
      },
      {
        key: 'cms-changelog',
        label: 'Changelog',
        description: 'Release notes with release date, New/Improved/Fixed tag, rich-text body, and public visibility toggle',
        icon: Sparkles,
        permission: { module: 'cms', action: 'view' },
      },
      {
        key: 'cms-careers',
        label: 'Careers',
        description: 'Job listings with title, location, type, rich-text description, open/closed status, and apply email/URL',
        icon: Briefcase,
        permission: { module: 'cms', action: 'view' },
      },
      {
        key: 'cms-faqs',
        label: 'FAQ Library',
        description: 'Reusable rich-text Q&A library grouped by topic, pickable into any page FAQ block per locale',
        icon: HelpCircle,
        permission: { module: 'cms', action: 'view' },
      },
      {
        key: 'cms-media',
        label: 'Media Library',
        description: 'Images, PDF downloads, resized WebP/AVIF variants, EXIF stripping, alt text, folders, tags, and usage tracking',
        icon: ImageIcon,
        permission: { module: 'cms', action: 'view' },
      },
      {
        key: 'cms-menus',
        label: 'Navigation Menus',
        description: 'Header mega-menu groups, footer link columns, drag-and-drop ordering, EN/BN labels, and broken/unpublished link flags',
        icon: ListTree,
        permission: { module: 'cms', action: 'view' },
      },
      {
        key: 'cms-redirects',
        label: 'Redirects',
        description: 'Manual 301/302 rules, automatic slug-change/delete 301s, loop & chain guard, CSV import/export, and hit counts',
        icon: ArrowRightLeft,
        permission: { module: 'cms', action: 'view' },
      },
      {
        key: 'cms-site-settings',
        label: 'Site Settings',
        description: 'Contact details, sales/support emails, social links, scheduled announcement bar, footer/cookie wording, default OG image, and language',
        icon: Wrench,
        permission: { module: 'cms', action: 'view' },
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
        key: 'exchange-rates',
        label: 'Exchange Rates',
        description: 'Platform baseline multi-currency rates, provider feeds, and rate history per pair',
        icon: Coins,
        badge: 'Stage 24.1',
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
        key: 'platform-announcements',
        label: 'Announcements',
        description: 'Broadcast notifications to tenants, company owners, and admins with custom severity and email delivery',
        icon: Megaphone,
        badge: 'Live',
        badgeTone: 'indigo',
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
        permission: { module: 'support', action: 'view' },
      },
      {
        key: 'global-kb',
        label: 'Global Knowledge Base',
        description: 'Cross-tenant articles, categories, and country/plan visibility',
        icon: BookOpen,
        badge: 'Global',
        badgeTone: 'emerald',
        permission: { module: 'support', action: 'view' },
      },
      {
        key: 'api-registry',
        label: 'API Apps & Keys',
        description: 'Cross-tenant API keys registry, immediate revocation, and tenant rate-limit overrides',
        icon: KeyRound,
        badge: 'Stage 22',
        badgeTone: 'indigo',
        permission: { module: 'platform', action: 'view' },
      },
      {
        key: 'webhook-monitor',
        label: 'Webhook Monitor',
        description: 'Cross-tenant outbound webhook deliveries, retry schedules, redelivery, and auto-disable',
        icon: Webhook,
        badge: 'Monitor',
        badgeTone: 'indigo',
        permission: { module: 'platform', action: 'view' },
      },
      {
        key: 'backups-compliance',
        label: 'Backups & Restore Requests',
        description: 'Scheduled backups, restore testing, dual approval restores, and GDPR data requests',
        icon: Database,
        badge: 'Live',
        badgeTone: 'emerald',
        permission: { module: 'setting', action: 'view' },
      },
      {
        key: 'system-notifications',
        label: 'Maintenance & Toggles',
        description: 'Scheduled maintenance windows, tenant banners, and global kill switches',
        icon: BellRing,
        badge: 'Live',
        badgeTone: 'emerald',
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
        key: 'language-packs',
        label: 'Language Packs',
        description: 'Supported languages, translation completeness, JSON import/export, tenant availability, and missing keys',
        icon: Languages,
        badge: 'i18n',
        badgeTone: 'emerald',
        permission: { module: 'platform', action: 'view' },
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
