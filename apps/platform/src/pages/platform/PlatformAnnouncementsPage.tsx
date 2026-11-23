import React, { useEffect, useState, useMemo } from 'react';
import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  Filter,
  Globe2,
  Info,
  Layers,
  Laptop,
  Lock,
  Mail,
  Megaphone,
  Monitor,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Tablet,
  Timer,
  Trash2,
  Unlock,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import type {
  AudiencePreviewResult,
  CreatePlatformAnnouncementInput,
  PlatformAnnouncement,
  PlatformAnnouncementAudienceType,
  PlatformAnnouncementSeverity,
  PlatformAnnouncementStats,
  PlatformAnnouncementStatus,
  TenantActiveAnnouncement,
  TenantPreviewQuery,
  TenantPreviewResult,
  UpdatePlatformAnnouncementInput,
} from '@hrm/shared-types';
import { usePlatformAuth } from '@/context/PlatformAuthContext';
import {
  archivePlatformAnnouncement,
  createPlatformAnnouncement,
  deletePlatformAnnouncement,
  expirePlatformAnnouncement,
  listPlatformAnnouncements,
  previewAsTenantAdmin,
  previewPlatformAudience,
  publishPlatformAnnouncement,
  updatePlatformAnnouncement,
} from '@/lib/announcements-api';

type FilterStatus = 'all' | 'published' | 'scheduled' | 'expired' | 'draft' | 'archived';

const AVAILABLE_PLANS = [
  { id: 'trial', label: 'Trial', color: 'slate' },
  { id: 'starter', label: 'Starter', color: 'blue' },
  { id: 'professional', label: 'Professional', color: 'indigo' },
  { id: 'enterprise', label: 'Enterprise', color: 'purple' },
];

