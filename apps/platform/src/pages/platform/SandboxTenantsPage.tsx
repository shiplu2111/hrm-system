import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Filter,
  FlaskConical,
  Globe,
  HelpCircle,
  KeyRound,
  Layers,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react';
import type {
  CreateSandboxTenantDto,
  SandboxDemoTemplate,
  SandboxTenantSummary,
} from '@hrm/shared-types';
import {
  createSandboxTenant,
  deleteSandboxTenant,
  fetchSandboxTenants,
  resetSandboxTenant,
} from '@/lib/api-client';
import { PermissionGate } from '@/components/rbac';
import { usePermissions } from '@/hooks/usePermission';

const TEMPLATE_META: Record<
  SandboxDemoTemplate,
  {
    name: string;
    description: string;
    departments: string[];
    employeeCount: number;
    tone: string;
    badgeBg: string;
    badgeText: string;
  }
> = {
  tech_saas: {
    name: 'Tech SaaS & Startups',
    description:
      'Fast-growth tech workspace with Product, Engineering, Sales, and Ops. Features flexible time-off, remote punches, and stock options.',
    departments: ['Engineering', 'Product & Design', 'Sales & Customer Success', 'Marketing', 'People & Ops'],
    employeeCount: 48,
    tone: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400',
    badgeBg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800',
    badgeText: 'text-indigo-700 dark:text-indigo-300',
  },
  retail_hospitality: {
    name: 'Retail & Hospitality',
    description:
      'Store-based retail chain with multi-location branches, shift worker scheduling, strict geofenced punching, and hourly overtime.',
    departments: ['Store Operations', 'Inventory & Logistics', 'Visual Merchandising', 'Customer Support', 'Administration'],
    employeeCount: 120,
    tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
  },
  enterprise_healthcare: {
    name: 'Enterprise Healthcare',
    description:
      'Multi-department clinical hospital system with strict compliance, 24/7 rotational shifts, credential tracking, and on-call payroll.',
    departments: ['Clinical Care', 'Emergency Medicine', 'Nursing & Inpatient', 'Pharmacy & Lab', 'Hospital Administration'],
    employeeCount: 250,
    tone: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400',
    badgeBg: 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-800',
    badgeText: 'text-cyan-700 dark:text-cyan-300',
  },
  manufacturing_logistics: {
    name: 'Manufacturing & Logistics',
    description:
      'Industrial plant and distribution hub with heavy-machinery safety policies, biometric hardware integration, and multi-tier hazard pay.',
    departments: ['Plant Operations', 'Assembly Line', 'Quality Assurance', 'Fleet & Logistics', 'Safety & Compliance'],
    employeeCount: 180,
    tone: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
    badgeText: 'text-amber-700 dark:text-amber-300',
  },
};

const SAMPLE_COUNTRIES = [
  { code: 'USA', name: 'United States' },
  { code: 'GBR', name: 'United Kingdom' },
  { code: 'AUS', name: 'Australia' },
  { code: 'SGP', name: 'Singapore' },
  { code: 'CAN', name: 'Canada' },
  { code: 'IND', name: 'India' },
  { code: 'DEU', name: 'Germany' },
];

