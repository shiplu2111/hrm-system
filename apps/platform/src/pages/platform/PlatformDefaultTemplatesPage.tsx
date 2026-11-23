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
  Eye,
  FileCheck,
  FileText,
  Filter,
  Globe,
  History,
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
import { TemplateVersionHistoryModal } from '@/components/provisioning-templates/TemplateVersionHistoryModal';
import { CategoryPreviewModal } from '@/components/provisioning-templates/CategoryPreviewModal';

// 5 primary tabs as requested: Documents, Leave, Notifications, Roles, Onboarding
const TABS: {
  id: PlatformTemplateCategory;
  label: string;
  icon: any;
  description: string;
}[] = [
  {
    id: 'document_types',
    label: 'Documents',
    icon: FileText,
    description: 'Statutory verification, compliance, and employee onboarding document types',
  },
  {
    id: 'leave_policies',
    label: 'Leave',
    icon: Calendar,
    description: 'Statutory and company default leave entitlements, accruals, and carryover rules',
  },
  {
    id: 'notification_templates',
    label: 'Notifications',
    icon: Sparkles,
    description: 'System notification triggers, email templates, push notifications, and notices',
  },
  {
    id: 'default_roles',
    label: 'Roles',
    icon: Shield,
    description: 'Base RBAC tiers (Owner, Admin, HR, Payroll, Manager, Employee) and permission sets',
  },
  {
    id: 'onboarding_checklists',
    label: 'Onboarding',
    icon: FileCheck,
    description: 'Multi-step onboarding workflows, task assignments, and document collection checklist',
  },
];

