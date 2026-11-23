import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BellRing,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  Globe2,
  HelpCircle,
  Info,
  Layers,
  MessageSquare,
  Power,
  RefreshCw,
  Save,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  UploadCloud,
  Users,
  Webhook,
  Zap,
} from 'lucide-react';
import type {
  GlobalKillSwitch,
  MaintenanceConfig,
  PlatformMaintenanceOverview,
  ToggleKillSwitchInput,
  UpdateMaintenanceInput,
} from '@hrm/shared-types';
import { usePlatformAuth } from '@/context/PlatformAuthContext';
import {
  getMaintenanceOverview,
  toggleKillSwitch,
  updateMaintenanceConfig,
} from '@/lib/maintenance-api';

export function PlatformMaintenancePage() {
  const { user } = usePlatformAuth();
  const isPlatformManager =
    user?.roleName === 'Platform Owner' || user?.roleName === 'Platform Admin';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [config, setConfig] = useState<MaintenanceConfig>({
    enabled: false,
    scheduledStart: null,
    scheduledEnd: null,
    customMessage:
      'CMSN-HR is undergoing scheduled maintenance and system optimization.',
    status: 'inactive',
    lastChangedBy: null,
    lastChangedAt: null,
    lastReason: null,
  });

  const [killSwitches, setKillSwitches] = useState<GlobalKillSwitch[]>([]);

  // Form edits for maintenance schedule
  const [editEnabled, setEditEnabled] = useState(false);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editMessage, setEditMessage] = useState('');

  // Preview tab
  const [previewTab, setPreviewTab] = useState<
    'banner' | 'maintenance-page' | 'mobile'
  >('banner');

  // Reason Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<{
    type: 'maintenance' | 'killSwitch';
    targetState?: boolean;
    killSwitchKey?: string;
    killSwitchName?: string;
  } | null>(null);
  const [typedReason, setTypedReason] = useState('');
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMaintenanceOverview();
      setConfig(data.maintenance);
      setKillSwitches(data.killSwitches);

      setEditEnabled(data.maintenance.enabled);
      setEditStart(
        data.maintenance.scheduledStart
          ? new Date(data.maintenance.scheduledStart).toISOString().slice(0, 16)
          : '',
      );
      setEditEnd(
        data.maintenance.scheduledEnd
          ? new Date(data.maintenance.scheduledEnd).toISOString().slice(0, 16)
          : '',
      );
      setEditMessage(
        data.maintenance.customMessage ||
          'CMSN-HR is undergoing scheduled maintenance and system optimization.',
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load maintenance status and toggles',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openMaintenanceReasonModal = (newEnabledState: boolean) => {
    setModalAction({
      type: 'maintenance',
      targetState: newEnabledState,
    });
    setTypedReason('');
    setModalOpen(true);
  };

  const openKillSwitchModal = (item: GlobalKillSwitch) => {
    setModalAction({
      type: 'killSwitch',
      targetState: !item.enabled,
      killSwitchKey: item.key,
      killSwitchName: item.name,
    });
    setTypedReason('');
    setModalOpen(true);
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedReason.trim() || typedReason.trim().length < 3) {
      setError('A descriptive reason of at least 3 characters is required.');
      return;
    }

    if (!modalAction) return;

    try {
      setModalSubmitting(true);
      setError(null);

      if (modalAction.type === 'maintenance') {
        const payload: UpdateMaintenanceInput = {
          enabled:
            modalAction.targetState !== undefined
              ? modalAction.targetState
              : editEnabled,
          scheduledStart: editStart ? new Date(editStart).toISOString() : null,
          scheduledEnd: editEnd ? new Date(editEnd).toISOString() : null,
          customMessage: editMessage.trim(),
          reason: typedReason.trim(),
        };

        const updated = await updateMaintenanceConfig(payload);
        setConfig(updated);
        setEditEnabled(updated.enabled);
        setSuccess(
          `Maintenance mode updated to ${updated.status.toUpperCase()} successfully.`,
        );
      } else if (modalAction.type === 'killSwitch' && modalAction.killSwitchKey) {
        const payload: ToggleKillSwitchInput = {
          enabled: Boolean(modalAction.targetState),
          reason: typedReason.trim(),
        };

        const updated = await toggleKillSwitch(
          modalAction.killSwitchKey,
          payload,
        );
        setKillSwitches((prev) =>
          prev.map((k) => (k.key === updated.key ? updated : k)),
        );
        setSuccess(
          `Kill switch "${updated.name}" is now ${updated.enabled ? 'OPERATIONAL' : 'KILLED'}.`,
        );
      }

      setModalOpen(false);
      setModalAction(null);
      setTypedReason('');
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Action failed. Please try again.',
      );
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleSaveScheduleOnly = () => {
    // Save schedule and message changes
    setModalAction({
      type: 'maintenance',
      targetState: editEnabled,
    });
    setTypedReason('Schedule or custom message update');
    setModalOpen(true);
  };

  const handleClearSchedule = () => {
    setEditStart('');
    setEditEnd('');
  };

  const formatDate = (iso?: string | null) => {
    if (!iso) return 'None';
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  };

  const getStatusBadge = (status: 'active' | 'scheduled' | 'inactive') => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 animate-pulse">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            Active Outage
          </span>
        );
      case 'scheduled':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="h-3.5 w-3.5 text-amber-500" />
            Scheduled Window
          </span>
        );
      case 'inactive':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            All Systems Operational
          </span>
        );
    }
  };

  const getKillSwitchIcon = (key: string) => {
    switch (key) {
      case 'outgoing_sms':
        return <Send className="h-5 w-5 text-indigo-500" />;
      case 'outgoing_webhooks':
        return <Webhook className="h-5 w-5 text-amber-500" />;
      case 'new_signups':
        return <Users className="h-5 w-5 text-emerald-500" />;
      case 'file_uploads':
        return <UploadCloud className="h-5 w-5 text-blue-500" />;
      case 'payroll_execution':
        return <Zap className="h-5 w-5 text-purple-500" />;
      case 'external_integrations':
        return <Layers className="h-5 w-5 text-cyan-500" />;
      default:
        return <Power className="h-5 w-5 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* 1. Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
              <Power className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  Maintenance Mode & Global Toggles
                </h1>
                {getStatusBadge(config.status)}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Stage D Operations • Platform availability control, scheduled tenant banners, and emergency kill switches.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Status
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">Operation Error</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">Action Confirmed</p>
            <p>{success}</p>
          </div>
        </div>
      )}

      {/* 2. Top Banner / Status Overview Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Maintenance Controls */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-6">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="h-5 w-5 text-amber-500" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Platform Maintenance Switch & Window
                </h2>
              </div>
              <span className="text-xs text-slate-500">
                Rule-gated to Platform Owner / Admin
              </span>
            </div>

            {/* Immediate Switch */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-slate-900 dark:text-white">
                    Immediate Maintenance State
                  </span>
                  {config.enabled ? (
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-500 text-white">
                      ACTIVE OUTAGE
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      Normal Mode
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Enabling immediate maintenance blocks tenant requests, directs web users to the maintenance page, and returns 503 to mobile apps with offline queue retention.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  disabled={!isPlatformManager}
                  onClick={() => openMaintenanceReasonModal(!config.enabled)}
                  className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    config.enabled ? 'bg-rose-600' : 'bg-slate-300 dark:bg-slate-700'
                  } ${!isPlatformManager ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      config.enabled ? 'translate-x-7' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 w-16">
                  {config.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>

            {/* Schedule Windows */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  Scheduled Start Time (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                  disabled={!isPlatformManager}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-[11px] text-slate-400 block mt-1">
                  Notice banner appears before this time.
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  Scheduled End Time (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={editEnd}
                  onChange={(e) => setEditEnd(e.target.value)}
                  disabled={!isPlatformManager}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-[11px] text-slate-400 block mt-1">
                  Target restoration timestamp shown to users.
                </span>
              </div>
            </div>

            {/* Custom Message */}
            <div className="mb-6">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
                Custom Outage / Banner Message
              </label>
              <textarea
                rows={3}
                value={editMessage}
                onChange={(e) => setEditMessage(e.target.value)}
                disabled={!isPlatformManager}
                placeholder="Describe maintenance scope, estimated completion, and reassurance for tenant operations..."
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-[11px] text-slate-400 block mt-1">
                Rendered across tenant web banners, maintenance landing screens, and mobile sync error bodies.
              </span>
            </div>

            {/* Schedule Actions & Audit details */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Last modified by:
                  </span>
                  <span>{config.lastChangedBy || 'System Baseline'}</span>
                  {config.lastChangedAt && (
                    <span>• {formatDate(config.lastChangedAt)}</span>
                  )}
                </div>
                {config.lastReason && (
                  <div className="italic text-slate-600 dark:text-slate-400">
                    &ldquo;{config.lastReason}&rdquo;
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClearSchedule}
                  disabled={!isPlatformManager || (!editStart && !editEnd)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition disabled:opacity-40"
                >
                  Clear Schedule
                </button>
                <button
                  type="button"
                  onClick={handleSaveScheduleOnly}
                  disabled={!isPlatformManager}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-sm"
                >
                  <Save className="h-3.5 w-3.5" />
                  Save Schedule & Message
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Tenant & Mobile Experience Preview */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-500" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Live Tenant Preview
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">Simulator</span>
            </div>

            {/* Preview Tabs */}
            <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1 mb-4 text-xs font-medium">
              <button
                type="button"
                onClick={() => setPreviewTab('banner')}
                className={`flex-1 py-1.5 text-center rounded-md transition ${
                  previewTab === 'banner'
                    ? 'bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-white'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Banner
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('maintenance-page')}
                className={`flex-1 py-1.5 text-center rounded-md transition ${
                  previewTab === 'maintenance-page'
                    ? 'bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-white'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Web Outage
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('mobile')}
                className={`flex-1 py-1.5 text-center rounded-md transition ${
                  previewTab === 'mobile'
                    ? 'bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-white'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Mobile Sync
              </button>
            </div>

            {/* Preview Box */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden min-h-[220px] flex flex-col justify-center bg-slate-50 dark:bg-slate-950 p-4 text-xs">
              {previewTab === 'banner' && (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-900 dark:text-amber-200">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-xs">
                          Upcoming Scheduled Maintenance
                        </p>
                        <p className="text-[11px] mt-0.5 text-amber-800 dark:text-amber-300">
                          {editMessage ||
                            'CMSN-HR will be briefly unavailable for database maintenance.'}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                          <span>Window: {formatDate(editStart)}</span>
                          <span>→</span>
                          <span>{formatDate(editEnd)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 italic text-center">
                    Appears across all tenant admin portal headers prior to outage start.
                  </p>
                </div>
              )}

              {previewTab === 'maintenance-page' && (
                <div className="text-center p-3 space-y-2">
                  <div className="h-10 w-10 mx-auto rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
                    <Power className="h-5 w-5" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    Scheduled Maintenance in Progress
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                    {editMessage ||
                      'CMSN-HR is undergoing essential maintenance. Normal service will resume shortly.'}
                  </p>
                  <div className="inline-block px-2.5 py-1 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-mono text-slate-700 dark:text-slate-300">
                    Target Return: {formatDate(editEnd)}
                  </div>
                </div>
              )}

              {previewTab === 'mobile' && (
                <div className="space-y-2 font-mono text-[11px]">
                  <div className="flex items-center justify-between text-slate-500 text-[10px] pb-1 border-b border-slate-200 dark:border-slate-800">
                    <span>HTTP 503 SERVICE UNAVAILABLE</span>
                    <span className="text-emerald-500 font-semibold">Queue Retained</span>
                  </div>
                  <pre className="p-2 bg-slate-900 text-slate-100 rounded-lg text-[10px] overflow-x-auto leading-relaxed">
{JSON.stringify(
  {
    code: 'MAINTENANCE_MODE',
    message: editMessage || 'CMSN-HR is undergoing maintenance...',
    scheduledEnd: editEnd ? new Date(editEnd).toISOString() : null,
    offlineQueueRetained: true,
  },
  null,
  2,
)}
                  </pre>
                  <p className="text-[10px] text-slate-400 text-center font-sans italic">
                    Per /docs/OFFLINE_SYNC.md: Mobile app pauses sync without dropping records.
                  </p>
                </div>
              )}
            </div>

            {/* Offline sync safety badge */}
            <div className="mt-4 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs flex items-center gap-2.5">
              <Smartphone className="h-4 w-4 shrink-0 text-blue-500" />
              <div className="text-[11px] leading-tight">
                <span className="font-semibold">Zero Mobile Data Loss:</span> Offline punch logs & leave sync requests are safely retained on local devices during maintenance.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Global Kill Switches Grid */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-rose-500" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Global Kill Switches (Circuit Breakers)
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Instantly disable risky integrations or high-load background tasks across all tenants with an audited typed reason.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {killSwitches.filter((k) => !k.enabled).length} KILLED • {killSwitches.filter((k) => k.enabled).length} OPERATIONAL
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {killSwitches.map((item) => {
            const isKilled = !item.enabled;
            return (
              <div
                key={item.key}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                  isKilled
                    ? 'bg-rose-500/5 border-rose-500/30 dark:bg-rose-950/20'
                    : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/60'
                }`}
              >
                <div>
                  {/* Top Bar with Icon & Status */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-slate-700/60 flex items-center justify-center">
                        {getKillSwitchIcon(item.key)}
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {item.category}
                      </span>
                    </div>

                    {isKilled ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500 text-white">
                        KILLED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Active
                      </span>
                    )}
                  </div>

                  {/* Title & Description */}
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                    {item.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                {/* Footer with Toggle & Audit info */}
                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-700/60">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {isKilled ? 'Feature Suspended' : 'Feature Normal'}
                    </span>

                    <button
                      type="button"
                      disabled={!isPlatformManager}
                      onClick={() => openKillSwitchModal(item)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        item.enabled ? 'bg-emerald-600' : 'bg-rose-600'
                      } ${!isPlatformManager ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          item.enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Audit Metadata */}
                  <div className="text-[11px] text-slate-400 space-y-0.5">
                    <div className="truncate">
                      Changed by:{' '}
                      <span className="font-semibold text-slate-600 dark:text-slate-300">
                        {item.lastChangedBy || 'Baseline'}
                      </span>
                    </div>
                    {item.lastChangedAt && (
                      <div>{formatDate(item.lastChangedAt)}</div>
                    )}
                    {item.lastReason && (
                      <div className="italic text-slate-500 truncate" title={item.lastReason}>
                        &ldquo;{item.lastReason}&rdquo;
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Typed Reason Confirmation Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                  modalAction?.type === 'killSwitch' && !modalAction.targetState
                    ? 'bg-rose-500/10 text-rose-500'
                    : 'bg-amber-500/10 text-amber-500'
                }`}
              >
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {modalAction?.type === 'maintenance'
                    ? 'Confirm Maintenance Mode Change'
                    : `Toggle Circuit Breaker: ${modalAction?.killSwitchName}`}
                </h3>
                <p className="text-xs text-slate-500">
                  A typed operational reason is strictly required for the audit trail.
                </p>
              </div>
            </div>

            <form onSubmit={handleModalSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Operational Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  autoFocus
                  value={typedReason}
                  onChange={(e) => setTypedReason(e.target.value)}
                  placeholder="e.g., Mitigating Twilio upstream outage incident INC-8492"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-[11px] text-slate-400 block mt-1">
                  Actor recorded: <span className="font-semibold text-slate-700 dark:text-slate-300">{user?.name || user?.email || 'Platform Operator'}</span>
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    setModalAction(null);
                  }}
                  disabled={modalSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting || typedReason.trim().length < 3}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white rounded-xl transition ${
                    modalAction?.type === 'killSwitch' && !modalAction.targetState
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {modalSubmitting ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Confirm & Apply Change
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