export function SandboxTenantsPage() {
  const { can } = usePermissions();
  const canManageTenants = can('tenant', 'create');
  const canDeleteTenants = can('tenant', 'delete');

  const [sandboxes, setSandboxes] = useState<SandboxTenantSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [templateFilter, setTemplateFilter] = useState('All');
  const [countryFilter, setCountryFilter] = useState('All');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [activeSandbox, setActiveSandbox] = useState<SandboxTenantSummary | null>(null);

  // Action input states
  const [resetReason, setResetReason] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteTypedName, setDeleteTypedName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{
    tone: 'success' | 'danger';
    message: string;
  } | null>(null);

  // Create Wizard state
  const [createStep, setCreateStep] = useState<1 | 2 | 3 | 4>(1);
  const [formData, setFormData] = useState<{
    name: string;
    subdomain: string;
    countryCode: string;
    template: SandboxDemoTemplate;
    durationDays: number;
    demoLeadName: string;
    demoLeadEmail: string;
    reason: string;
  }>({
    name: '',
    subdomain: '',
    countryCode: 'USA',
    template: 'tech_saas',
    durationDays: 30,
    demoLeadName: '',
    demoLeadEmail: '',
    reason: 'Sales demo environment for prospective enterprise customer',
  });

  const loadSandboxes = async () => {
    setIsLoading(true);
    try {
      const data = await fetchSandboxTenants();
      setSandboxes(data);
    } catch (err) {
      console.error('Failed to load sandbox tenants:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSandboxes();
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const filteredSandboxes = useMemo(() => {
    return sandboxes.filter((item) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.subdomain.toLowerCase().includes(q) ||
        (item.demoLeadName && item.demoLeadName.toLowerCase().includes(q)) ||
        (item.country && item.country.toLowerCase().includes(q));

      const matchTemplate =
        templateFilter === 'All' || item.sandboxTemplate === templateFilter;
      const matchCountry =
        countryFilter === 'All' || item.countryCode === countryFilter || item.country === countryFilter;

      return matchSearch && matchTemplate && matchCountry;
    });
  }, [sandboxes, search, templateFilter, countryFilter]);

  // Aggregate metrics
  const totalSeats = useMemo(
    () =>
      sandboxes.reduce(
        (acc, curr) =>
          acc + (curr.employeeCount || curr.sampleDataStats?.employeesCount || 0),
        0,
      ),
    [sandboxes],
  );

  // Reset handler
  const handleExecuteReset = async () => {
    if (!activeSandbox || resetReason.trim().length < 5) return;
    setIsSubmitting(true);
    try {
      const updated = await resetSandboxTenant(activeSandbox.id, {
        reason: resetReason.trim(),
      });
      setSandboxes((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setShowResetModal(false);
      setResetReason('');
      setActionFeedback({
        tone: 'success',
        message: `Sandbox "${activeSandbox.name}" successfully reset to baseline sample data. Transient test records purged.`,
      });
    } catch (err: any) {
      setActionFeedback({
        tone: 'danger',
        message: err.message || 'Failed to reset sandbox tenant',
      });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setActionFeedback(null), 4000);
    }
  };

  // Delete handler
  const handleExecuteDelete = async () => {
    if (
      !activeSandbox ||
      deleteReason.trim().length < 5 ||
      deleteTypedName.trim() !== activeSandbox.name.trim()
    ) {
      return;
    }
    setIsSubmitting(true);
    try {
      await deleteSandboxTenant(activeSandbox.id, {
        reason: deleteReason.trim(),
      });
      setSandboxes((prev) => prev.filter((s) => s.id !== activeSandbox.id));
      setShowDeleteModal(false);
      setDeleteReason('');
      setDeleteTypedName('');
      setActionFeedback({
        tone: 'success',
        message: `Sandbox demo workspace "${activeSandbox.name}" has been permanently purged.`,
      });
    } catch (err: any) {
      setActionFeedback({
        tone: 'danger',
        message: err.message || 'Failed to delete sandbox tenant',
      });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setActionFeedback(null), 4000);
    }
  };

  // Create wizard submit
  const handleCreateSandbox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.subdomain.trim() || formData.reason.trim().length < 5) {
      return;
    }
    setIsSubmitting(true);
    try {
      const created = await createSandboxTenant({
        name: formData.name.trim(),
        subdomain: formData.subdomain.trim().toLowerCase(),
        countryCode: formData.countryCode,
        template: formData.template,
        durationDays: formData.durationDays,
        demoLeadName: formData.demoLeadName.trim() || 'Solutions Architecture',
        demoLeadEmail: formData.demoLeadEmail.trim() || 'sales-demo@cmsnbd.com',
        reason: formData.reason.trim(),
      });
      setSandboxes((prev) => [created, ...prev]);
      setShowCreateModal(false);
      setCreateStep(1);
      setFormData({
        name: '',
        subdomain: '',
        countryCode: 'USA',
        template: 'tech_saas',
        durationDays: 30,
        demoLeadName: '',
        demoLeadEmail: '',
        reason: 'Sales demo environment for prospective enterprise customer',
      });
      setActionFeedback({
        tone: 'success',
        message: `Sandbox workspace "${created.name}" provisioned successfully with ${TEMPLATE_META[created.sandboxTemplate].name} sample data!`,
      });
    } catch (err: any) {
      setActionFeedback({
        tone: 'danger',
        message: err.message || 'Failed to create sandbox workspace',
      });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setActionFeedback(null), 5000);
    }
  };

  const handleNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 32);
    setFormData((prev) => ({
      ...prev,
      name,
      subdomain: prev.subdomain ? prev.subdomain : slug,
    }));
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-900 dark:text-slate-100 pb-16">
      {/* Top Banner: Sandbox Policy Non-Billable Notice */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-900/30 via-indigo-900/20 to-amber-900/20 border border-purple-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0">
            <FlaskConical className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs uppercase font-extrabold tracking-wider text-purple-400">
                Sandbox Demo Architecture
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40">
                Non-Billable Guaranteed
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
              Sandbox tenants are provisioned specifically for sales demos, client POCs, and training.
              They are <strong>strictly never billed</strong> ($0 MRR enforced), exempt from platform license
              seat quotas, and labeled everywhere in the UI to prevent production confusion.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <PermissionGate module="tenant" action="create">
            <button
              type="button"
              onClick={() => {
                setCreateStep(1);
                setShowCreateModal(true);
              }}
              className="h-9 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-md shadow-purple-950/30"
            >
              <Plus className="h-4 w-4" />
              <span>Create Sandbox Tenant</span>
            </button>
          </PermissionGate>
          <button
            type="button"
            onClick={loadSandboxes}
            disabled={isLoading}
            className="h-9 w-9 rounded-xl border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white flex items-center justify-center transition"
            title="Refresh sandbox list"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Action feedback toast */}
      {actionFeedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2.5 animate-fade-in shadow-sm ${
            actionFeedback.tone === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/30 text-rose-800 dark:text-rose-300'
          }`}
        >
          {actionFeedback.tone === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
          )}
          <span>{actionFeedback.message}</span>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sandboxes */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Sandbox Workspaces</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
              <FlaskConical className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {sandboxes.length}
            </span>
            <span className="text-xs text-purple-600 dark:text-purple-400 font-bold">
              Active Sales Demos
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            Seeded with sample employees and policies
          </div>
        </div>

        {/* Demo Employees Seeded */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Demo Seats Seeded</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {totalSeats.toLocaleString()}
            </span>
            <span className="text-xs text-blue-600 dark:text-blue-400 font-bold">
              Synthetic records
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            Across engineering, retail, healthcare & plant
          </div>
        </div>

        {/* Non-Billable MRR */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Billed MRR</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
              $0.00
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase">
              100% Exempt
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            Excluded from commercial revenue & ARR metrics
          </div>
        </div>

        {/* Available Demo Templates */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Industry Templates</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              4
            </span>
            <span className="text-xs text-amber-600 dark:text-amber-400 font-bold">
              Specialized presets
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            Tech SaaS, Retail, Healthcare & Logistics
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by company name, subdomain, sales lead, or country..."
              className="w-full h-10 pl-9 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:border-purple-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Template Filter */}
          <select
            value={templateFilter}
            onChange={(e) => setTemplateFilter(e.target.value)}
            className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:border-purple-500"
          >
            <option value="All">All Industry Templates</option>
            <option value="tech_saas">Tech SaaS & Startups</option>
            <option value="retail_hospitality">Retail & Hospitality</option>
            <option value="enterprise_healthcare">Enterprise Healthcare</option>
            <option value="manufacturing_logistics">Manufacturing & Logistics</option>
          </select>

          {/* Country Filter */}
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:border-purple-500"
          >
            <option value="All">All Countries</option>
            {SAMPLE_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Sandbox Tenants Directory */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Provisioned Sandbox Workspaces
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500 font-bold">
              {filteredSandboxes.length} of {sandboxes.length}
            </span>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <span>Demo Root Password:</span>
            <code className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-purple-600 dark:text-purple-300 font-mono text-[11px] font-bold">
              Demo2026!Secure
            </code>
          </div>
        </div>

        {filteredSandboxes.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-500 flex items-center justify-center mx-auto">
              <FlaskConical className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              No sandbox tenants found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {search || templateFilter !== 'All' || countryFilter !== 'All'
                ? 'Try adjusting your search criteria or resetting filters.'
                : 'No sales demo tenants have been created yet. Click "Create Sandbox Tenant" to provision your first workspace.'}
            </p>
            {canManageTenants && (
              <button
                type="button"
                onClick={() => {
                  setCreateStep(1);
                  setShowCreateModal(true);
                }}
                className="mt-2 inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Create Sandbox Tenant</span>
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredSandboxes.map((sandbox) => {
              const tm = TEMPLATE_META[sandbox.sandboxTemplate] || TEMPLATE_META.tech_saas;
              const isPermanent = !sandbox.sandboxExpiresAt;

              return (
                <div
                  key={sandbox.id}
                  className="p-5 sm:p-6 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition flex flex-col xl:flex-row xl:items-center justify-between gap-6"
                >
                  {/* Left Column: Tenant Identity & Badges */}
                  <div className="space-y-3 max-w-2xl">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-amber-500 text-white flex items-center justify-center text-xs font-black shrink-0 shadow-sm">
                        {sandbox.name
                          .split(' ')
                          .map((p) => p[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                            {sandbox.name}
                          </h3>
                          {/* Prominent Sandbox Badge */}
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                            <FlaskConical className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                            SANDBOX DEMO
                          </span>
                          {/* Non-billable badge */}
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            NON-BILLABLE ($0)
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex-wrap">
                          <a
                            href={`https://${sandbox.subdomain}.cmsnbd.com`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center gap-1"
                          >
                            https://{sandbox.subdomain}.cmsnbd.com
                            <ExternalLink className="h-3 w-3" />
                          </a>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            <Globe className="h-3 w-3 text-slate-400" />
                            {sandbox.country} ({sandbox.countryCode})
                          </span>
                          <span>·</span>
                          <span>
                            Created {new Date(sandbox.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Template Card Highlight */}
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${tm.badgeBg} ${tm.badgeText}`}
                          >
                            <Sparkles className="h-3 w-3" />
                            {tm.name}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {sandbox.employeeCount || sandbox.sampleDataStats?.employeesCount || tm.employeeCount} sample employees · {tm.departments.length} departments
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                          {tm.description}
                        </p>
                      </div>

                      <div className="text-xs text-slate-500 dark:text-slate-400 shrink-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 font-medium">
                          <User className="h-3 w-3 text-slate-400" />
                          <span>Demo Lead: {sandbox.demoLeadName || 'Solutions Architecture'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <Clock className="h-3 w-3" />
                          <span>
                            Last Reset:{' '}
                            {sandbox.lastResetAt
                              ? new Date(sandbox.lastResetAt).toLocaleDateString()
                              : 'Baseline'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Credentials & Lifecycle Controls */}
                  <div className="flex flex-col sm:flex-row xl:flex-col items-start xl:items-end justify-between gap-3 shrink-0">
                    {/* Demo Login Credentials Box */}
                    <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 text-xs w-full sm:w-auto">
                      <div className="text-[10px] uppercase font-bold text-purple-700 dark:text-purple-300 tracking-wider mb-1 flex items-center justify-between gap-4">
                        <span>Admin Login</span>
                        <span className="font-mono text-slate-400">Role: Owner</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <code className="font-mono text-slate-700 dark:text-slate-300 text-[11px]">
                          admin@{sandbox.subdomain}.cmsnbd.com
                        </code>
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(
                              `admin@${sandbox.subdomain}.cmsnbd.com`,
                              `email-${sandbox.id}`,
                            )
                          }
                          className="p-1 rounded text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/50"
                          title="Copy login email"
                        >
                          {copiedKey === `email-${sandbox.id}` ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      {/* Reset Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSandbox(sandbox);
                          setResetReason('');
                          setShowResetModal(true);
                        }}
                        className="h-9 px-3.5 rounded-xl border border-purple-300 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                        title="Reset workspace back to original sample data"
                      >
                        <RotateCcw className="h-3.5 w-3.5 text-purple-500" />
                        <span>Reset to Sample Data</span>
                      </button>

                      {/* Delete Sandbox Button */}
                      <PermissionGate module="tenant" action="delete">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveSandbox(sandbox);
                            setDeleteReason('');
                            setDeleteTypedName('');
                            setShowDeleteModal(true);
                          }}
                          className="h-9 px-3 rounded-xl border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-bold transition flex items-center gap-1.5"
                          title="Purge sandbox immediately"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete</span>
                        </button>
                      </PermissionGate>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: Create Sandbox Tenant Wizard */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl animate-fade-in space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
                  <FlaskConical className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    Provision Sandbox Demo Tenant
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Step {createStep} of 4 · Non-billable sales demonstration environment
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Stepper indicator */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { num: 1, label: 'Workspace' },
                { num: 2, label: 'Country' },
                { num: 3, label: 'Template' },
                { num: 4, label: 'Demo Lead' },
              ].map((s) => (
                <div key={s.num} className="space-y-1">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      createStep >= s.num
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600'
                        : 'bg-slate-200 dark:bg-slate-800'
                    }`}
                  />
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleCreateSandbox} className="space-y-5">
              {/* STEP 1: Workspace Name & Subdomain */}
              {createStep === 1 && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Demo Workspace Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Apex Global Dynamics (Demo)"
                      value={formData.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Subdomain Identifier *
                    </label>
                    <div className="flex items-center">
                      <input
                        type="text"
                        required
                        placeholder="apex-global-demo"
                        value={formData.subdomain}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                          }))
                        }
                        className="w-full h-11 px-3.5 rounded-l-xl border border-r-0 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono focus:outline-none focus:border-purple-500"
                      />
                      <span className="h-11 px-3 rounded-r-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center">
                        .cmsnbd.com
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      Full URL: <span className="font-mono text-purple-600 dark:text-purple-400">https://{formData.subdomain || 'subdomain'}.cmsnbd.com</span>
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-900 dark:text-purple-200">
                    <span className="font-bold">Automatic Configuration:</span> The workspace will be automatically provisioned with isolated RLS tables, root admin credentials, and an initial company structure.
                  </div>
                </div>
              )}

              {/* STEP 2: Country / Jurisdiction */}
              {createStep === 2 && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Target Country / Statutory Jurisdiction *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {SAMPLE_COUNTRIES.map((c) => (
                        <label
                          key={c.code}
                          className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                            formData.countryCode === c.code
                              ? 'border-purple-500 bg-purple-500/10 text-purple-900 dark:text-purple-200 font-bold'
                              : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Globe className="h-4 w-4 text-purple-500" />
                            <span className="text-xs">{c.name}</span>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700">
                            {c.code}
                          </span>
                          <input
                            type="radio"
                            name="countryCode"
                            value={c.code}
                            checked={formData.countryCode === c.code}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, countryCode: e.target.value }))
                            }
                            className="hidden"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Industry Demo Template */}
              {createStep === 3 && (
                <div className="space-y-3 animate-fade-in">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Select Seeded Industry Template *
                  </label>
                  <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                    {(Object.keys(TEMPLATE_META) as SandboxDemoTemplate[]).map((tmplKey) => {
                      const item = TEMPLATE_META[tmplKey];
                      const isSelected = formData.template === tmplKey;

                      return (
                        <div
                          key={tmplKey}
                          onClick={() => setFormData((prev) => ({ ...prev, template: tmplKey }))}
                          className={`p-4 rounded-2xl border cursor-pointer transition ${
                            isSelected
                              ? 'border-purple-500 bg-purple-500/10 shadow-sm'
                              : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                                  {item.name}
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.badgeBg} ${item.badgeText}`}
                                >
                                  {item.employeeCount} Seeded Employees
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {item.description}
                              </p>
                              <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[10px] text-slate-400">
                                <span className="font-bold text-slate-600 dark:text-slate-300">Departments:</span>
                                {item.departments.map((d) => (
                                  <span key={d} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                                    {d}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div
                              className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                                isSelected
                                  ? 'border-purple-500 bg-purple-500 text-white'
                                  : 'border-slate-400'
                              }`}
                            >
                              {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 4: Demo Lead, Retention & Mandatory Reason */}
              {createStep === 4 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                        Sales Lead / Solutions Architect
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Maya Lin (Solutions Eng)"
                        value={formData.demoLeadName}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, demoLeadName: e.target.value }))
                        }
                        className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                        Lead Email Contact
                      </label>
                      <input
                        type="email"
                        placeholder="maya.lin@cmsnbd.com"
                        value={formData.demoLeadEmail}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, demoLeadEmail: e.target.value }))
                        }
                        className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Retention Duration (TTL)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: '14 Days', days: 14 },
                        { label: '30 Days', days: 30 },
                        { label: 'Permanent', days: 0 },
                      ].map((item) => (
                        <button
                          key={item.days}
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, durationDays: item.days }))}
                          className={`h-9 px-3 rounded-xl border text-xs font-bold transition ${
                            formData.durationDays === item.days
                              ? 'border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-300'
                              : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Mandatory Audit Reason (min 5 chars) *
                    </label>
                    <textarea
                      required
                      rows={2}
                      value={formData.reason}
                      onChange={(e) => setFormData((prev) => ({ ...prev, reason: e.target.value }))}
                      placeholder="Explain the prospect, sales opportunity, or demo scenario..."
                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  {/* Summary Box */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                      <span>{formData.name || 'Sandbox Workspace'}</span>
                      <span className="text-emerald-500 font-mono font-bold">$0 MRR (Non-Billable)</span>
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      Template: {TEMPLATE_META[formData.template].name} · Country: {formData.countryCode} · Subdomain: {formData.subdomain}.cmsnbd.com
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation controls */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                {createStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setCreateStep((prev) => (prev - 1) as any)}
                    className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition"
                  >
                    Back
                  </button>
                ) : (
                  <div />
                )}

                {createStep < 4 ? (
                  <button
                    type="button"
                    disabled={
                      (createStep === 1 && (!formData.name.trim() || !formData.subdomain.trim())) ||
                      (createStep === 2 && !formData.countryCode) ||
                      (createStep === 3 && !formData.template)
                    }
                    onClick={() => setCreateStep((prev) => (prev + 1) as any)}
                    className="h-10 px-5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <span>Continue</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting || formData.reason.trim().length < 5}
                    className="h-10 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition flex items-center gap-2 shadow-md shadow-purple-950/30"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Provisioning Demo Workspace...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        <span>Provision Sandbox Workspace</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Reset to Sample Data Confirmation */}
      {showResetModal && activeSandbox && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-fade-in space-y-5">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <RotateCcw className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Reset Sandbox to Baseline Sample Data
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Resetting will purge all test attendance punches, test leave requests, and ad-hoc employee records added during sales meetings. The workspace will be restored to pristine <strong>{TEMPLATE_META[activeSandbox.sandboxTemplate]?.name}</strong> demo data.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 text-xs text-purple-900 dark:text-purple-200 space-y-1">
              <div className="font-bold">Target Workspace: {activeSandbox.name}</div>
              <div className="font-mono text-[11px] text-purple-700 dark:text-purple-300">
                https://{activeSandbox.subdomain}.cmsnbd.com
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Mandatory Reset Reason (min 5 characters) *
              </label>
              <textarea
                rows={2}
                value={resetReason}
                onChange={(e) => setResetReason(e.target.value)}
                placeholder="e.g. Resetting workspace after enterprise sales demo meeting with ACME corp..."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting || resetReason.trim().length < 5}
                onClick={handleExecuteReset}
                className="h-10 px-5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-purple-950/30"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Resetting Sample Data...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4" />
                    <span>Confirm Reset</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Immediate Delete Confirmation */}
      {showDeleteModal && activeSandbox && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-fade-in space-y-5">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Delete Sandbox Demo Tenant
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  As this is a <strong>sandbox demo environment</strong>, it will be{' '}
                  <span className="text-rose-600 dark:text-rose-400 font-bold">
                    permanently and immediately deleted
                  </span>{' '}
                  without entering the standard 30-day grace period.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-900 dark:text-rose-200 space-y-1">
              <div className="font-bold">Target Workspace: {activeSandbox.name}</div>
              <div className="font-mono text-[11px] text-rose-700 dark:text-rose-300">
                {activeSandbox.subdomain}.cmsnbd.com
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Type tenant name <span className="font-mono text-rose-500">"{activeSandbox.name}"</span> to confirm *
                </label>
                <input
                  type="text"
                  value={deleteTypedName}
                  onChange={(e) => setDeleteTypedName(e.target.value)}
                  placeholder={activeSandbox.name}
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Mandatory Audit Reason (min 5 characters) *
                </label>
                <textarea
                  rows={2}
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="e.g. Sales demonstration concluded, prospective client opted for production deployment..."
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  isSubmitting ||
                  deleteReason.trim().length < 5 ||
                  deleteTypedName.trim() !== activeSandbox.name.trim()
                }
                onClick={handleExecuteDelete}
                className="h-10 px-5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-rose-950/30"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Purging Workspace...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