const AVAILABLE_COUNTRIES = [
  { code: 'BD', name: 'Bangladesh', flag: '🇧🇩' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
];

const SAMPLE_TENANTS = [
  { id: '10000000-0000-4000-8000-000000000001', name: 'CMSN Bangladesh Ltd', plan: 'enterprise', country: 'BD', subdomain: 'cmsn' },
  { id: '10000000-0000-4000-8000-000000000002', name: 'Acme Australia Pty', plan: 'professional', country: 'AU', subdomain: 'acme-au' },
  { id: '10000000-0000-4000-8000-000000000003', name: 'Globex Software US', plan: 'starter', country: 'US', subdomain: 'globex' },
];

export function PlatformAnnouncementsPage() {
  const { user } = usePlatformAuth();
  const isPlatformManager =
    user?.roleName === 'Platform Owner' || user?.roleName === 'Platform Admin';

  const [announcements, setAnnouncements] = useState<
    Array<PlatformAnnouncement & { active: boolean; stats: PlatformAnnouncementStats }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State: Create / Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PlatformAnnouncement | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState<{
    title: string;
    body: string;
    severity: PlatformAnnouncementSeverity;
    audienceType: PlatformAnnouncementAudienceType;
    targetPlans: string[];
    targetCountries: string[];
    targetTenantIdsStr: string;
    rolesOnly: boolean;
    startTime: string;
    endTime: string;
    dismissible: boolean;
    sendEmail: boolean;
  }>({
    title: '',
    body: '',
    severity: 'info',
    audienceType: 'all',
    targetPlans: ['starter', 'professional', 'enterprise'],
    targetCountries: ['BD', 'AU'],
    targetTenantIdsStr: '',
    rolesOnly: false,
    startTime: new Date().toISOString().slice(0, 16),
    endTime: '',
    dismissible: true,
    sendEmail: false,
  });

  // Audience preview in create/edit modal
  const [previewLoading, setPreviewLoading] = useState(false);
  const [audiencePreview, setAudiencePreview] = useState<AudiencePreviewResult | null>(null);

  // Modal State: "Preview as Tenant Admin"
  const [tenantPreviewModalOpen, setTenantPreviewModalOpen] = useState(false);
  const [activePreviewAnnouncement, setActivePreviewAnnouncement] = useState<PlatformAnnouncement | null>(null);
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [simulatedPlan, setSimulatedPlan] = useState('enterprise');
  const [simulatedCountry, setSimulatedCountry] = useState('BD');
  const [simulatedRole, setSimulatedRole] = useState('Company Owner');
  const [simulatedTenantId, setSimulatedTenantId] = useState(SAMPLE_TENANTS[0].id);
  const [tenantPreviewResult, setTenantPreviewResult] = useState<TenantPreviewResult | null>(null);
  const [previewSimulatedDismissed, setPreviewSimulatedDismissed] = useState(false);

  // Confirmation Modals
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expireConfirmId, setExpireConfirmId] = useState<string | null>(null);

  // Fetch announcements
  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await listPlatformAnnouncements();
      setAnnouncements(res.items);
    } catch (err: any) {
      setError(err?.message || 'Failed to load platform announcements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  // Update audience preview when audience criteria change in modal
  useEffect(() => {
    if (!modalOpen) return;

    const timer = setTimeout(async () => {
      try {
        setPreviewLoading(true);
        const tenantIds = formData.targetTenantIdsStr
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

        const res = await previewPlatformAudience({
          audienceType: formData.audienceType,
          targetPlans: formData.targetPlans,
          targetCountries: formData.targetCountries,
          targetTenantIds: tenantIds,
          rolesOnly: formData.rolesOnly,
        });
        setAudiencePreview(res);
      } catch (err) {
        // silent preview error
      } finally {
        setPreviewLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [
    modalOpen,
    formData.audienceType,
    formData.targetPlans,
    formData.targetCountries,
    formData.targetTenantIdsStr,
    formData.rolesOnly,
  ]);

  // Update Tenant Admin Preview Simulator
  const fetchTenantAdminPreview = async () => {
    try {
      setPreviewSimulatedDismissed(false);
      const tenantIds = formData.targetTenantIdsStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await previewAsTenantAdmin({
        announcementId: activePreviewAnnouncement?.id,
        tenantId: simulatedTenantId,
        planId: simulatedPlan,
        country: simulatedCountry,
        roleName: simulatedRole,
        announcementData: activePreviewAnnouncement
          ? undefined
          : {
              title: formData.title,
              body: formData.body,
              severity: formData.severity,
              audienceType: formData.audienceType,
              targetPlans: formData.targetPlans,
              targetCountries: formData.targetCountries,
              targetTenantIds: tenantIds,
              rolesOnly: formData.rolesOnly,
              dismissible: formData.dismissible,
            },
      });
      setTenantPreviewResult(res);
    } catch (err) {
      // silent
    }
  };

  useEffect(() => {
    if (tenantPreviewModalOpen) {
      fetchTenantAdminPreview();
    }
  }, [
    tenantPreviewModalOpen,
    activePreviewAnnouncement,
    simulatedTenantId,
    simulatedPlan,
    simulatedCountry,
    simulatedRole,
  ]);

  const openCreateModal = () => {
    const now = new Date();
    setEditingItem(null);
    setFormData({
      title: '',
      body: '',
      severity: 'info',
      audienceType: 'all',
      targetPlans: ['starter', 'professional', 'enterprise'],
      targetCountries: ['BD', 'AU'],
      targetTenantIdsStr: '',
      rolesOnly: false,
      startTime: now.toISOString().slice(0, 16),
      endTime: '',
      dismissible: true,
      sendEmail: false,
    });
    setModalOpen(true);
  };

  const openEditModal = (item: PlatformAnnouncement) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      body: item.body,
      severity: item.severity,
      audienceType: item.audienceType,
      targetPlans: item.targetPlans || [],
      targetCountries: item.targetCountries || [],
      targetTenantIdsStr: (item.targetTenantIds || []).join(', '),
      rolesOnly: item.rolesOnly,
      startTime: item.startTime ? new Date(item.startTime).toISOString().slice(0, 16) : '',
      endTime: item.endTime ? new Date(item.endTime).toISOString().slice(0, 16) : '',
      dismissible: item.dismissible,
      sendEmail: item.sendEmail,
    });
    setModalOpen(true);
  };

  const openTenantPreviewForExisting = (item: PlatformAnnouncement) => {
    setActivePreviewAnnouncement(item);
    setSimulatedTenantId(SAMPLE_TENANTS[0].id);
    setSimulatedPlan(SAMPLE_TENANTS[0].plan);
    setSimulatedCountry(SAMPLE_TENANTS[0].country);
    setSimulatedRole('Company Owner');
    setTenantPreviewModalOpen(true);
  };

  const openTenantPreviewForCurrentDraft = () => {
    setActivePreviewAnnouncement(null);
    setSimulatedTenantId(SAMPLE_TENANTS[0].id);
    setSimulatedPlan(formData.targetPlans[0] || 'enterprise');
    setSimulatedCountry(formData.targetCountries[0] || 'BD');
    setSimulatedRole(formData.rolesOnly ? 'Company Owner' : 'Employee');
    setTenantPreviewModalOpen(true);
  };

  const handleSave = async (publishImmediately: boolean) => {
    if (!formData.title.trim()) {
      setError('Please provide an announcement title.');
      return;
    }
    if (!formData.body.trim()) {
      setError('Please provide an announcement message body.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const targetTenantIds = formData.targetTenantIdsStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        title: formData.title.trim(),
        body: formData.body.trim(),
        severity: formData.severity,
        audienceType: formData.audienceType,
        targetPlans: formData.targetPlans,
        targetCountries: formData.targetCountries,
        targetTenantIds,
        rolesOnly: formData.rolesOnly,
        startTime: new Date(formData.startTime).toISOString(),
        endTime: formData.endTime ? new Date(formData.endTime).toISOString() : null,
        dismissible: formData.dismissible,
        sendEmail: formData.sendEmail,
      };

      if (editingItem) {
        await updatePlatformAnnouncement(editingItem.id, payload);
        if (publishImmediately && editingItem.status !== 'published') {
          await publishPlatformAnnouncement(editingItem.id);
        }
        setSuccess('Announcement updated successfully.');
      } else {
        await createPlatformAnnouncement({
          ...payload,
          status: publishImmediately ? 'published' : 'draft',
        });
        setSuccess(
          publishImmediately
            ? 'Announcement published successfully.'
            : 'Announcement saved as draft.',
        );
      }

      setModalOpen(false);
      await loadAnnouncements();
    } catch (err: any) {
      setError(err?.message || 'Failed to save announcement');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (id: string) => {
    try {
      setError(null);
      await publishPlatformAnnouncement(id);
      setSuccess('Announcement published and active.');
      await loadAnnouncements();
    } catch (err: any) {
      setError(err?.message || 'Failed to publish announcement');
    }
  };

  const handleArchive = async (id: string) => {
    try {
      setError(null);
      await archivePlatformAnnouncement(id);
      setSuccess('Announcement archived.');
      await loadAnnouncements();
    } catch (err: any) {
      setError(err?.message || 'Failed to archive announcement');
    }
  };

  const handleExpireNow = async (id: string) => {
    try {
      setError(null);
      await expirePlatformAnnouncement(id);
      setExpireConfirmId(null);
      setSuccess('Announcement expired immediately. Delivery ceased.');
      await loadAnnouncements();
    } catch (err: any) {
      setError(err?.message || 'Failed to expire announcement');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setError(null);
      await deletePlatformAnnouncement(id);
      setDeleteConfirmId(null);
      setSuccess('Announcement deleted successfully.');
      await loadAnnouncements();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete announcement');
    }
  };

  // Filtered announcements
  const filteredAnnouncements = useMemo(() => {
    const now = new Date();
    return announcements.filter((item) => {
      const isExpired =
        item.status === 'published' && item.endTime && new Date(item.endTime) < now;
      const isScheduled = item.status === 'published' && new Date(item.startTime) > now;
      const isLive = item.status === 'published' && !isExpired && !isScheduled;

      // Status filter
      if (statusFilter === 'draft' && item.status !== 'draft') return false;
      if (statusFilter === 'archived' && item.status !== 'archived') return false;
      if (statusFilter === 'published' && !isLive) return false;
      if (statusFilter === 'scheduled' && !isScheduled) return false;
      if (statusFilter === 'expired' && !isExpired) return false;

      // Severity filter
      if (severityFilter !== 'all' && item.severity !== severityFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesBody = item.body.toLowerCase().includes(query);
        if (!matchesTitle && !matchesBody) return false;
      }

      return true;
    });
  }, [announcements, statusFilter, severityFilter, searchQuery]);

  // Severity styling helper
  const getSeverityBadge = (severity: PlatformAnnouncementSeverity) => {
    switch (severity) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
            Critical
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <AlertTriangle className="h-3 w-3" />
            Warning
          </span>
        );
      case 'info':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
            <Info className="h-3 w-3" />
            Info
          </span>
        );
    }
  };

  const getStatusBadge = (item: PlatformAnnouncement & { active: boolean }) => {
    const now = new Date();
    const isScheduled = item.status === 'published' && new Date(item.startTime) > now;
    const isExpired =
      item.status === 'published' && item.endTime && new Date(item.endTime) < now;

    if (item.status === 'draft') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
          Draft
        </span>
      );
    }
    if (item.status === 'archived') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20">
          Archived
        </span>
      );
    }
    if (isExpired) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          <Clock className="h-3 w-3" />
          Expired
        </span>
      );
    }
    if (isScheduled) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
          <Clock className="h-3 w-3" />
          Scheduled
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Live & Active
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Megaphone className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Platform Announcements
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Broadcast in-app header alerts and notification emails to tenant companies, owners, and
            administrators.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadAnnouncements}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {isPlatformManager && (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition"
            >
              <Plus className="h-4 w-4" />
              New Announcement
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="p-1 hover:bg-rose-500/20 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccess(null)}
            className="p-1 hover:bg-emerald-500/20 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(
            [
              { key: 'all', label: 'All' },
              { key: 'published', label: 'Live' },
              { key: 'scheduled', label: 'Scheduled' },
              { key: 'expired', label: 'Expired' },
              { key: 'draft', label: 'Drafts' },
              { key: 'archived', label: 'Archived' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                statusFilter === tab.key
                  ? 'bg-slate-900 text-white dark:bg-indigo-600 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Severity filter & Search */}
        <div className="flex items-center gap-3">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs font-medium rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>

          <div className="relative">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search announcements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-44 sm:w-56"
            />
          </div>
        </div>
      </div>

      {/* Announcements List */}
      <div className="space-y-4">
        {loading && (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />
            Loading announcements...
          </div>
        )}

        {!loading && filteredAnnouncements.length === 0 && (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <Megaphone className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              No announcements found
            </h3>
            <p className="text-sm mt-1">
              {searchQuery || statusFilter !== 'all' || severityFilter !== 'all'
                ? 'Try adjusting your filters or search terms.'
                : 'Create your first platform announcement to broadcast important news across tenant companies.'}
            </p>
            {isPlatformManager && (
              <button
                type="button"
                onClick={openCreateModal}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-sm"
              >
                <Plus className="h-4 w-4" />
                New Announcement
              </button>
            )}
          </div>
        )}

        {!loading &&
          filteredAnnouncements.map((item) => {
            const now = new Date();
            const isExpired =
              item.status === 'published' && item.endTime && new Date(item.endTime) < now;
            const isScheduled = item.status === 'published' && new Date(item.startTime) > now;
            const isLive = item.status === 'published' && !isExpired && !isScheduled;

            const targetUsers = item.stats?.targetUserCount || 0;
            const readCount = item.stats?.readCount || 0;
            const dismissalCount = item.stats?.dismissalCount || 0;

            const readPercent = targetUsers ? Math.min(100, Math.round((readCount / targetUsers) * 100)) : 0;
            const dismissPercent = targetUsers ? Math.min(100, Math.round((dismissalCount / targetUsers) * 100)) : 0;

            return (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:border-indigo-500/40 transition-all space-y-4"
              >
                {/* Top row: Badges, Title, Actions */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {getStatusBadge(item)}
                      {getSeverityBadge(item.severity)}
                      {item.rolesOnly && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                          <Shield className="h-3 w-3" />
                          Owners & Admins Only
                        </span>
                      )}
                      {item.dismissible ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800">
                          <Unlock className="h-3 w-3" />
                          Dismissible
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20">
                          <Lock className="h-3 w-3" />
                          Locked
                        </span>
                      )}
                      {item.sendEmail && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10">
                          <Mail className="h-3 w-3" />
                          Email Broadcast
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      {item.title}
                    </h3>
                  </div>

                  {/* Action buttons */}
                  {isPlatformManager && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {/* Preview as Tenant Admin Button */}
                      <button
                        type="button"
                        onClick={() => openTenantPreviewForExisting(item)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition inline-flex items-center gap-1.5 shadow-sm"
                        title="Simulate this announcement from the perspective of a tenant administrator"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Preview as Tenant
                      </button>

                      {item.status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => handlePublish(item.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition inline-flex items-center gap-1.5 shadow-sm"
                        >
                          <Send className="h-3.5 w-3.5" />
                          Publish
                        </button>
                      )}

                      {/* Expire Now action (active or scheduled) */}
                      {item.status === 'published' && !isExpired && (
                        <button
                          type="button"
                          onClick={() => setExpireConfirmId(item.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 transition inline-flex items-center gap-1.5"
                          title="Immediately terminate this announcement so tenants no longer see it"
                        >
                          <Timer className="h-3.5 w-3.5" />
                          Expire Now
                        </button>
                      )}

                      {item.status === 'published' && (
                        <button
                          type="button"
                          onClick={() => handleArchive(item.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
                        >
                          Archive
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(item.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 transition"
                        title="Delete announcement"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Body message preview */}
                <div className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  {item.body}
                </div>

                {/* Schedule, Audience, and Read/Dismiss Analytics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs pt-3 border-t border-slate-100 dark:border-slate-800">
                  {/* Column 1: Audience */}
                  <div>
                    <span className="text-slate-400 block mb-0.5">Audience Target</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize block truncate">
                      {item.audienceType === 'all' && 'All Tenants'}
                      {item.audienceType === 'by_plan' &&
                        `Plans: ${item.targetPlans?.join(', ') || 'None'}`}
                      {item.audienceType === 'by_country' &&
                        `Countries: ${item.targetCountries?.join(', ') || 'None'}`}
                      {item.audienceType === 'specific_tenants' &&
                        `${item.targetTenantIds?.length || 0} Tenants`}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {item.stats?.targetTenantCount ?? 0} matching workspaces
                    </span>
                  </div>

                  {/* Column 2: Schedule & Expiration */}
                  <div>
                    <span className="text-slate-400 block mb-0.5">Schedule & Lifecycle</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                      {new Date(item.startTime).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                      {item.endTime ? (
                        <>
                          Expires: {new Date(item.endTime).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </>
                      ) : (
                        'No expiration (Indefinite)'
                      )}
                    </span>
                  </div>

                  {/* Column 3: Read Count & Impressions */}
                  <div>
                    <span className="text-slate-400 block mb-0.5">Read Impressions</span>
                    <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                      <span>{readCount} views</span>
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                        {readPercent}%
                      </span>
                    </div>
                    {/* Read progress bar */}
                    <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-1 overflow-hidden flex">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all"
                        style={{ width: `${readPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Column 4: Dismissal Count */}
                  <div>
                    <span className="text-slate-400 block mb-0.5">Dismissals & Acknowledged</span>
                    <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                      <span>{dismissalCount} dismissed</span>
                      <span className="text-[11px] text-purple-600 dark:text-purple-400 font-bold">
                        {dismissPercent}%
                      </span>
                    </div>
                    {/* Dismissal progress bar */}
                    <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-1 overflow-hidden flex">
                      <div
                        className="bg-purple-500 h-full rounded-full transition-all"
                        style={{ width: `${dismissPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {/* ========================================================================= */}
      {/* CREATE / EDIT ANNOUNCEMENT MODAL WITH AUDIENCE BUILDER                   */}
      {/* ========================================================================= */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Megaphone className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {editingItem ? 'Edit Platform Announcement' : 'Create Platform Announcement'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Audience segmentation, start and expiration schedules, and live simulator preview.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: Inputs */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Title */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Announcement Title *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Scheduled Platform Maintenance or New Tax Rules"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Body text */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Message Body *
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Details of the announcement displayed to users..."
                      value={formData.body}
                      onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Severity Radio Cards */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Severity Level
                    </label>
                    <div className="grid grid-cols-3 gap-2.5">
                      {(
                        [
                          {
                            key: 'info',
                            label: 'Info',
                            desc: 'General updates',
                            icon: Info,
                            activeClass: 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400',
                          },
                          {
                            key: 'warning',
                            label: 'Warning',
                            desc: 'Action recommended',
                            icon: AlertTriangle,
                            activeClass: 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400',
                          },
                          {
                            key: 'critical',
                            label: 'Critical',
                            desc: 'Immediate attention',
                            icon: AlertOctagon,
                            activeClass: 'border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400',
                          },
                        ] as const
                      ).map((sev) => {
                        const Icon = sev.icon;
                        const isSelected = formData.severity === sev.key;
                        return (
                          <button
                            key={sev.key}
                            type="button"
                            onClick={() => setFormData({ ...formData, severity: sev.key })}
                            className={`p-3 rounded-xl border text-left transition ${
                              isSelected
                                ? sev.activeClass
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 font-bold text-xs">
                              <Icon className="h-4 w-4 shrink-0" />
                              {sev.label}
                            </div>
                            <div className="text-[11px] opacity-75 mt-0.5">{sev.desc}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Audience Builder Section */}
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-indigo-500" />
                        Audience Builder & Targeting
                      </label>
                      <span className="text-[10px] text-slate-400">Multi-tenant segmentation</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          { key: 'all', label: 'All Tenants' },
                          { key: 'by_plan', label: 'By Plan Tier' },
                          { key: 'by_country', label: 'By Country' },
                          { key: 'specific_tenants', label: 'Specific Tenants' },
                        ] as const
                      ).map((aud) => (
                        <button
                          key={aud.key}
                          type="button"
                          onClick={() => setFormData({ ...formData, audienceType: aud.key })}
                          className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition ${
                            formData.audienceType === aud.key
                              ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {aud.label}
                        </button>
                      ))}
                    </div>

                    {/* Conditional Audience Options */}
                    {formData.audienceType === 'by_plan' && (
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300 block">
                          Select Targeted Plans:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {AVAILABLE_PLANS.map((plan) => {
                            const checked = formData.targetPlans.includes(plan.id);
                            return (
                              <button
                                key={plan.id}
                                type="button"
                                onClick={() => {
                                  const updated = checked
                                    ? formData.targetPlans.filter((p) => p !== plan.id)
                                    : [...formData.targetPlans, plan.id];
                                  setFormData({ ...formData, targetPlans: updated });
                                }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                                  checked
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                {plan.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {formData.audienceType === 'by_country' && (
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300 block">
                          Select Targeted Countries:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {AVAILABLE_COUNTRIES.map((ct) => {
                            const checked = formData.targetCountries.includes(ct.code);
                            return (
                              <button
                                key={ct.code}
                                type="button"
                                onClick={() => {
                                  const updated = checked
                                    ? formData.targetCountries.filter((c) => c !== ct.code)
                                    : [...formData.targetCountries, ct.code];
                                  setFormData({ ...formData, targetCountries: updated });
                                }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                                  checked
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                {ct.flag} {ct.code} - {ct.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {formData.audienceType === 'specific_tenants' && (
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1.5">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block">
                          Tenant UUIDs (comma-separated):
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 10000000-0000-4000-8000-000000000001"
                          value={formData.targetTenantIdsStr}
                          onChange={(e) =>
                            setFormData({ ...formData, targetTenantIdsStr: e.target.value })
                          }
                          className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                    )}

                    {/* Target Only Owners and Admins */}
                    <label className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.rolesOnly}
                        onChange={(e) => setFormData({ ...formData, rolesOnly: e.target.checked })}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                          Limit to Company Owners & Admins
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Restricts display exclusively to tenant decision-makers and administrators.
                        </span>
                      </div>
                    </label>
                  </div>

                  {/* Schedule: Start & Expiration */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Start Date/Time *
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.startTime}
                        onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Expiration Date/Time (Optional)
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.endTime}
                        onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Options: Dismissible & Email */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.dismissible}
                        onChange={(e) =>
                          setFormData({ ...formData, dismissible: e.target.checked })
                        }
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                          Dismissible
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Users can close banner
                        </span>
                      </div>
                    </label>

                    <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.sendEmail}
                        onChange={(e) =>
                          setFormData({ ...formData, sendEmail: e.target.checked })
                        }
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                          Send Email Broadcast
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Deliver notification email
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Right: Live Preview & Audience Simulator */}
                <div className="lg:col-span-5 space-y-5 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Live Banner Preview
                      </h3>
                      {/* Button to open full Tenant Admin Preview */}
                      <button
                        type="button"
                        onClick={openTenantPreviewForCurrentDraft}
                        className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        <Eye className="h-3 w-3" />
                        Preview as Tenant Admin
                      </button>
                    </div>

                    {/* Preview Banner Container */}
                    <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm bg-slate-900">
                      <div className="px-3 py-1.5 bg-slate-950 text-[10px] text-slate-400 flex items-center justify-between border-b border-slate-800">
                        <span>Tenant Admin Panel Header Preview</span>
                        <span className="capitalize">{formData.severity} severity</span>
                      </div>

                      {/* Mock Header Banner */}
                      <div
                        className={`p-3 text-xs flex items-center justify-between gap-3 ${
                          formData.severity === 'critical'
                            ? 'bg-rose-600 text-white'
                            : formData.severity === 'warning'
                            ? 'bg-amber-500 text-amber-950'
                            : 'bg-blue-600 text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          {formData.severity === 'critical' ? (
                            <AlertOctagon className="h-4 w-4 shrink-0 animate-pulse" />
                          ) : formData.severity === 'warning' ? (
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                          ) : (
                            <Info className="h-4 w-4 shrink-0" />
                          )}
                          <div className="truncate">
                            <span className="font-bold mr-1.5">
                              {formData.title || 'Announcement Title'}
                            </span>
                            <span className="opacity-90">
                              {formData.body || 'Announcement message preview goes here...'}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-1.5">
                          {formData.dismissible ? (
                            <button
                              type="button"
                              className={`p-1 rounded hover:bg-black/10 transition ${
                                formData.severity === 'warning' ? 'text-amber-950' : 'text-white'
                              }`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${
                                formData.severity === 'warning'
                                  ? 'bg-amber-600/20 text-amber-950'
                                  : 'bg-black/20 text-white'
                              }`}
                            >
                              <Lock className="h-2.5 w-2.5" /> Locked
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Audience Simulation Card */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-indigo-500" />
                          Target Audience Simulator
                        </span>
                        {previewLoading && (
                          <RefreshCw className="h-3 w-3 animate-spin text-slate-400" />
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-center">
                        <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                          <div className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400">
                            {audiencePreview?.tenantCount ?? 0}
                          </div>
                          <div className="text-[11px] text-slate-500">Matching Tenants</div>
                        </div>

                        <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                          <div className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400">
                            {audiencePreview?.userCount ?? 0}
                          </div>
                          <div className="text-[11px] text-slate-500">Recipients</div>
                        </div>
                      </div>

                      {audiencePreview?.sampleTenants &&
                        audiencePreview.sampleTenants.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[11px] text-slate-500 block font-medium">
                              Sample Matching Workspaces:
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {audiencePreview.sampleTenants.map((t) => (
                                <span
                                  key={t.id}
                                  className="px-2 py-0.5 rounded text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                                >
                                  {t.name} ({t.planId})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 italic">
                    Note: Announcements are delivered in real-time through the notification engine
                    and appear in the tenant Admin Panel header upon next poll or page load.
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave(true)}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition inline-flex items-center gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  {saving ? 'Publishing...' : 'Publish Announcement'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* "PREVIEW AS TENANT ADMIN" INTERACTIVE SIMULATOR MODAL                     */}
      {/* ========================================================================= */}
      {tenantPreviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-5xl my-6 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Simulator Header & Controls */}
            <div className="p-4 bg-slate-900 text-white border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Monitor className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    Tenant Admin Portal Viewport Simulator
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                      Live Preview
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Verify exactly how a tenant admin views this announcement in their Admin Panel header.
                  </p>
                </div>
              </div>

              {/* Viewport switchers & Close */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setPreviewViewport('desktop')}
                    className={`p-1.5 rounded-md text-xs font-medium transition flex items-center gap-1 ${
                      previewViewport === 'desktop' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Desktop 1200px"
                  >
                    <Monitor className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Desktop</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewViewport('tablet')}
                    className={`p-1.5 rounded-md text-xs font-medium transition flex items-center gap-1 ${
                      previewViewport === 'tablet' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Tablet 768px"
                  >
                    <Tablet className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Tablet</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewViewport('mobile')}
                    className={`p-1.5 rounded-md text-xs font-medium transition flex items-center gap-1 ${
                      previewViewport === 'mobile' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Mobile 375px"
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Mobile</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setTenantPreviewModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Simulation Parameter Controls Bar */}
            <div className="px-5 py-3 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                {/* Select Tenant Workspace */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Workspace:</span>
                  <select
                    value={simulatedTenantId}
                    onChange={(e) => {
                      setSimulatedTenantId(e.target.value);
                      const t = SAMPLE_TENANTS.find((item) => item.id === e.target.value);
                      if (t) {
                        setSimulatedPlan(t.plan);
                        setSimulatedCountry(t.country);
                      }
                    }}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {SAMPLE_TENANTS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.plan.toUpperCase()} • {t.country})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Simulated Plan */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Plan:</span>
                  <select
                    value={simulatedPlan}
                    onChange={(e) => setSimulatedPlan(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 capitalize"
                  >
                    {AVAILABLE_PLANS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Simulated Country */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Country:</span>
                  <select
                    value={simulatedCountry}
                    onChange={(e) => setSimulatedCountry(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {AVAILABLE_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} ({c.name})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Simulated User Role */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Role:</span>
                  <select
                    value={simulatedRole}
                    onChange={(e) => setSimulatedRole(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Company Owner">Company Owner</option>
                    <option value="HR Admin">HR Admin</option>
                    <option value="Payroll Admin">Payroll Admin</option>
                    <option value="Employee">Employee (Self-Service)</option>
                  </select>
                </div>
              </div>

              {/* Match Indicator */}
              <div>
                {tenantPreviewResult?.matches ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Will Display in Header
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                    <XCircle className="h-3.5 w-3.5" />
                    Will NOT Display (Filtered Out)
                  </span>
                )}
              </div>
            </div>

            {/* Match Criteria Reasons Accordion */}
            {tenantPreviewResult && (
              <div className="px-5 py-2 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-[11px] space-y-1">
                <span className="text-slate-400 font-semibold uppercase tracking-wider block">
                  Target Evaluation Breakdown:
                </span>
                <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-0.5">
                  {tenantPreviewResult.matchReasons.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Viewport Frame */}
            <div className="p-6 overflow-y-auto bg-slate-200 dark:bg-slate-950 flex items-center justify-center min-h-[460px]">
              <div
                className={`bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-300 dark:border-slate-800 overflow-hidden transition-all duration-300 ${
                  previewViewport === 'mobile'
                    ? 'w-[375px]'
                    : previewViewport === 'tablet'
                    ? 'w-[768px]'
                    : 'w-full max-w-4xl'
                }`}
              >
                {/* 1. Simulated AppShell Header Banner (The Target of Preview) */}
                {tenantPreviewResult?.matches && tenantPreviewResult.banner && !previewSimulatedDismissed ? (
                  <div
                    role="alert"
                    className={`px-4 py-2.5 text-xs font-medium z-50 flex items-center justify-between gap-3 ${
                      tenantPreviewResult.banner.severity === 'critical'
                        ? 'bg-rose-600 text-white border-b border-rose-700'
                        : tenantPreviewResult.banner.severity === 'warning'
                        ? 'bg-amber-500 text-amber-950 border-b border-amber-600'
                        : 'bg-blue-600 text-white border-b border-blue-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden flex-1 min-w-0">
                      <div className="shrink-0">
                        {tenantPreviewResult.banner.severity === 'critical' ? (
                          <div className="h-5 w-5 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                            <AlertOctagon className="h-3.5 w-3.5" />
                          </div>
                        ) : tenantPreviewResult.banner.severity === 'warning' ? (
                          <div className="h-5 w-5 rounded-full bg-amber-950/15 flex items-center justify-center">
                            <AlertTriangle className="h-3.5 w-3.5" />
                          </div>
                        ) : (
                          <div className="h-5 w-5 rounded-full bg-white/20 flex items-center justify-center">
                            <Info className="h-3.5 w-3.5" />
                          </div>
                        )}
                      </div>

                      <div className="truncate flex items-center gap-2 flex-1 min-w-0">
                        <span
                          className={`font-bold uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                            tenantPreviewResult.banner.severity === 'critical'
                              ? 'bg-rose-700/80 text-rose-100'
                              : tenantPreviewResult.banner.severity === 'warning'
                              ? 'bg-amber-600/30 text-amber-950'
                              : 'bg-blue-700/80 text-blue-100'
                          }`}
                        >
                          {tenantPreviewResult.banner.severity === 'critical'
                            ? 'Critical Alert'
                            : tenantPreviewResult.banner.severity === 'warning'
                            ? 'Notice'
                            : 'Announcement'}
                        </span>

                        <span className="font-bold shrink-0">{tenantPreviewResult.banner.title}</span>
                        <span className="opacity-90 truncate font-normal">
                          — {tenantPreviewResult.banner.body}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {tenantPreviewResult.banner.dismissible ? (
                        <button
                          type="button"
                          onClick={() => setPreviewSimulatedDismissed(true)}
                          className={`p-1 rounded-md transition ${
                            tenantPreviewResult.banner.severity === 'warning'
                              ? 'hover:bg-amber-600/30 text-amber-950'
                              : 'hover:bg-white/20 text-white'
                          }`}
                          title="Click to simulate tenant admin dismissal"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded ${
                            tenantPreviewResult.banner.severity === 'warning'
                              ? 'bg-amber-600/20 text-amber-950'
                              : 'bg-black/25 text-white'
                          }`}
                          title="Pinned announcement cannot be dismissed"
                        >
                          <Lock className="h-3 w-3" />
                          Pinned
                        </span>
                      )}
                    </div>
                  </div>
                ) : null}

                {/* Notice if dismissed in simulator */}
                {previewSimulatedDismissed && (
                  <div className="p-2.5 bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between">
                    <span>✓ Banner was dismissed by simulated tenant admin.</span>
                    <button
                      type="button"
                      onClick={() => setPreviewSimulatedDismissed(false)}
                      className="font-bold underline text-[11px]"
                    >
                      Reset Preview
                    </button>
                  </div>
                )}

                {/* Notice if not matched */}
                {!tenantPreviewResult?.matches && (
                  <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs text-center border-b border-slate-200 dark:border-slate-700 italic">
                    (Announcement does not match this simulated tenant admin; header banner remains hidden)
                  </div>
                )}

                {/* 2. Simulated Tenant Topbar */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                      {tenantPreviewResult?.tenantInfo.subdomain.slice(0, 2).toUpperCase() || 'TX'}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-white">
                        {tenantPreviewResult?.tenantInfo.name || 'Tenant Workspace'}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {tenantPreviewResult?.tenantInfo.planId.toUpperCase()} PLAN • {tenantPreviewResult?.tenantInfo.country}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-400 w-36">
                      <Search className="h-3 w-3" /> Search...
                    </div>
                    <div className="h-7 w-7 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500">
                      <Bell className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-700">
                      <div className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center">
                        SC
                      </div>
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 hidden sm:inline">
                        {simulatedRole}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Simulated Dashboard Canvas */}
                <div className="p-5 space-y-4 bg-slate-50/50 dark:bg-slate-900/50 min-h-[220px]">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        Company Admin Dashboard
                      </div>
                      <div className="text-xs text-slate-400">Welcome back, Sarah Chen</div>
                    </div>
                    <div className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 font-semibold text-[11px]">
                      Payroll Ready
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-1">
                      <div className="text-[10px] text-slate-400 font-medium">Headcount</div>
                      <div className="text-base font-bold text-slate-900 dark:text-white">128 Employees</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-1">
                      <div className="text-[10px] text-slate-400 font-medium">Pending Requests</div>
                      <div className="text-base font-bold text-amber-600">6 Leave Approvals</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-1">
                      <div className="text-[10px] text-slate-400 font-medium">Next Pay Period</div>
                      <div className="text-base font-bold text-indigo-600">Nov 30, 2026</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Simulator Footer */}
            <div className="p-4 bg-slate-100 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Live simulation renders exact header styles and responsive breakpoints.
              </span>
              <button
                type="button"
                onClick={() => setTenantPreviewModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-indigo-600 hover:opacity-90 transition shadow-sm"
              >
                Close Simulator
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EXPIRE NOW CONFIRMATION MODAL                                             */}
      {/* ========================================================================= */}
      {expireConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 mx-auto">
              <Timer className="h-6 w-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Expire Announcement Now?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                This will immediately set the announcement expiration date to now. The banner will be
                instantly removed from all tenant Admin Panel headers upon their next refresh.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setExpireConfirmId(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleExpireNow(expireConfirmId)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white transition shadow-sm"
              >
                Expire Immediately
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODAL                                                 */}
      {/* ========================================================================= */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400 mx-auto">
              <Trash2 className="h-6 w-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Delete Announcement?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Are you sure you want to delete this announcement? This action cannot be undone and
                will permanently purge engagement and read statistics.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