export function PlatformDefaultTemplatesPage() {
  const [countries, setCountries] = useState<CountrySummary[]>([]);
  const [templates, setTemplates] = useState<PlatformDefaultTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Active Tab: Documents, Leave, Notifications, Roles, Onboarding
  const [activeTab, setActiveTab] = useState<PlatformTemplateCategory>('document_types');

  // Filters per tab
  const [selectedCountryFilter, setSelectedCountryFilter] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PlatformDefaultTemplate | null>(null);
  const [isCrossTenantPreviewOpen, setIsCrossTenantPreviewOpen] = useState(false);
  const [isCategoryPreviewOpen, setIsCategoryPreviewOpen] = useState(false);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);

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
          category: activeTab,
          countryId: selectedCountryFilter === 'all' ? undefined : selectedCountryFilter,
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
  }, [activeTab, selectedCountryFilter, selectedStatus]);

  // Handle clone
  const handleClone = async (template: PlatformDefaultTemplate) => {
    try {
      const cloned = await clonePlatformDefaultTemplate(template.id);
      setActionSuccessMsg(
        `Cloned version ${template.version} into new draft version ${cloned.version}. Changing a default affects only tenants created afterwards, never existing tenants.`,
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
        `Template "${publishConfirmModal.name}" v${publishConfirmModal.version} is now published. Applies to new tenants only — existing tenants are never affected.`,
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
        `Archive template "${template.name}" (v${template.version})? It will no longer be seeded into newly created tenants. Existing tenants remain untouched.`,
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

  // Active Tab Metadata
  const currentTabDef = TABS.find((t) => t.id === activeTab) || TABS[0];
  const ActiveTabIcon = currentTabDef.icon;

  // Filter templates on active tab
  const filteredTemplates = templates.filter((t) => {
    if (t.category !== activeTab) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      (t.sourceReference && t.sourceReference.toLowerCase().includes(q)) ||
      (t.changeSummary && t.changeSummary.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* 1. Header Hero Card */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 p-6 text-white shadow-xl border border-indigo-900/40 relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-mono font-bold tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Stage C.0 • Tenant Provisioning Baselines
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              Platform Default Templates
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Define and govern versioned baseline configurations for Documents, Leave, Notifications, Roles, and Onboarding seeded into newly provisioned tenant workspaces.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsCrossTenantPreviewOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold flex items-center gap-2 transition-all shadow-sm"
            >
              <Building2 className="w-4 h-4 text-emerald-400" />
              Full Provisioning Seed Simulation
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

      {/* 2. Top-Level Tabs Navigation: Documents, Leave, Notifications, Roles, Onboarding */}
      <div className="flex items-center gap-2 overflow-x-auto p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 shadow-inner">
        {TABS.map((tab) => {
          const TabIcon = tab.icon;
          const isSelected = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setSearchQuery('');
              }}
              className={`flex-1 min-w-[130px] px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2.5 transition-all ${
                isSelected
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-md border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/50'
              }`}
            >
              <TabIcon className={`w-4 h-4 ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
              <span className="text-sm font-black">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Non-Negotiable "Applies to New Tenants Only" Notice Banner */}
      <div className="rounded-2xl p-4 bg-gradient-to-r from-amber-50 via-orange-50/70 to-amber-50 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-amber-950/40 border-2 border-amber-300 dark:border-amber-700/80 text-amber-950 dark:text-amber-100 shadow-sm flex items-start gap-3.5">
        <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div className="space-y-1 flex-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h4 className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-100 flex items-center gap-2">
              <span>Applies to New Tenants Only — Existing Tenants are Never Affected</span>
            </h4>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
              Tenant Provisioning Isolation Guaranteed
            </span>
          </div>
          <p className="text-xs text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
            Platform default templates in <strong>{currentTabDef.label}</strong> define the baseline configuration seeded into tenant workspaces at creation time.
            <strong className="font-bold underline decoration-amber-500 underline-offset-2 ml-1">
              Changing a default affects only tenants created afterwards, never existing tenants.
            </strong>{' '}
            Existing tenants retain their independently customized {currentTabDef.label.toLowerCase()} without unexpected mutation, drift, or overwrites.
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

      {/* 4. Tab Toolbar: Country Filter, Status Filter, Search, Preview Button & Version History Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Country Jurisdiction Filter */}
          <div className="flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-indigo-500" />
            <select
              value={selectedCountryFilter}
              onChange={(e) => setSelectedCountryFilter(e.target.value)}
              className="text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="all">All Jurisdictions</option>
              <option value="global">🌐 Global Default Only</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.isoCode})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 font-semibold"
          >
            <option value="all">All Statuses</option>
            <option value="published">Published Only</option>
            <option value="draft">Draft Only</option>
            <option value="archived">Archived</option>
          </select>

          {/* Search Box */}
          <div className="relative min-w-[200px] flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${currentTabDef.label.toLowerCase()} templates...`}
              className="w-full text-xs rounded-xl pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Tab Actions: Preview & Version History */}
        <div className="flex items-center gap-2">
          {/* Preview Button for Active Category */}
          <button
            type="button"
            onClick={() => setIsCategoryPreviewOpen(true)}
            className="px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Eye className="w-4 h-4 text-emerald-600" />
            Preview {currentTabDef.label}
          </button>

          {/* Version History Button for Active Category */}
          <button
            type="button"
            onClick={() => setIsVersionHistoryOpen(true)}
            className="px-3.5 py-2 text-xs font-bold rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <History className="w-4 h-4 text-indigo-600" />
            Version History
          </button>

          {/* Refresh */}
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
      </div>

      {/* 5. Templates List for Active Tab */}
      {loading ? (
        <div className="p-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
          Loading {currentTabDef.label.toLowerCase()} default templates...
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <ActiveTabIcon className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
            No {currentTabDef.label.toLowerCase()} templates matching selected jurisdiction or filters
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Try adjusting your search query, selecting another jurisdiction, or create a new version for {currentTabDef.label.toLowerCase()}.
          </p>
          <button
            type="button"
            onClick={() => {
              setEditingTemplate(null);
              setIsEditorOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create {currentTabDef.label} Baseline
          </button>
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
                        {currentTabDef.label}
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

                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center gap-1">
                        <Globe className="w-3 h-3 text-indigo-500" />
                        {template.country
                          ? `${template.country.name} (${template.country.isoCode})`
                          : 'Global Default (All Countries)'}
                      </span>

                      {/* Clear "Applies to new tenants only" badge on each card */}
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20 flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        Applies to new tenants only
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

                  {/* Actions on Card */}
                  <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
                    {/* View History Button on Card */}
                    <button
                      type="button"
                      onClick={() => setIsVersionHistoryOpen(true)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                      title="Inspect full version history"
                    >
                      <History className="w-3.5 h-3.5 text-indigo-500" />
                      History
                    </button>

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

      {/* 6. Publish Confirmation Modal */}
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
                  {publishConfirmModal.name} ({currentTabDef.label})
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 space-y-2">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Applies to New Tenants Only:</span>
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
          setActionSuccessMsg('Template saved successfully. Applies to new tenants only.');
          fetchData();
        }}
        countries={countries}
        initialCategory={activeTab}
        initialCountryId={selectedCountryFilter === 'all' || selectedCountryFilter === 'global' ? null : selectedCountryFilter}
        editingTemplate={editingTemplate}
      />

      {/* Full Cross-Category Seed Simulation Modal */}
      <EffectiveTemplatesPreviewModal
        isOpen={isCrossTenantPreviewOpen}
        onClose={() => setIsCrossTenantPreviewOpen(false)}
        countries={countries}
        initialCountryId={selectedCountryFilter === 'all' || selectedCountryFilter === 'global' ? null : selectedCountryFilter}
      />

      {/* Category-Specific Preview Modal */}
      <CategoryPreviewModal
        isOpen={isCategoryPreviewOpen}
        onClose={() => setIsCategoryPreviewOpen(false)}
        category={activeTab}
        categoryLabel={currentTabDef.label}
        countries={countries}
        initialCountryId={selectedCountryFilter === 'all' || selectedCountryFilter === 'global' ? null : selectedCountryFilter}
      />

      {/* Category-Specific Version History Modal */}
      <TemplateVersionHistoryModal
        isOpen={isVersionHistoryOpen}
        onClose={() => setIsVersionHistoryOpen(false)}
        category={activeTab}
        categoryLabel={currentTabDef.label}
        templates={templates}
        countries={countries}
        selectedCountryFilter={selectedCountryFilter}
        onCloneVersion={handleClone}
        onPublishDraft={(t) => {
          setPublishConfirmModal(t);
          setPublishEffectiveFrom(t.effectiveFrom || new Date().toISOString().slice(0, 10));
        }}
        onEditDraft={(t) => {
          setEditingTemplate(t);
          setIsEditorOpen(true);
        }}
      />
    </div>
  );
}
