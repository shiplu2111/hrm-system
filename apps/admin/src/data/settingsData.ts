export interface NotificationRule {
  id: string;
  eventName: string;
  category: 'Leave & Attendance' | 'Payroll & Finance' | 'HR & Lifecycle' | 'Security & System';
  channels: {
    inApp: boolean;
    push: boolean;
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
  };
  recipients: string[];
  timing: string;
  templatePreview: string;
  active: boolean;
}

export interface NotificationChannel {
  id: string;
  name: string;
  provider: string;
  type: 'In-App' | 'Push' | 'Email' | 'SMS' | 'WhatsApp';
  status: 'Connected' | 'Configured' | 'Coming Soon' | 'Disabled';
  description: string;
  iconName: string;
}

export interface WorkflowItem {
  id: string;
  name: string;
  module: 'Leave' | 'Expense' | 'Payroll' | 'Contract' | 'Promotion';
  trigger: string;
  stepsCount: number;
  active: boolean;
  author: string;
  lastModified: string;
}

export interface WorkflowNode {
  id: string;
  type: 'start' | 'approver' | 'condition' | 'action' | 'end';
  title: string;
  subtitle: string;
  assigneeRole?: string;
  conditionCriteria?: string;
  slaHours?: number;
}

export interface LoginHistoryItem {
  id: string;
  user: string;
  role: string;
  ip: string;
  location: string;
  device: string;
  browser: string;
  timestamp: string;
  status: 'Success' | 'Blocked' | 'Geo-Anomaly';
}

export interface AuditDiff {
  field: string;
  before: string;
  after: string;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  user: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'APPROVE';
  module: 'Payroll' | 'Employees' | 'Attendance' | 'Settings' | 'Security';
  record: string;
  ip: string;
  diff?: AuditDiff[];
}

export interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  keyMasked: string;
  scopes: string[];
  createdDate: string;
  lastUsed: string;
  status: 'Active' | 'Revoked';
}

export interface WebhookItem {
  id: string;
  url: string;
  events: string[];
  status: 'Active' | 'Failed' | 'Paused';
  successRate: string;
  lastTriggered: string;
  secret: string;
}

export interface IntegrationConnector {
  id: string;
  name: string;
  category: 'Accounting' | 'Banking' | 'Hardware & Biometrics' | 'Productivity & Chat' | 'Single Sign-On';
  description: string;
  status: 'Connected' | 'Not Connected' | 'Configuring';
  authType: string;
  syncFrequency: string;
  lastSync?: string;
  badge?: string;
}

export interface BackupRecord {
  id: string;
  filename: string;
  size: string;
  createdDate: string;
  type: 'Automated Daily' | 'Pre-Payroll Snapshot' | 'Manual Backup';
  status: 'Completed' | 'Restored' | 'Archived';
}

export interface CurrencyItem {
  code: string;
  name: string;
  symbol: string;
  exchangeRate: number; // relative to USD base
  isBase: boolean;
  status: 'Active' | 'Inactive';
}

export interface LanguageItem {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  progressPct: number;
}

// ---------------- MOCK DATA CONSTANTS ----------------

