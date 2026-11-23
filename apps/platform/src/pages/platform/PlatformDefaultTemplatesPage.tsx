import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowRight,
  BookOpen,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Edit3,
  ExternalLink,
  FileCheck,
  FileText,
  Filter,
  Globe,
  Info,
  Layers,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  Tag,
  Upload,
  UserCheck,
  Users,
} from 'lucide-react';
import type {
  CountrySummary,
  PlatformDefaultTemplate,
  PlatformTemplateCategory,
} from '@hrm/shared-types';
import {
  archivePlatformDefaultTemplate,
  clonePlatformDefaultTemplate,
  listCountries,
  listPlatformDefaultTemplates,
  publishPlatformDefaultTemplate,
} from '@/lib/platform-countries-api';
import { TemplatePayloadViewer } from '@/components/provisioning-templates/TemplatePayloadViewer';
import { TemplateEditorModal } from '@/components/provisioning-templates/TemplateEditorModal';
import { EffectiveTemplatesPreviewModal } from '@/components/provisioning-templates/EffectiveTemplatesPreviewModal';

const CATEGORIES: {
  key: PlatformTemplateCategory | 'all';
  label: string;
  icon: any;
  description: string;
}[] = [
  {
    key: 'all',
    label: 'All Categories',
    icon: Layers,
    description: 'All platform baseline templates across all domains',
  },
  {
    key: 'document_types',
    label: 'Document Types',
    icon: FileText,
    description: 'Standard employee onboarding verification and compliance document types',
  },
  {
    key: 'leave_policies',
    label: 'Leave Policies',
    icon: Calendar,
    description: 'Statutory and company default leave entitlements, accruals, and approvals',
  },
  {
    key: 'notification_templates',
    label: 'Notification Templates',
    icon: Sparkles,
    description: 'Automated email and in-app notice templates dispatched for tenant events',
  },
  {
    key: 'default_roles',
    label: 'Default Roles & RBAC',
    icon: Shield,
    description: 'Base roles (Owner, HR, Payroll, Manager, Employee) and permission sets',
  },
  {
    key: 'onboarding_checklists',
    label: 'Onboarding Checklists',
    icon: FileCheck,
    description: 'Default multi-step onboarding workflows, task assignments, and document collection',
  },
];

