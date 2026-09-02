import { useState } from 'react';
import {
  Settings,
  Bell,
  GitBranch,
  ShieldCheck,
  Webhook,
  Database,
  Globe,
  Sliders,
  Mail,
  Smartphone,
  MessageSquare,
  Key,
  Lock,
  Search,
  Plus,
  Play,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Check,
  ArrowRight,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Layers,
  FileCode,
  HardDrive,
  RefreshCw,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Toggle, Avatar } from '@/components/ui/Toggle';
import {
  notificationRules,
  notificationChannels,
  workflowList,
  sampleWorkflowNodes,
  loginHistory,
  auditLogs,
  apiKeys,
  webhooksList,
  integrationConnectors,
  backupRecords,
  currenciesList,
  languagesList,
  type NotificationRule,
  type WorkflowItem,
  type AuditLogItem,
  type ApiKeyItem,
  type WebhookItem,
  type IntegrationConnector,
  type BackupRecord,
  type CurrencyItem,
} from '@/data/settingsData';

export function SettingsHubPage() {
  const [activeGroup, setActiveGroup] = useState<
    'general' | 'notifications' | 'workflows' | 'security' | 'integrations' | 'backup-i18n'
  >('notifications');

  // ---------------- MODULE 34: NOTIFICATION ENGINE STATE ----------------
  const [rules, setRules] = useState<NotificationRule[]>(notificationRules);
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);

  const toggleChannel = (ruleId: string, channel: keyof NotificationRule['channels']) => {
    setRules((prev) =>
      prev.map((r) =>
        r.id === ruleId
          ? { ...r, channels: { ...r.channels, [channel]: !r.channels[channel] } }
          : r
      )
    );
  };

  // ---------------- MODULE 35: WORKFLOW BUILDER STATE ----------------
  const [workflows, setWorkflows] = useState<WorkflowItem[]>(workflowList);
  const [workflowMode, setWorkflowMode] = useState<'canvas' | 'list'>('canvas');
  const [activeWf, setActiveWf] = useState<WorkflowItem>(workflowList[0]);

  // ---------------- MODULE 41 & 42: SECURITY & AUDIT STATE ----------------
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [ssoEnabled, setSsoEnabled] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState(30);
  const [rateLimit, setRateLimit] = useState(120);
  const [passwordMinLength, setPasswordMinLength] = useState(10);
  const [requireSpecialChar, setRequireSpecialChar] = useState(true);
  const [requireNumbers, setRequireNumbers] = useState(true);
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLogItem | null>(auditLogs[0]);
  const [auditDiffModalOpen, setAuditDiffModalOpen] = useState(false);

  // ---------------- MODULE 43: INTEGRATIONS & API KEYS STATE ----------------
  const [keysList, setKeysList] = useState<ApiKeyItem[]>(apiKeys);
  const [webhooks, setWebhooks] = useState<WebhookItem[]>(webhooksList);
  const [connectors, setConnectors] = useState<IntegrationConnector[]>(integrationConnectors);
  const [newKeyModalOpen, setNewKeyModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);
  const [webhookPingStatus, setWebhookPingStatus] = useState<string | null>(null);

  // ---------------- MODULE 46 & 47: BACKUP & MULTI-CURRENCY STATE ----------------
  const [backups, setBackups] = useState<BackupRecord[]>(backupRecords);
  const [currencies, setCurrencies] = useState<CurrencyItem[]>(currenciesList);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [backupRunning, setBackupRunning] = useState(false);

  const handleGenerateKey = () => {
    if (!newKeyName.trim()) return;
    const secret = `sk_live_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;
    const newKey: ApiKeyItem = {
      id: `key-${Date.now()}`,
      name: newKeyName,
      prefix: secret.substring(0, 12),
      keyMasked: `${secret.substring(0, 12)}••••••••••••••••${secret.substring(secret.length - 4)}`,
      scopes: ['read:payroll', 'read:attendance', 'write:leaves'],
      createdDate: new Date().toISOString().split('T')[0],
      lastUsed: 'Never',
      status: 'Active',
    };
    setKeysList((prev) => [newKey, ...prev]);
    setGeneratedSecret(secret);
  };

  const handleRevokeKey = (id: string) => {
    setKeysList((prev) =>
      prev.map((k) => (k.id === id ? { ...k, status: 'Revoked' } : k))
    );
  };

  const handlePingWebhook = (url: string) => {
    setWebhookPingStatus(`Testing ${url}...`);
    setTimeout(() => {
      setWebhookPingStatus('✓ HTTP 200 OK — Handshake Verified in 118ms');
      setTimeout(() => setWebhookPingStatus(null), 3000);
    }, 800);
  };

  const handleRunBackupNow = () => {
    setBackupRunning(true);
    setTimeout(() => {
      const newBk: BackupRecord = {
        id: `bk-${Date.now()}`,
        filename: `nexus_hr_manual_backup_${new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14)}.enc`,
        size: '144.2 MB',
        createdDate: 'Just now',
        type: 'Manual Backup',
        status: 'Completed',
      };
      setBackups((prev) => [newBk, ...prev]);
      setBackupRunning(false);
    }, 1500);
  };

  const settingsNavItems = [
    { key: 'notifications' as const, label: 'Notification Engine', icon: Bell, badge: `${rules.length} Rules`, desc: 'Channels & Multi-Channel Triggers' },
    { key: 'workflows' as const, label: 'Workflow Builder', icon: GitBranch, badge: 'Visual', desc: 'Approval Engines & Multi-Step Logic' },
    { key: 'security' as const, label: 'Security & Audit Logs', icon: ShieldCheck, badge: 'SOC2', desc: '2FA, SSO, Login Audit & Code Diff' },
    { key: 'integrations' as const, label: 'Integrations & API', icon: Webhook, badge: 'REST API', desc: 'API Keys, Webhooks & Connectors' },
    { key: 'backup-i18n' as const, label: 'Backup & Multi-Currency', icon: Database, badge: 'i18n', desc: 'Automated Snapshots & Currencies' },
    { key: 'general' as const, label: 'General System Settings', icon: Sliders, desc: 'Timezones, Formats & System Identity' },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-primary">System Architecture & Settings Hub</h1>
        <p className="text-sm text-secondary mt-0.5">
          Enterprise configuration, notification engines, visual approval workflows, and audit security.
        </p>
      </div>

      {/* Main Settings Shell with Left Sub-Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT SUB-SIDEBAR (3 cols on desktop) */}
        <aside className="lg:col-span-3 space-y-2 surface border border-base rounded-2xl p-3 shadow-sm">
          <div className="text-[11px] font-bold text-muted uppercase tracking-wider px-3 py-2">
            System Modules
          </div>

          <nav className="space-y-1">
            {settingsNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeGroup === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveGroup(item.key)}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all ${
                    isActive
                      ? 'bg-accent-50 dark:bg-accent-950/40 border border-accent-500/40 text-accent-700 dark:text-accent-300 shadow-sm'
                      : 'border border-transparent text-secondary hover:text-primary hover:bg-[rgb(var(--bg-hover))]'
                  }`}
                >
                  <div
                    className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      isActive
                        ? 'bg-accent-600 text-white shadow-sm'
                        : 'bg-[rgb(var(--bg-muted))] text-muted'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold leading-tight truncate">{item.label}</span>
                      {item.badge && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-accent-100 dark:bg-accent-900/50 text-accent-700 dark:text-accent-300">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-muted line-clamp-1 mt-0.5">{item.desc}</span>
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* RIGHT MAIN CONTENT AREA (9 cols on desktop) */}
        <main className="lg:col-span-9 space-y-6">
          {/* ================= GROUP 1: NOTIFICATION ENGINE (MODULE 34) ================= */}
          {activeGroup === 'notifications' && (
            <div className="space-y-6">
              {/* Channel Provider Cards */}
              <div>
                <h3 className="text-sm font-bold text-primary mb-3 flex items-center gap-2">
                  <Bell className="h-4 w-4 text-accent-500" /> Multi-Channel Delivery Providers
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  {notificationChannels.map((chan) => (
                    <div
                      key={chan.id}
                      className="surface border border-base rounded-xl p-3.5 flex flex-col justify-between space-y-3 hover:border-strong transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="h-9 w-9 rounded-lg bg-accent-50 dark:bg-accent-950/40 text-accent-600 dark:text-accent-400 flex items-center justify-center">
                          {chan.type === 'Email' && <Mail className="h-4 w-4" />}
                          {chan.type === 'Push' && <Bell className="h-4 w-4" />}
                          {chan.type === 'SMS' && <MessageSquare className="h-4 w-4" />}
                          {chan.type === 'WhatsApp' && <Smartphone className="h-4 w-4" />}
                        </div>
                        <Badge
                          tone={
                            chan.status === 'Connected'
                              ? 'success'
                              : chan.status === 'Configured'
                              ? 'accent'
                              : 'neutral'
                          }
                          dot={chan.status === 'Connected'}
                        >
                          {chan.status}
                        </Badge>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-primary">{chan.name}</div>
                        <div className="text-[11px] text-muted mt-0.5">{chan.provider}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notification Rules Table with Channel Toggles & Expandable Drawer */}
              <Card>
                <CardHeader className="flex items-center justify-between">
                  <div>
                    <CardTitle>Notification Trigger Matrix</CardTitle>
                    <p className="text-xs text-secondary mt-0.5">
                      Toggle active delivery channels and configure recipient escalations per event.
                    </p>
                  </div>
                  <Badge tone="neutral">{rules.length} Trigger Rules</Badge>
                </CardHeader>
                <CardBody className="p-0">
                  <div className="divide-y divide-[rgb(var(--border-base))] text-sm">
                    {rules.map((rule) => {
                      const isExpanded = expandedRuleId === rule.id;
                      return (
                        <div key={rule.id} className="transition-colors hover:bg-[rgb(var(--bg-hover))]/50">
                          {/* Row Summary */}
                          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div
                              className="flex items-center gap-3 cursor-pointer flex-1"
                              onClick={() => setExpandedRuleId(isExpanded ? null : rule.id)}
                            >
                              <button className="text-muted hover:text-primary">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </button>
                              <div>
                                <div className="font-semibold text-primary text-xs sm:text-sm">
                                  {rule.eventName}
                                </div>
                                <div className="text-[11px] text-muted">{rule.category}</div>
                              </div>
                            </div>

                            {/* Channel Toggle Buttons */}
                            <div className="flex items-center gap-2">
                              {/* In-App */}
                              <button
                                onClick={() => toggleChannel(rule.id, 'inApp')}
                                className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                                  rule.channels.inApp
                                    ? 'bg-accent-50 text-accent-700 dark:bg-accent-950/40 dark:text-accent-300 border-accent-300 dark:border-accent-800'
                                    : 'surface border-base text-muted opacity-40'
                                }`}
                                title="In-App Notification"
                              >
                                In-App
                              </button>

                              {/* Push */}
                              <button
                                onClick={() => toggleChannel(rule.id, 'push')}
                                className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                                  rule.channels.push
                                    ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-300 dark:border-purple-800'
                                    : 'surface border-base text-muted opacity-40'
                                }`}
                                title="Mobile Push Notification"
                              >
                                Push
                              </button>

                              {/* Email */}
                              <button
                                onClick={() => toggleChannel(rule.id, 'email')}
                                className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                                  rule.channels.email
                                    ? 'bg-success-50 text-success-700 dark:bg-success-950/40 dark:text-success-300 border-success-300 dark:border-success-800'
                                    : 'surface border-base text-muted opacity-40'
                                }`}
                                title="Email Notification"
                              >
                                Email
                              </button>

                              {/* SMS */}
                              <button
                                onClick={() => toggleChannel(rule.id, 'sms')}
                                className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                                  rule.channels.sms
                                    ? 'bg-warning-50 text-warning-700 dark:bg-warning-950/40 dark:text-warning-300 border-warning-300 dark:border-warning-800'
                                    : 'surface border-base text-muted opacity-40'
                                }`}
                                title="SMS Gateway"
                              >
                                SMS
                              </button>

                              {/* WhatsApp */}
                              <button
                                onClick={() => toggleChannel(rule.id, 'whatsapp')}
                                className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                                  rule.channels.whatsapp
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                                    : 'surface border-base text-muted opacity-40'
                                }`}
                                title="WhatsApp Business"
                              >
                                WA
                              </button>
                            </div>
                          </div>

                          {/* Expandable Drawer for Recipient & Timing Config */}
                          {isExpanded && (
                            <div className="bg-[rgb(var(--bg-muted))]/60 p-4 border-t border-base space-y-3 animate-fadeIn text-xs">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <span className="text-muted block font-semibold mb-1">Target Recipients</span>
                                  <div className="flex flex-wrap gap-1">
                                    {rule.recipients.map((rcp) => (
                                      <Badge key={rcp} tone="accent">
                                        {rcp}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-muted block font-semibold mb-1">Dispatch Timing</span>
                                  <span className="text-primary font-medium">{rule.timing}</span>
                                </div>
                              </div>

                              <div>
                                <span className="text-muted block font-semibold mb-1">Notification Template Preview</span>
                                <div className="surface border border-base rounded-lg p-2.5 font-mono text-secondary text-[11px]">
                                  {rule.templatePreview}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardBody>
              </Card>
            </div>
          )}

          {/* ================= GROUP 2: APPROVAL WORKFLOW ENGINE (MODULE 35) ================= */}
          {activeGroup === 'workflows' && (
            <div className="space-y-6">
              {/* Header with Canvas / List switcher */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-accent-500" /> Multi-Step Workflow Engine
                  </h3>
                  <p className="text-xs text-secondary mt-0.5">
                    Drag-and-drop approval pipeline canvas for Leave, Expense, Payroll, and Contracts.
                  </p>
                </div>

                <div className="surface border border-base rounded-lg p-1 flex items-center gap-1">
                  <button
                    onClick={() => setWorkflowMode('canvas')}
                    className={`px-3 py-1 rounded text-xs font-semibold ${
                      workflowMode === 'canvas' ? 'bg-accent-600 text-white' : 'text-secondary hover:text-primary'
                    }`}
                  >
                    Visual Canvas
                  </button>
                  <button
                    onClick={() => setWorkflowMode('list')}
                    className={`px-3 py-1 rounded text-xs font-semibold ${
                      workflowMode === 'list' ? 'bg-accent-600 text-white' : 'text-secondary hover:text-primary'
                    }`}
                  >
                    Workflow List
                  </button>
                </div>
              </div>

              {workflowMode === 'canvas' ? (
                /* Visual Workflow Canvas */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* Left Node Library Palette (4 cols) */}
                  <div className="lg:col-span-4 space-y-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted">
                          Node Library (Drag / Insert)
                        </CardTitle>
                      </CardHeader>
                      <CardBody className="pt-0 space-y-2">
                        {[
                          { title: 'Approver Step', desc: 'Manager / HR sign-off step', color: 'border-accent-500/40 bg-accent-50/20' },
                          { title: 'Conditional Branch', desc: 'IF amount > $1,000 THEN', color: 'border-warning-500/40 bg-warning-50/20' },
                          { title: 'Automated Action', desc: 'Sync ledger / send webhook', color: 'border-success-500/40 bg-success-50/20' },
                          { title: 'SLA Escalation Timer', desc: 'Auto-escalate after 24h', color: 'border-purple-500/40 bg-purple-50/20' },
                        ].map((n) => (
                          <div
                            key={n.title}
                            className={`surface border rounded-xl p-3 cursor-grab hover:shadow-sm transition-all ${n.color}`}
                          >
                            <div className="text-xs font-bold text-primary">{n.title}</div>
                            <div className="text-[11px] text-muted mt-0.5">{n.desc}</div>
                          </div>
                        ))}
                      </CardBody>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted">
                          Active Workflows
                        </CardTitle>
                      </CardHeader>
                      <CardBody className="pt-0 space-y-1.5">
                        {workflows.map((wf) => (
                          <button
                            key={wf.id}
                            onClick={() => setActiveWf(wf)}
                            className={`w-full text-left p-2.5 rounded-lg border text-xs transition-all ${
                              activeWf.id === wf.id
                                ? 'border-accent-500 bg-accent-50/50 dark:bg-accent-950/40 font-bold text-primary'
                                : 'border-base hover:bg-[rgb(var(--bg-hover))] text-secondary'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="truncate">{wf.name}</span>
                              <Badge tone="accent" className="text-[10px]">{wf.module}</Badge>
                            </div>
                          </button>
                        ))}
                      </CardBody>
                    </Card>
                  </div>

                  {/* Right Connected Visual Node Canvas (8 cols) */}
                  <div className="lg:col-span-8">
                    <Card className="border-2 border-accent-500/30 overflow-hidden shadow-lg">
                      <div className="bg-[rgb(var(--bg-muted))] px-5 py-3 border-b border-base flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-primary">{activeWf.name}</span>
                          <span className="text-[11px] text-muted block">Module: {activeWf.module} · Trigger: {activeWf.trigger}</span>
                        </div>
                        <Button variant="primary" size="sm">
                          <Check className="h-3.5 w-3.5" /> Save Workflow
                        </Button>
                      </div>

                      <CardBody className="p-6 space-y-4">
                        {sampleWorkflowNodes.map((node, index) => (
                          <div key={node.id} className="flex flex-col items-center">
                            {/* Node Card */}
                            <div
                              className={`w-full max-w-md surface border-2 rounded-2xl p-4 shadow-sm transition-all ${
                                node.type === 'start'
                                  ? 'border-accent-500 bg-accent-50/20'
                                  : node.type === 'approver'
                                  ? 'border-success-500/50 bg-success-50/10'
                                  : node.type === 'condition'
                                  ? 'border-warning-500/50 bg-warning-50/10'
                                  : 'border-purple-500/50 bg-purple-50/10'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-primary">{node.title}</span>
                                <Badge
                                  tone={
                                    node.type === 'start'
                                      ? 'accent'
                                      : node.type === 'approver'
                                      ? 'success'
                                      : node.type === 'condition'
                                      ? 'warning'
                                      : 'neutral'
                                  }
                                  className="text-[10px]"
                                >
                                  {node.type.toUpperCase()}
                                </Badge>
                              </div>
                              <p className="text-xs text-secondary">{node.subtitle}</p>
                              {node.slaHours && (
                                <div className="text-[11px] text-muted mt-2 font-mono">
                                  ⏱ SLA: {node.slaHours} hours response window
                                </div>
                              )}
                            </div>

                            {/* Connecting Line & Arrow */}
                            {index < sampleWorkflowNodes.length - 1 && (
                              <div className="flex flex-col items-center my-1">
                                <div className="h-4 w-0.5 bg-accent-500/60" />
                                <div className="h-5 w-5 rounded-full bg-accent-500 text-white flex items-center justify-center text-[10px] shadow">
                                  <ArrowRight className="h-3 w-3 rotate-90" />
                                </div>
                                <div className="h-4 w-0.5 bg-accent-500/60" />
                              </div>
                            )}
                          </div>
                        ))}
                      </CardBody>
                    </Card>
                  </div>
                </div>
              ) : (
                /* Workflow List View */
                <Card>
                  <CardBody className="p-0">
                    <table className="w-full text-sm">
                      <thead className="bg-[rgb(var(--bg-muted))] border-b border-base">
                        <tr>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-secondary">Workflow Name</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-secondary">Module</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-secondary">Trigger</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-secondary">Steps</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-secondary">Status</th>
                          <th className="text-right px-5 py-3 text-xs font-semibold text-secondary">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[rgb(var(--border-base))]">
                        {workflows.map((wf) => (
                          <tr key={wf.id} className="hover:bg-[rgb(var(--bg-hover))]">
                            <td className="px-5 py-3.5 font-semibold text-primary text-xs">{wf.name}</td>
                            <td className="px-5 py-3.5"><Badge tone="accent">{wf.module}</Badge></td>
                            <td className="px-5 py-3.5 text-xs text-secondary">{wf.trigger}</td>
                            <td className="px-5 py-3.5 text-xs font-bold text-primary">{wf.stepsCount} Nodes</td>
                            <td className="px-5 py-3.5">
                              <Badge tone={wf.active ? 'success' : 'neutral'} dot>{wf.active ? 'Active' : 'Disabled'}</Badge>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <Button variant="secondary" size="sm" onClick={() => { setActiveWf(wf); setWorkflowMode('canvas'); }}>
                                <Pencil className="h-3.5 w-3.5" /> Edit Canvas
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardBody>
                </Card>
              )}
            </div>
          )}

          {/* ================= GROUP 3: SECURITY, 2FA & AUDIT LOG (MODULES 41 & 42) ================= */}
          {activeGroup === 'security' && (
            <div className="space-y-6">
              {/* Security Policy Form */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-accent-500" />
                    <CardTitle>Authentication & Security Policies</CardTitle>
                  </div>
                </CardHeader>
                <CardBody className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 2FA Card */}
                    <div className="surface border border-base rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-primary text-sm flex items-center gap-1.5">
                          <Lock className="h-4 w-4 text-accent-500" /> Mandatory 2-Factor Authentication (2FA)
                        </div>
                        <div className="text-xs text-secondary mt-1">
                          Enforce TOTP authenticator app or SMS OTP for all staff accounts.
                        </div>
                      </div>
                      <Toggle checked={twoFactorEnabled} onChange={() => setTwoFactorEnabled(!twoFactorEnabled)} />
                    </div>

                    {/* SSO Card */}
                    <div className="surface border border-base rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-primary text-sm flex items-center gap-1.5">
                          <Key className="h-4 w-4 text-success-500" /> SAML 2.0 Single Sign-On (SSO)
                        </div>
                        <div className="text-xs text-secondary mt-1">
                          Allow 1-click login via Okta, Azure AD, or Google Workspace.
                        </div>
                      </div>
                      <Toggle checked={ssoEnabled} onChange={() => setSsoEnabled(!ssoEnabled)} />
                    </div>
                  </div>

                  {/* Password & Session Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-base">
                    <div>
                      <div className="flex items-center justify-between mb-1 text-xs">
                        <Label>Session Inactivity Timeout</Label>
                        <span className="font-bold text-primary">{sessionTimeout} mins</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="120"
                        step="5"
                        value={sessionTimeout}
                        onChange={(e) => setSessionTimeout(parseInt(e.target.value))}
                        className="w-full accent-accent-600"
                      />
                    </div>

                    <div>
                      <Label>API Rate Limit (Req/Min/IP)</Label>
                      <Input
                        type="number"
                        value={rateLimit}
                        onChange={(e) => setRateLimit(parseInt(e.target.value) || 60)}
                      />
                    </div>

                    <div>
                      <Label>Minimum Password Length</Label>
                      <Input
                        type="number"
                        value={passwordMinLength}
                        onChange={(e) => setPasswordMinLength(parseInt(e.target.value) || 8)}
                      />
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Login History Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Login Activity & Authentication Log</CardTitle>
                </CardHeader>
                <CardBody className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[rgb(var(--bg-muted))] border-b border-base text-xs">
                        <tr>
                          <th className="text-left px-5 py-2.5 font-semibold text-secondary">User Account</th>
                          <th className="text-left px-5 py-2.5 font-semibold text-secondary">IP Address / Location</th>
                          <th className="text-left px-5 py-2.5 font-semibold text-secondary">Device & Browser</th>
                          <th className="text-left px-5 py-2.5 font-semibold text-secondary">Timestamp</th>
                          <th className="text-right px-5 py-2.5 font-semibold text-secondary">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[rgb(var(--border-base))] text-xs">
                        {loginHistory.map((lh) => (
                          <tr key={lh.id} className="hover:bg-[rgb(var(--bg-hover))]">
                            <td className="px-5 py-3 font-semibold text-primary">{lh.user}</td>
                            <td className="px-5 py-3 text-secondary font-mono">{lh.ip} ({lh.location})</td>
                            <td className="px-5 py-3 text-muted">{lh.device} · {lh.browser}</td>
                            <td className="px-5 py-3 font-mono text-muted">{lh.timestamp}</td>
                            <td className="px-5 py-3 text-right">
                              <Badge
                                tone={
                                  lh.status === 'Success'
                                    ? 'success'
                                    : lh.status === 'Blocked'
                                    ? 'error'
                                    : 'warning'
                                }
                                dot
                              >
                                {lh.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardBody>
              </Card>

              {/* Audit Log Table with Code Diff Viewer */}
              <Card>
                <CardHeader className="flex items-center justify-between">
                  <div>
                    <CardTitle>System Audit Log & State Changes</CardTitle>
                    <p className="text-xs text-secondary mt-0.5">
                      Click any row to inspect before vs after field-level differences.
                    </p>
                  </div>
                  <Badge tone="accent">Full Immutability</Badge>
                </CardHeader>
                <CardBody className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[rgb(var(--bg-muted))] border-b border-base text-xs">
                        <tr>
                          <th className="text-left px-5 py-2.5 font-semibold text-secondary">Timestamp</th>
                          <th className="text-left px-5 py-2.5 font-semibold text-secondary">User</th>
                          <th className="text-left px-5 py-2.5 font-semibold text-secondary">Action</th>
                          <th className="text-left px-5 py-2.5 font-semibold text-secondary">Target Entity</th>
                          <th className="text-right px-5 py-2.5 font-semibold text-secondary">Inspector</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[rgb(var(--border-base))] text-xs">
                        {auditLogs.map((log) => (
                          <tr
                            key={log.id}
                            onClick={() => {
                              setSelectedAuditLog(log);
                              if (log.diff) setAuditDiffModalOpen(true);
                            }}
                            className="hover:bg-[rgb(var(--bg-hover))] cursor-pointer transition-colors"
                          >
                            <td className="px-5 py-3 font-mono text-muted">{log.timestamp}</td>
                            <td className="px-5 py-3 font-semibold text-primary">{log.user}</td>
                            <td className="px-5 py-3">
                              <Badge
                                tone={
                                  log.action === 'CREATE'
                                    ? 'success'
                                    : log.action === 'UPDATE'
                                    ? 'accent'
                                    : log.action === 'DELETE'
                                    ? 'error'
                                    : 'neutral'
                                }
                              >
                                {log.action}
                              </Badge>
                            </td>
                            <td className="px-5 py-3 text-secondary font-medium">{log.record}</td>
                            <td className="px-5 py-3 text-right">
                              {log.diff ? (
                                <span className="text-accent-600 font-semibold flex items-center justify-end gap-1">
                                  <FileCode className="h-3.5 w-3.5" /> View Diff
                                </span>
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardBody>
              </Card>
            </div>
          )}

          {/* ================= GROUP 4: INTEGRATIONS, APIS & WEBHOOKS (MODULE 43) ================= */}
          {activeGroup === 'integrations' && (
            <div className="space-y-6">
              {/* API Keys Table */}
              <Card>
                <CardHeader className="flex items-center justify-between">
                  <div>
                    <CardTitle>REST API Keys</CardTitle>
                    <p className="text-xs text-secondary mt-0.5">
                      Bearer tokens for server-to-server automated HRMS integrations.
                    </p>
                  </div>
                  <Button variant="primary" size="sm" onClick={() => { setNewKeyName(''); setGeneratedSecret(null); setNewKeyModalOpen(true); }}>
                    <Plus className="h-3.5 w-3.5" /> Generate Key
                  </Button>
                </CardHeader>
                <CardBody className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[rgb(var(--bg-muted))] border-b border-base text-xs">
                        <tr>
                          <th className="text-left px-5 py-2.5 font-semibold text-secondary">Key Identifier</th>
                          <th className="text-left px-5 py-2.5 font-semibold text-secondary">Token Value</th>
                          <th className="text-left px-5 py-2.5 font-semibold text-secondary">Scopes</th>
                          <th className="text-left px-5 py-2.5 font-semibold text-secondary">Status</th>
                          <th className="text-right px-5 py-2.5 font-semibold text-secondary">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[rgb(var(--border-base))] text-xs">
                        {keysList.map((k) => (
                          <tr key={k.id} className="hover:bg-[rgb(var(--bg-hover))]">
                            <td className="px-5 py-3 font-semibold text-primary">{k.name}</td>
                            <td className="px-5 py-3 font-mono text-muted">{k.keyMasked}</td>
                            <td className="px-5 py-3">
                              <div className="flex flex-wrap gap-1">
                                {k.scopes.map((s) => (
                                  <span key={s} className="px-1.5 py-0.5 rounded bg-[rgb(var(--bg-muted))] font-mono text-[10px]">
                                    {s}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-5 py-3">
                              <Badge tone={k.status === 'Active' ? 'success' : 'neutral'} dot>{k.status}</Badge>
                            </td>
                            <td className="px-5 py-3 text-right">
                              {k.status === 'Active' ? (
                                <Button variant="danger" size="sm" onClick={() => handleRevokeKey(k.id)}>
                                  Revoke
                                </Button>
                              ) : (
                                <span className="text-muted">Revoked</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardBody>
              </Card>

              {/* Webhooks Section */}
              <Card>
                <CardHeader className="flex items-center justify-between">
                  <div>
                    <CardTitle>Outgoing Webhooks</CardTitle>
                    <p className="text-xs text-secondary mt-0.5">Real-time HTTP POST payload dispatchers.</p>
                  </div>
                  {webhookPingStatus && (
                    <span className="text-xs text-success-600 font-semibold animate-fadeIn">
                      {webhookPingStatus}
                    </span>
                  )}
                </CardHeader>
                <CardBody className="p-0">
                  <div className="divide-y divide-[rgb(var(--border-base))] text-xs">
                    {webhooks.map((wh) => (
                      <div key={wh.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="font-mono font-semibold text-primary">{wh.url}</div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {wh.events.map((e) => (
                              <Badge key={e} tone="accent" className="text-[10px] font-mono">{e}</Badge>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-muted font-mono">{wh.lastTriggered}</span>
                          <Button variant="secondary" size="sm" onClick={() => handlePingWebhook(wh.url)}>
                            <Play className="h-3 w-3" /> Test Ping
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>

              {/* Third-Party Connectors Grid */}
              <div>
                <h3 className="text-sm font-bold text-primary mb-3">Enterprise Connectors & Ecosystem</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {connectors.map((c) => (
                    <Card key={c.id} className="hover:shadow-card-hover transition-shadow flex flex-col justify-between">
                      <CardHeader className="pb-2 flex items-start justify-between">
                        <CardTitle className="text-sm font-bold">{c.name}</CardTitle>
                        <Badge tone={c.status === 'Connected' ? 'success' : 'neutral'} dot={c.status === 'Connected'}>
                          {c.status}
                        </Badge>
                      </CardHeader>
                      <CardBody className="pt-0 space-y-3 flex-1 flex flex-col justify-between">
                        <p className="text-xs text-secondary">{c.description}</p>
                        <div className="flex items-center justify-between pt-2 border-t border-base text-xs">
                          <span className="text-muted">{c.syncFrequency}</span>
                          <Button variant="secondary" size="sm">Configure</Button>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================= GROUP 5: BACKUP & MULTI-CURRENCY / I18N (MODULES 46 & 47) ================= */}
          {activeGroup === 'backup-i18n' && (
            <div className="space-y-6">
              {/* Backups Card */}
              <Card>
                <CardHeader className="flex items-center justify-between">
                  <div>
                    <CardTitle>Disaster Recovery & Encrypted Snapshots</CardTitle>
                    <p className="text-xs text-secondary mt-0.5">Automated AES-256 encrypted database backups.</p>
                  </div>
                  <Button variant="primary" size="sm" onClick={handleRunBackupNow} disabled={backupRunning}>
                    <HardDrive className="h-3.5 w-3.5" />
                    {backupRunning ? 'Backing Up...' : 'Run Backup Now'}
                  </Button>
                </CardHeader>
                <CardBody className="p-0">
                  <table className="w-full text-sm">
                    <thead className="bg-[rgb(var(--bg-muted))] border-b border-base text-xs">
                      <tr>
                        <th className="text-left px-5 py-2.5 font-semibold text-secondary">Snapshot Filename</th>
                        <th className="text-left px-5 py-2.5 font-semibold text-secondary">Type</th>
                        <th className="text-left px-5 py-2.5 font-semibold text-secondary">File Size</th>
                        <th className="text-left px-5 py-2.5 font-semibold text-secondary">Created Timestamp</th>
                        <th className="text-right px-5 py-2.5 font-semibold text-secondary">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgb(var(--border-base))] text-xs">
                      {backups.map((bk) => (
                        <tr key={bk.id} className="hover:bg-[rgb(var(--bg-hover))]">
                          <td className="px-5 py-3 font-mono text-primary font-semibold">{bk.filename}</td>
                          <td className="px-5 py-3"><Badge tone="accent">{bk.type}</Badge></td>
                          <td className="px-5 py-3 font-bold text-primary">{bk.size}</td>
                          <td className="px-5 py-3 text-muted">{bk.createdDate}</td>
                          <td className="px-5 py-3 text-right">
                            <Button variant="secondary" size="sm" onClick={() => alert(`Restoring from ${bk.filename}...`)}>
                              <RotateCcw className="h-3 w-3" /> Restore
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardBody>
              </Card>

              {/* Multi-Currency & Language i18n */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Multi-Currency */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Globe className="h-4 w-4 text-accent-500" /> Multi-Currency Exchange Rates
                    </CardTitle>
                  </CardHeader>
                  <CardBody className="p-0">
                    <table className="w-full text-xs">
                      <thead className="bg-[rgb(var(--bg-muted))] border-b border-base">
                        <tr>
                          <th className="text-left px-4 py-2 font-semibold text-secondary">Currency</th>
                          <th className="text-left px-4 py-2 font-semibold text-secondary">Symbol</th>
                          <th className="text-right px-4 py-2 font-semibold text-secondary">Rate (vs USD)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[rgb(var(--border-base))]">
                        {currencies.map((c) => (
                          <tr key={c.code}>
                            <td className="px-4 py-2.5 font-bold text-primary">{c.name} ({c.code})</td>
                            <td className="px-4 py-2.5 font-mono text-secondary">{c.symbol}</td>
                            <td className="px-4 py-2.5 text-right font-mono font-semibold text-primary">
                              {c.isBase ? '1.00 (Base)' : c.exchangeRate}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardBody>
                </Card>

                {/* Language i18n */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Globe className="h-4 w-4 text-success-500" /> Supported UI Languages (i18n)
                    </CardTitle>
                  </CardHeader>
                  <CardBody className="space-y-2">
                    {languagesList.map((l) => (
                      <div
                        key={l.code}
                        onClick={() => setSelectedLanguage(l.code)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          selectedLanguage === l.code
                            ? 'border-accent-500 bg-accent-50/40 dark:bg-accent-950/30'
                            : 'border-base hover:bg-[rgb(var(--bg-hover))]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg">{l.flag}</span>
                          <div>
                            <div className="text-xs font-bold text-primary">{l.nativeName} ({l.name})</div>
                            <div className="text-[10px] text-muted">{l.progressPct}% Translated</div>
                          </div>
                        </div>
                        {selectedLanguage === l.code && <Badge tone="success">Selected</Badge>}
                      </div>
                    ))}
                  </CardBody>
                </Card>
              </div>
            </div>
          )}

          {/* ================= GROUP 6: GENERAL SYSTEM SETTINGS ================= */}
          {activeGroup === 'general' && (
            <Card>
              <CardHeader>
                <CardTitle>System Identity & Global Formatting</CardTitle>
              </CardHeader>
              <CardBody className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Organization / System Name</Label>
                    <Input defaultValue="Nexus HR Technologies Inc." />
                  </div>
                  <div>
                    <Label>Default System Timezone</Label>
                    <Select defaultValue="America/Los_Angeles">
                      <option value="America/Los_Angeles">Pacific Time (US & Canada) - GMT-07:00</option>
                      <option value="America/New_York">Eastern Time (US & Canada) - GMT-04:00</option>
                      <option value="Europe/London">London / GMT - GMT+01:00</option>
                      <option value="Asia/Dhaka">Dhaka / Bangladesh Standard Time - GMT+06:00</option>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label>Date Format</Label>
                    <Select defaultValue="YYYY-MM-DD">
                      <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    </Select>
                  </div>
                  <div>
                    <Label>Number & Currency Format</Label>
                    <Select defaultValue="1,234.56">
                      <option value="1,234.56">1,234.56 (Standard)</option>
                      <option value="1.234,56">1.234,56 (European)</option>
                    </Select>
                  </div>
                  <div>
                    <Label>Fiscal Year Start Month</Label>
                    <Select defaultValue="January">
                      <option value="January">January</option>
                      <option value="April">April</option>
                      <option value="July">July</option>
                    </Select>
                  </div>
                </div>

                <div className="pt-4 border-t border-base flex justify-end">
                  <Button variant="primary">
                    <Check className="h-4 w-4" /> Save System Preferences
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}
        </main>
      </div>

      {/* ================= MODAL: AUDIT CODE DIFF VIEWER ================= */}
      <Modal
        open={auditDiffModalOpen}
        onClose={() => setAuditDiffModalOpen(false)}
        title={`Audit State Inspector: ${selectedAuditLog?.record}`}
        description={`User: ${selectedAuditLog?.user} · Action: ${selectedAuditLog?.action} · IP: ${selectedAuditLog?.ip}`}
        footer={
          <Button variant="secondary" onClick={() => setAuditDiffModalOpen(false)}>
            Close Inspector
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="text-xs font-semibold text-primary">Field-Level Changes:</div>
          <div className="surface border border-base rounded-xl overflow-hidden font-mono text-xs">
            {selectedAuditLog?.diff?.map((d) => (
              <div key={d.field} className="divide-y divide-[rgb(var(--border-base))]">
                <div className="bg-[rgb(var(--bg-muted))] px-3 py-1.5 font-bold text-primary text-[11px]">
                  Property: {d.field}
                </div>
                <div className="bg-error-50/40 dark:bg-error-950/40 text-error-700 dark:text-error-300 px-3 py-1 flex items-center gap-2">
                  <span className="font-bold">-</span> {d.before}
                </div>
                <div className="bg-success-50/40 dark:bg-success-950/40 text-success-700 dark:text-success-300 px-3 py-1 flex items-center gap-2">
                  <span className="font-bold">+</span> {d.after}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* ================= MODAL: GENERATE NEW API KEY ================= */}
      <Modal
        open={newKeyModalOpen}
        onClose={() => setNewKeyModalOpen(false)}
        title="Generate REST API Key"
        description="Create an encrypted bearer token for third-party API integration."
        footer={
          <>
            <Button variant="secondary" onClick={() => setNewKeyModalOpen(false)}>
              Close
            </Button>
            {!generatedSecret && (
              <Button variant="primary" onClick={handleGenerateKey}>
                Generate Token
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-4">
          {!generatedSecret ? (
            <div>
              <Label>Integration / Key Name</Label>
              <Input
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g. Turnstile Terminal Connector"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-warning-50 dark:bg-warning-950/40 border border-warning-300 dark:border-warning-800 text-warning-800 dark:text-warning-300 text-xs">
                ⚠️ Make sure to copy your API secret now. You will not be able to view it again!
              </div>
              <div>
                <Label>Secret API Key</Label>
                <div className="flex items-center gap-2">
                  <Input readOnly value={generatedSecret} className="font-mono text-xs bg-surface" />
                  <Button
                    variant="secondary"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedSecret);
                      alert('API key copied to clipboard!');
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