export const notificationRules: NotificationRule[] = [
  {
    id: 'nr-1',
    eventName: 'Leave Request Approved / Rejected',
    category: 'Leave & Attendance',
    channels: { inApp: true, push: true, email: true, sms: false, whatsapp: false },
    recipients: ['Employee', 'Approving Manager'],
    timing: 'Immediate on status transition',
    templatePreview: 'Your {leave_type} request for {start_date} to {end_date} has been {status}.',
    active: true,
  },
  {
    id: 'nr-2',
    eventName: 'Payroll Run Finalized & Payslip Published',
    category: 'Payroll & Finance',
    channels: { inApp: true, push: true, email: true, sms: true, whatsapp: false },
    recipients: ['All Active Employees on Pay Run'],
    timing: '00:00 on Disbursement Date',
    templatePreview: 'Your payslip for {period_name} is ready for download. Net Pay: {net_amount}.',
    active: true,
  },
  {
    id: 'nr-3',
    eventName: 'Employee Document / Passport Expiring Soon',
    category: 'HR & Lifecycle',
    channels: { inApp: true, push: false, email: true, sms: false, whatsapp: false },
    recipients: ['Employee', 'HR Operations Team'],
    timing: '30 days, 15 days, and 7 days prior to expiry',
    templatePreview: 'Reminder: Your document {document_name} is set to expire on {expiry_date}. Please submit renewal.',
    active: true,
  },
  {
    id: 'nr-4',
    eventName: 'Overtime Claim Submitted by Direct Report',
    category: 'Leave & Attendance',
    channels: { inApp: true, push: true, email: true, sms: false, whatsapp: false },
    recipients: ['Direct Reporting Manager'],
    timing: 'Immediate on submission',
    templatePreview: '{employee_name} has claimed {ot_hours} hours of overtime for {work_date}. Action required.',
    active: true,
  },
  {
    id: 'nr-5',
    eventName: 'Expense Claim Approved for Payroll',
    category: 'Payroll & Finance',
    channels: { inApp: true, push: false, email: true, sms: false, whatsapp: false },
    recipients: ['Employee', 'Finance Accounts Payable'],
    timing: 'Immediate on Finance sign-off',
    templatePreview: 'Your expense claim {claim_id} for {amount} has been approved and queued for next pay cycle.',
    active: true,
  },
  {
    id: 'nr-6',
    eventName: 'Suspicious / Unauthorized Device Check-In',
    category: 'Security & System',
    channels: { inApp: true, push: true, email: true, sms: true, whatsapp: false },
    recipients: ['Security Admin', 'HR Director', 'Affected Employee'],
    timing: 'Immediate real-time alert',
    templatePreview: 'Security Warning: Attendance punch attempted from unrecognized device {device_name} at {time}.',
    active: true,
  },
];

export const notificationChannels: NotificationChannel[] = [
  {
    id: 'chan-email',
    name: 'Transactional Email (SMTP / SES)',
    provider: 'Amazon SES / SendGrid / Custom SMTP',
    type: 'Email',
    status: 'Connected',
    description: 'Delivers payslips, password resets, onboarding letters, and daily digest alerts.',
    iconName: 'Mail',
  },
  {
    id: 'chan-push',
    name: 'Mobile Push Notifications',
    provider: 'Firebase Cloud Messaging (FCM) & APNs',
    type: 'Push',
    status: 'Connected',
    description: 'Sends instant alerts for shift changes, punch confirmations, and approvals.',
    iconName: 'Bell',
  },
  {
    id: 'chan-sms',
    name: 'SMS Gateway Delivery',
    provider: 'Twilio Cloud SMS API',
    type: 'SMS',
    status: 'Configured',
    description: 'High-priority 2FA OTP codes, security anomalies, and urgent emergency alerts.',
    iconName: 'MessageSquare',
  },
  {
    id: 'chan-wa',
    name: 'WhatsApp Business API',
    provider: 'Meta Cloud API for WhatsApp',
    type: 'WhatsApp',
    status: 'Coming Soon',
    description: 'Direct conversational check-ins, leave requests, and digital payslip delivery.',
    iconName: 'Smartphone',
  },
];

export const workflowList: WorkflowItem[] = [
  {
    id: 'wf-1',
    name: 'Standard Leave Approval Workflow (2-Tier)',
    module: 'Leave',
    trigger: 'Employee submits Leave Request > 2 days',
    stepsCount: 4,
    active: true,
    author: 'Alex Morgan (HR Director)',
    lastModified: '2024-08-20',
  },
  {
    id: 'wf-2',
    name: 'High-Value Expense Multi-Level Authorization',
    module: 'Expense',
    trigger: 'Expense claim exceeds $1,000 threshold',
    stepsCount: 5,
    active: true,
    author: 'John Smith (VP Finance)',
    lastModified: '2024-08-15',
  },
  {
    id: 'wf-3',
    name: 'Monthly Payroll Lock & Finalization Pipeline',
    module: 'Payroll',
    trigger: 'Payroll run reaches Step 4 (Audit)',
    stepsCount: 4,
    active: true,
    author: 'Alex Morgan',
    lastModified: '2024-08-24',
  },
  {
    id: 'wf-4',
    name: 'Employee Role Promotion & Compensation Hike',
    module: 'Promotion',
    trigger: 'Lifecycle Event: Promotion initiated',
    stepsCount: 4,
    active: true,
    author: 'Sarah Chen (VP Eng)',
    lastModified: '2024-07-30',
  },
];