export function PlatformDefaultTemplatesPage() {
  const [countries, setCountries] = useState<CountrySummary[]>([]);
  const [templates, setTemplates] = useState<PlatformDefaultTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Filters
  const [selectedCountryFilter, setSelectedCountryFilter] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<PlatformTemplateCategory | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PlatformDefaultTemplate | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Publishing state
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishConfirmModal, setPublishConfirmModal] = useState<PlatformDefaultTemplate | null>(null);
  const [publishEffectiveFrom, setPublishEffectiveFrom] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [countriesRes, templatesRes] = await Promise.all([
        listCountries(),
        listPlatformDefaultTemplates({
          countryId: selectedCountryFilter === 'all' ? undefined : selectedCountryFilter,
          category: selectedCategory === 'all' ? undefined : selectedCategory,
          status: selectedStatus === 'all' ? undefined : selectedStatus,
        }),
      ]);
      setCountries(countriesRes);
      setTemplates(templatesRes);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load platform templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedCountryFilter, selectedCategory, selectedStatus]);

  // Handle clone
  const handleClone = async (template: PlatformDefaultTemplate) => {
    try {
      const cloned = await clonePlatformDefaultTemplate(template.id);
      setActionSuccessMsg(
        `Cloned version ${template.version} into new draft version ${cloned.version}.`,
      );
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to clone template');
    }
  };

  // Handle publish confirmation
  const handleConfirmPublish = async () => {
    if (!publishConfirmModal) return;
    setPublishingId(publishConfirmModal.id);
    try {
      await publishPlatformDefaultTemplate(publishConfirmModal.id, {
        effectiveFrom: publishEffectiveFrom,
        changeSummary: `Published version ${publishConfirmModal.version}`,
      });
      setActionSuccessMsg(
        `Template "${publishConfirmModal.name}" v${publishConfirmModal.version} is now published. Changing a default affects only tenants created afterwards, never existing tenants.`,
      );
      setPublishConfirmModal(null);
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to publish template');
    } finally {
      setPublishingId(null);
    }
  };

  // Handle archive
  const handleArchive = async (template: PlatformDefaultTemplate) => {
    if (
      !window.confirm(
        `Archive template "${template.name}" (v${template.version})? It will no longer be used for new tenant provisioning.`,
      )
    ) {
      return;
    }
    try {
      await archivePlatformDefaultTemplate(template.id);
      setActionSuccessMsg(`Template "${template.name}" v${template.version} has been archived.`);
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to archive template');
    }
  };

  // Filter templates
  const filteredTemplates = templates.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      (t.sourceReference && t.sourceReference.toLowerCase().includes(q)) ||
      (t.changeSummary && t.changeSummary.toLowerCase().includes(q))
    );
  });

  const publishedCount = templates.filter((t) => t.status === 'published').length;
  const draftCount = templates.filter((t) => t.status === 'draft').length;

  return (
    <div className="space-y-6">
      {/* 1. Header Hero Card */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 p-6 text-white shadow-xl border border-indigo-900/40 relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-mono font-bold tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Stage C.0 • Tenant Provisioning Defaults
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              Platform Default Templates
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Manage versioned baseline configuration templates from which newly provisioned tenants are seeded: document types, leave policies, notifications, default roles & permission sets, and onboarding checklists.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsPreviewOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold flex items-center gap-2 transition-all shadow-sm"
            >
              <Building2 className="w-4 h-4 text-emerald-400" />
              Preview Tenant Seed
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingTemplate(null);
                setIsEditorOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-indigo-500/30"
            >
              <Plus className="w-4 h-4" />
              New Template Version
            </button>
          </div>
        </div>
      </div>

      {/* 2. Non-Negotiable Core Rule Notice Banner (UI Requirement) */}
      <div className="rounded-2xl p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border-2 border-amber-300 dark:border-amber-800/80 text-amber-950 dark:text-amber-200 shadow-sm flex items-start gap-3.5">
        <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-100 flex items-center gap-2">
            <span>Tenant Provisioning Isolation & Immutability Policy</span>
            <span className="px-2 py-0.2 rounded-full text-[10px] font-mono bg-amber-200/80 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
              Guaranteed
            </span>
          </h4>
          <p className="text-xs text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
            Platform default templates define the baseline configuration seeded into tenant workspaces at creation time.
            <strong className="font-bold underline decoration-amber-500 underline-offset-2 ml-1">
              Changing a default affects only tenants created afterwards, never existing tenants.
            </strong>{' '}
            Existing tenants retain their independently customized roles, leave policies, document types, and settings without unexpected mutation or drift.
          </p>
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-2 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{actionSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccessMsg(null)}
            className="text-emerald-600 hover:text-emerald-800 font-bold text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-rose-600 hover:text-rose-800 font-bold text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 3. Stat KPI Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
            Published Baselines
          </span>
          <span className="text-xl font-black text-slate-900 dark:text-white mt-1 block">
            {publishedCount} versions
          </span>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
            Active for new tenants
          </span>
        </div>

        <div className="rounded-xl p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
            Draft Versions
          </span>
          <span className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1 block">
            {draftCount} pending
          </span>
          <span className="text-[10px] text-slate-400 font-medium">
            Review before publishing
          </span>
        </div>

        <div className="rounded-xl p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
            Categories Covered
          </span>
          <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1 block">
            5 of 5
          </span>
          <span className="text-[10px] text-slate-400 font-medium">
            Roles, Docs, Leave, Notifs, Onboarding
          </span>
        </div>

        <div className="rounded-xl p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
            Tenant Provisioning Hook
          </span>
          <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Stage C.0 Active
          </span>
          <span className="text-[10px] text-slate-400 font-medium block mt-1">
            Linked to Tenant Lifecycle
          </span>
        </div>
      </div>

      {/* 4. Category Nav Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isSelected = selectedCategory === cat.key;
          const count =
            cat.key === 'all'
              ? templates.length
              : templates.filter((t) => t.category === cat.key).length;

          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => setSelectedCategory(cat.key)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {cat.label}
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                  isSelected
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 5. Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search template name, source reference..."
              className="w-full text-xs rounded-xl pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Country Jurisdiction Filter */}
          <select
            value={selectedCountryFilter}
            onChange={(e) => setSelectedCountryFilter(e.target.value)}
            className="text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2"
          >
            <option value="all">All Jurisdictions</option>
            <option value="global">🌐 Global Default Only</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.isoCode})
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2"
          >
            <option value="all">All Statuses</option>
            <option value="published">Published Only</option>
            <option value="draft">Draft Only</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <button
          type="button"
          onClick={fetchData}
          disabled={loading}
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Refresh templates"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 6. Templates List */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
          Loading platform default templates...
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <Layers className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
            No templates matching selected criteria
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Try adjusting your search query, jurisdiction filter, or create a new template version.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTemplates.map((template) => {
            const isPublished = template.status === 'published';
            const isDraft = template.status === 'draft';
            const isArchived = template.status === 'archived';

            return (
              <div
                key={template.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden"
              >
                {/* Template Header Card */}
                <div className="p-4 sm:p-5 bg-slate-50/70 dark:bg-slate-850/60 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/50">
                        {template.category.replace(/_/g, ' ')}
                      </span>

                      <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        Version {template.version}
                      </span>

                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          isPublished
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/50'
                            : isDraft
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/50'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {template.status}
                      </span>

                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center gap-1">
                        <Globe className="w-3 h-3 text-indigo-500" />
                        {template.country
                          ? `${template.country.name} (${template.country.isoCode})`
                          : 'Global Default (All Countries)'}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {template.name}
                    </h3>

                    {template.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {template.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-[11px] text-slate-400 flex-wrap pt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Effective: {template.effectiveFrom}
                        {template.effectiveTo ? ` to ${template.effectiveTo}` : ' (Present)'}
                      </span>
                      {template.sourceReference && (
                        <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                          <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                          Source: {template.sourceReference}
                        </span>
                      )}
                      {template.changeSummary && (
                        <span className="italic text-slate-500 dark:text-slate-400">
                          "{template.changeSummary}"
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-start sm:self-center">
                    {isDraft && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setPublishConfirmModal(template);
                            setPublishEffectiveFrom(template.effectiveFrom || new Date().toISOString().slice(0, 10));
                          }}
                          className="px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 transition-colors"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          Publish Version
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTemplate(template);
                            setIsEditorOpen(true);
                          }}
                          className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Edit Draft
                        </button>
                      </>
                    )}

                    {isPublished && (
                      <button
                        type="button"
                        onClick={() => handleClone(template)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors flex items-center gap-1.5"
                        title="Clone into a new draft version to propose modifications"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Clone as Next Version
                      </button>
                    )}

                    {!isArchived && (
                      <button
                        type="button"
                        onClick={() => handleArchive(template)}
                        className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                        title="Archive template version"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Template Content Viewer */}
                <div className="p-4 sm:p-5">
                  <TemplatePayloadViewer
                    category={template.category}
                    payload={template.payload}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 7. Publish Confirmation Modal */}
      {publishConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 border border-emerald-200/50 shrink-0">
                <Upload className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Publish Template Version {publishConfirmModal.version}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {publishConfirmModal.name} ({publishConfirmModal.category.replace(/_/g, ' ')})
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 space-y-2">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Tenant Provisioning Isolation Notice:</span>
              </div>
              <p className="leading-relaxed">
                Publishing this version sets it as the active baseline for all{' '}
                <strong className="underline">newly provisioned tenants</strong>. Existing tenants
                will <strong className="underline">never be altered</strong> or mutated.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Effective From Date *
              </label>
              <input
                type="date"
                required
                value={publishEffectiveFrom}
                onChange={(e) => setPublishEffectiveFrom(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setPublishConfirmModal(null)}
                disabled={Boolean(publishingId)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPublish}
                disabled={Boolean(publishingId)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                {publishingId ? 'Publishing...' : 'Confirm & Publish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editor Modal */}
      <TemplateEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSuccess={() => {
          setActionSuccessMsg('Template saved successfully.');
          fetchData();
        }}
        countries={countries}
        initialCategory={selectedCategory === 'all' ? 'document_types' : selectedCategory}
        initialCountryId={selectedCountryFilter === 'all' || selectedCountryFilter === 'global' ? null : selectedCountryFilter}
        editingTemplate={editingTemplate}
      />

      {/* Effective Provisioning Preview Modal */}
      <EffectiveTemplatesPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        countries={countries}
        initialCountryId={selectedCountryFilter === 'all' || selectedCountryFilter === 'global' ? null : selectedCountryFilter}
      />
    </div>
  );
}