export const sampleWorkflowNodes: WorkflowNode[] = [
  {
    id: 'node-start',
    type: 'start',
    title: 'Start: Request Submitted',
    subtitle: 'Event: Employee files leave request',
  },
  {
    id: 'node-mgr',
    type: 'approver',
    title: 'Step 1: Direct Manager Review',
    subtitle: 'Approver: Reporting Manager',
    assigneeRole: 'Direct Reporting Manager',
    slaHours: 24,
  },
  {
    id: 'node-cond',
    type: 'condition',
    title: 'Condition: Leave Duration > 3 Days?',
    subtitle: 'Branch evaluation for HR escalation',
    conditionCriteria: 'duration_days > 3',
  },
  {
    id: 'node-hr',
    type: 'approver',
    title: 'Step 2: HR Operations Sign-Off',
    subtitle: 'Approver: HR Department Admin',
    assigneeRole: 'HR Operations Lead',
    slaHours: 48,
  },
  {
    id: 'node-end',
    type: 'end',
    title: 'End: Approval Finalized',
    subtitle: 'Action: Auto-update roster & leave balance',
  },
];

export const loginHistory: LoginHistoryItem[] = [
  {
    id: 'lh-1',
    user: 'Sarah Chen (sarah.chen@acme.com)',
    role: 'VP Engineering',
    ip: '198.51.100.45',
    location: 'San Francisco, CA, US',
    device: 'MacBook Pro 16',
    browser: 'Chrome 128.0 (macOS)',
    timestamp: '2024-08-25 16:04:12',
    status: 'Success',
  },
  {
    id: 'lh-2',
    user: 'Alex Morgan (alex.m@acme.com)',
    role: 'HR Director / Super Admin',
    ip: '198.51.100.12',
    location: 'San Francisco, CA, US',
    device: 'Dell Precision 5570',
    browser: 'Firefox 129.0 (Windows)',
    timestamp: '2024-08-25 15:42:00',
    status: 'Success',
  },
  {
    id: 'lh-3',
    user: 'Marcus Johnson (marcus.j@acme.com)',
    role: 'VP Sales',
    ip: '104.28.19.88',
    location: 'New York, NY, US',
    device: 'iPhone 15 Pro',
    browser: 'Mobile Safari 17.5',
    timestamp: '2024-08-25 14:15:30',
    status: 'Success',
  },
  {
    id: 'lh-4',
    user: 'Unknown Attempt (target: admin@acme.com)',
    role: 'Unauthenticated',
    ip: '185.220.101.5',
    location: 'Frankfurt, Germany (Tor Exit Node)',
    device: 'Linux x86_64',
    browser: 'HeadlessChrome / Curl',
    timestamp: '2024-08-25 03:14:02',
    status: 'Blocked',
  },
  {
    id: 'lh-5',
    user: 'James Park (james.p@acme.com)',
    role: 'Software Engineer',
    ip: '157.240.241.35',
    location: 'London, UK (VPN Anomaly)',
    device: 'iPad Air 5th Gen',
    browser: 'Safari (iPadOS)',
    timestamp: '2024-08-24 19:22:15',
    status: 'Geo-Anomaly',
  },
];

export const auditLogs: AuditLogItem[] = [
  {
    id: 'aud-101',
    timestamp: '2024-08-25 15:30:22',
    user: 'Alex Morgan (Super Admin)',
    action: 'UPDATE',
    module: 'Payroll',
    record: 'Salary Structure: Marcus Johnson (EMP-002)',
    ip: '198.51.100.12',
    diff: [
      { field: 'basicSalary', before: '$6,500.00', after: '$6,875.00' },
      { field: 'specialAllowance', before: '$2,200.00', after: '$2,575.00' },
      { field: 'grossSalary', before: '$13,000.00', after: '$13,750.00' },
    ],
  },
  {
    id: 'aud-102',
    timestamp: '2024-08-25 14:45:10',
    user: 'Sarah Chen (VP Eng)',
    action: 'APPROVE',
    module: 'Attendance',
    record: 'Overtime Claim #OT-2024-089 (Nina Garcia)',
    ip: '198.51.100.45',
    diff: [
      { field: 'status', before: 'Pending Manager', after: 'Approved' },
      { field: 'approvedHours', before: '0 hrs', after: '3.0 hrs' },
    ],
  },
  {
    id: 'aud-103',
    timestamp: '2024-08-25 11:20:00',
    user: 'Alex Morgan (Super Admin)',
    action: 'CREATE',
    module: 'Settings',
    record: 'Geofence Zone: London Innovation Hub',
    ip: '198.51.100.12',
    diff: [
      { field: 'zoneName', before: '<null>', after: 'London Innovation Hub' },
      { field: 'radius', before: '<null>', after: '250 meters' },
      { field: 'strictGps', before: '<null>', after: 'true' },
    ],
  },
  {
    id: 'aud-104',
    timestamp: '2024-08-24 18:00:15',
    user: 'John Smith (VP Finance)',
    action: 'EXPORT',
    module: 'Payroll',
    record: 'Bank Transfer NACHA File (Batch #202408-01)',
    ip: '198.51.100.30',
  },
  {
    id: 'aud-105',
    timestamp: '2024-08-24 16:12:00',
    user: 'Alex Morgan (Super Admin)',
    action: 'DELETE',
    module: 'Employees',
    record: 'Custom Field: "Emergency Blood Group" (Field #CF-09)',
    ip: '198.51.100.12',
  },
];

export const apiKeys: ApiKeyItem[] = [
  {
    id: 'key-1',
    name: 'Production Core HR & Payroll API',
    prefix: 'sk_live_9482',
    keyMasked: 'sk_live_9482••••••••••••••••3a9f',
    scopes: ['read:employees', 'write:payroll', 'read:attendance', 'write:leaves'],
    createdDate: '2024-01-15',
    lastUsed: 'Just now (4s ago)',
    status: 'Active',
  },
  {
    id: 'key-2',
    name: 'Biometric Turnstile Terminal Sync Key',
    prefix: 'sk_live_1102',
    keyMasked: 'sk_live_1102••••••••••••••••7c41',
    scopes: ['read:attendance', 'write:attendance', 'read:devices'],
    createdDate: '2024-03-10',
    lastUsed: '12m ago',
    status: 'Active',
  },
  {
    id: 'key-3',
    name: 'Staging & Sandbox Integration Key',
    prefix: 'sk_test_8819',
    keyMasked: 'sk_test_8819••••••••••••••••55b2',
    scopes: ['read:*', 'write:*'],
    createdDate: '2024-06-01',
    lastUsed: '2 days ago',
    status: 'Active',
  },
  {
    id: 'key-4',
    name: 'Legacy QuickBooks Exporter (Revoked)',
    prefix: 'sk_live_0091',
    keyMasked: 'sk_live_0091••••••••••••••••99e1',
    scopes: ['read:payroll'],
    createdDate: '2023-05-12',
    lastUsed: 'May 2024',
    status: 'Revoked',
  },
];

export const webhooksList: WebhookItem[] = [
  {
    id: 'wh-1',
    url: 'https://api.acme.com/webhooks/hr-events',
    events: ['employee.created', 'employee.terminated', 'payroll.finalized'],
    status: 'Active',
    successRate: '99.9%',
    lastTriggered: '10m ago (HTTP 200)',
    secret: 'whsec_98401928419028',
  },
  {
    id: 'wh-2',
    url: 'https://hooks.slack.com/services/T00/B00/XXXX',
    events: ['leave.approved', 'ot.submitted', 'anniversary.today'],
    status: 'Active',
    successRate: '100%',
    lastTriggered: '1h ago (HTTP 200)',
    secret: 'whsec_slack_channel_feed',
  },
  {
    id: 'wh-3',
    url: 'https://finance.acme-erp.internal/sync/payroll',
    events: ['payroll.paid', 'expense.reimbursed'],
    status: 'Active',
    successRate: '98.5%',
    lastTriggered: 'Aug 20 (HTTP 200)',
    secret: 'whsec_erp_sync_secure',
  },
];

export const integrationConnectors: IntegrationConnector[] = [
  {
    id: 'int-1',
    name: 'QuickBooks Online / Desktop',
    category: 'Accounting',
    description: 'Auto-sync monthly payroll journals, tax liabilities, and expense bills to QuickBooks General Ledger.',
    status: 'Connected',
    authType: 'OAuth 2.0 (Intuit)',
    syncFrequency: 'Real-time on Run Finalize',
    lastSync: 'Aug 30, 2024 18:05',
    badge: 'Popular',
  },
  {
    id: 'int-2',
    name: 'Xero Cloud Accounting',
    category: 'Accounting',
    description: 'Push chart-of-accounts journal entries, invoice reconciliation, and tax deductions.',
    status: 'Not Connected',
    authType: 'OAuth 2.0',
    syncFrequency: 'On Demand',
  },
  {
    id: 'int-3',
    name: 'Slack Notification & Bot',
    category: 'Productivity & Chat',
    description: 'Interactive /clockin punches, leave approval notifications, and company birthday broadcasts.',
    status: 'Connected',
    authType: 'Slack App Bot Token',
    syncFrequency: 'Instant Webhook',
    lastSync: 'Just now',
    badge: 'Active Bot',
  },
  {
    id: 'int-4',
    name: 'Microsoft Teams Integration',
    category: 'Productivity & Chat',
    description: 'Approvals hub integration, Teams bot commands, and calendar holiday sync.',
    status: 'Not Connected',
    authType: 'Azure AD App',
    syncFrequency: 'Real-time',
  },
  {
    id: 'int-5',
    name: 'Okta & Azure AD Single Sign-On (SAML 2.0)',
    category: 'Single Sign-On',
    description: 'Enterprise SSO, SCIM 2.0 automated user provisioning, and role sync from Active Directory.',
    status: 'Connected',
    authType: 'SAML 2.0 / SCIM 2.0',
    syncFrequency: 'Continuous Sync',
    lastSync: 'Today at 16:00',
    badge: 'Enterprise Security',
  },
  {
    id: 'int-6',
    name: 'ZKTeco & Anviz Biometric Terminals',
    category: 'Hardware & Biometrics',
    description: 'Direct TCP/IP and cloud sync for hardware fingerprint, RFID, and face turnstile readers.',
    status: 'Connected',
    authType: 'Encrypted Machine SDK',
    syncFrequency: 'Every 5 Minutes',
    lastSync: '4m ago (14 devices online)',
  },
  {
    id: 'int-7',
    name: 'Google Workspace & Google Calendar',
    category: 'Productivity & Chat',
    description: 'Sync approved leaves and company holidays directly into employee Google Calendars.',
    status: 'Connected',
    authType: 'Google Service Account',
    syncFrequency: 'Bi-directional Sync',
    lastSync: '1h ago',
  },
];

export const backupRecords: BackupRecord[] = [
  {
    id: 'bk-1',
    filename: 'nexus_hr_full_backup_20240825_020000.enc',
    size: '142.8 MB',
    createdDate: '2024-08-25 02:00 UTC',
    type: 'Automated Daily',
    status: 'Completed',
  },
  {
    id: 'bk-2',
    filename: 'nexus_hr_snapshot_aug_payroll_finalized.enc',
    size: '138.4 MB',
    createdDate: '2024-08-24 18:30 UTC',
    type: 'Pre-Payroll Snapshot',
    status: 'Completed',
  },
  {
    id: 'bk-3',
    filename: 'nexus_hr_full_backup_20240824_020000.enc',
    size: '137.9 MB',
    createdDate: '2024-08-24 02:00 UTC',
    type: 'Automated Daily',
    status: 'Completed',
  },
  {
    id: 'bk-4',
    filename: 'nexus_hr_manual_pre_migration_backup.enc',
    size: '132.1 MB',
    createdDate: '2024-08-15 14:00 UTC',
    type: 'Manual Backup',
    status: 'Restored',
  },
];

export const currenciesList: CurrencyItem[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 1.0, isBase: true, status: 'Active' },
  { code: 'GBP', name: 'British Pound', symbol: '£', exchangeRate: 0.76, isBase: false, status: 'Active' },
  { code: 'EUR', name: 'Euro', symbol: '€', exchangeRate: 0.90, isBase: false, status: 'Active' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', exchangeRate: 1.35, isBase: false, status: 'Active' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', exchangeRate: 1.48, isBase: false, status: 'Active' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', exchangeRate: 83.85, isBase: false, status: 'Active' },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', exchangeRate: 119.5, isBase: false, status: 'Active' },
];

export const languagesList: LanguageItem[] = [
  { code: 'en', name: 'English (US)', nativeName: 'English (US)', flag: '🇺🇸', progressPct: 100 },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🇧🇩', progressPct: 98 },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', progressPct: 95 },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', progressPct: 92 },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', progressPct: 90 },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇦🇪', progressPct: 85 },
];

