// apps/platform/src/pages/platform/WebhookMonitorPage.tsx
import React, { useEffect, useState, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  Ban,
  Building2,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  Filter,
  RefreshCw,
  Search,
  ShieldAlert,
  Sliders,
  ToggleLeft,
  ToggleRight,
  Webhook,
  X,
  Zap,
} from 'lucide-react';
import type {
  AutoDisableFailingEndpointsResult,
  PlatformWebhookDeliveryItem,
  PlatformWebhookEndpointItem,
  PlatformWebhookMonitorSummary,
  TenantWebhookStatus,
  WebhookDeliveryState,
} from '@hrm/shared-types';
import {
  autoDisableFailingPlatformEndpoints,
  getPlatformWebhookDeliveryDetail,
  getPlatformWebhookMonitorSummary,
  listPlatformWebhookDeliveries,
  listPlatformWebhookEndpoints,
  redeliverPlatformWebhook,
  togglePlatformWebhookEndpointStatus,
} from '../../lib/platform-webhook-monitor-api';
import { usePermission } from '@/hooks/usePermission';

type TabKey = 'deliveries' | 'endpoints';

export const WebhookMonitorPage: React.FC = () => {
  const canEdit = usePermission('platform', 'edit');
  const [activeTab, setActiveTab] = useState<TabKey>('deliveries');

  // Summary state
  const [summary, setSummary] = useState<PlatformWebhookMonitorSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Deliveries state
  const [deliveries, setDeliveries] = useState<PlatformWebhookDeliveryItem[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);
  const [deliverySearch, setDeliverySearch] = useState('');
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<string>('all');
  const [deliveryEventFilter, setDeliveryEventFilter] = useState<string>('');

  // Endpoints state
  const [endpoints, setEndpoints] = useState<PlatformWebhookEndpointItem[]>([]);
  const [loadingEndpoints, setLoadingEndpoints] = useState(false);
  const [endpointSearch, setEndpointSearch] = useState('');
  const [endpointStatusFilter, setEndpointStatusFilter] = useState<string>('all');
  const [failingOnlyFilter, setFailingOnlyFilter] = useState(false);

  // Modals & Drawers
  const [inspectingDelivery, setInspectingDelivery] = useState<PlatformWebhookDeliveryItem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [redeliveringId, setRedeliveringId] = useState<string | null>(null);

  // Auto-disable modal
  const [showAutoDisableModal, setShowAutoDisableModal] = useState(false);
  const [failingDaysInput, setFailingDaysInput] = useState<number>(3);
  const [isDryRun, setIsDryRun] = useState<boolean>(false);
  const [runningAutoDisable, setRunningAutoDisable] = useState(false);
  const [autoDisableResult, setAutoDisableResult] = useState<AutoDisableFailingEndpointsResult | null>(null);

  // Notification flash
  const [bannerNotice, setBannerNotice] = useState<{
    tone: 'success' | 'danger';
    text: string;
  } | null>(null);

  const showNotice = (text: string, tone: 'success' | 'danger' = 'success') => {
    setBannerNotice({ text, tone });
    setTimeout(() => setBannerNotice(null), 5000);
  };

  const fetchSummary = async () => {
    try {
      setLoadingSummary(true);
      const data = await getPlatformWebhookMonitorSummary();
      setSummary(data);
    } catch (err: any) {
      console.error('Failed to load webhook summary', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const fetchDeliveries = async () => {
    try {
      setLoadingDeliveries(true);
      const res = await listPlatformWebhookDeliveries({
        search: deliverySearch || undefined,
        status: deliveryStatusFilter,
        eventType: deliveryEventFilter || undefined,
        limit: 50,
      });
      setDeliveries(res.data);
    } catch (err: any) {
      console.error('Failed to load deliveries', err);
      showNotice(err.message || 'Failed to load deliveries', 'danger');
    } finally {
      setLoadingDeliveries(false);
    }
  };

  const fetchEndpoints = async () => {
    try {
      setLoadingEndpoints(true);
      const res = await listPlatformWebhookEndpoints({
        search: endpointSearch || undefined,
        status: endpointStatusFilter,
        failingOnly: failingOnlyFilter,
        limit: 50,
      });
      setEndpoints(res.data);
    } catch (err: any) {
      console.error('Failed to load endpoints', err);
      showNotice(err.message || 'Failed to load endpoints', 'danger');
    } finally {
      setLoadingEndpoints(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  useEffect(() => {
    if (activeTab === 'deliveries') {
      fetchDeliveries();
    } else {
      fetchEndpoints();
    }
  }, [
    activeTab,
    deliveryStatusFilter,
    deliveryEventFilter,
    endpointStatusFilter,
    failingOnlyFilter,
  ]);

  const handleInspectDelivery = async (id: string) => {
    try {
      setLoadingDetail(true);
      const detail = await getPlatformWebhookDeliveryDetail(id);
      setInspectingDelivery(detail);
    } catch (err: any) {
      showNotice(err.message || 'Failed to load delivery details', 'danger');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleRedeliver = async (id: string) => {
    try {
      setRedeliveringId(id);
      const res = await redeliverPlatformWebhook(id);
      showNotice(res.message);
      fetchDeliveries();
      fetchSummary();
      if (inspectingDelivery && inspectingDelivery.id === id) {
        setInspectingDelivery(res.delivery);
      }
    } catch (err: any) {
      showNotice(err.message || 'Failed to trigger redelivery', 'danger');
    } finally {
      setRedeliveringId(null);
    }
  };

  const handleToggleEndpoint = async (
    endpoint: PlatformWebhookEndpointItem,
  ) => {
    const nextStatus: TenantWebhookStatus =
      endpoint.status === 'active' ? 'disabled' : 'active';
    try {
      await togglePlatformWebhookEndpointStatus(endpoint.id, nextStatus);
      showNotice(
        `Endpoint "${endpoint.name}" was switched to ${nextStatus}.`,
      );
      fetchEndpoints();
      fetchSummary();
    } catch (err: any) {
      showNotice(err.message || 'Failed to update endpoint status', 'danger');
    }
  };

  const handleExecuteAutoDisable = async () => {
    try {
      setRunningAutoDisable(true);
      const res = await autoDisableFailingPlatformEndpoints({
        failingDays: Number(failingDaysInput),
        dryRun: isDryRun,
      });
      setAutoDisableResult(res);
      showNotice(
        isDryRun
          ? `Dry run evaluated ${res.endpointsEvaluated} endpoints: ${res.disabledEndpoints.length} candidate(s) detected.`
          : `Auto-disabled ${res.disabledCount} endpoint(s) and dispatched ${res.notificationsSent} notification(s).`,
      );
      fetchEndpoints();
      fetchSummary();
    } catch (err: any) {
      showNotice(err.message || 'Failed to run auto-disable', 'danger');
    } finally {
      setRunningAutoDisable(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
    showNotice(`Copied to clipboard!`);
  };

  const renderStateBadge = (state: WebhookDeliveryState) => {
    switch (state) {
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Delivered
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <Ban className="h-3.5 w-3.5" />
            Failed
          </span>
        );
      case 'retrying':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            Retrying
          </span>
        );
      case 'sending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Activity className="h-3.5 w-3.5 animate-pulse" />
            Sending
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            <Clock className="h-3.5 w-3.5" />
            Pending
          </span>
        );
    }
  };

  const renderHttpStatus = (code: number | null, errorMessage?: string | null) => {
    if (code === null) {
      return (
        <span
          className="text-xs font-mono text-rose-400 bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-800/50"
          title={errorMessage || 'No HTTP response (Network/Timeout)'}
        >
          TIMEOUT
        </span>
      );
    }
    if (code >= 200 && code < 300) {
      return (
        <span className="text-xs font-mono text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-800/50 font-bold">
          {code} OK
        </span>
      );
    }
    return (
      <span
        className="text-xs font-mono text-rose-300 bg-rose-950/50 px-1.5 py-0.5 rounded border border-rose-800/60 font-bold"
        title={errorMessage || `HTTP ${code}`}
      >
        {code}
      </span>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
      {/* Flash Banner Notice */}
      {bannerNotice && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl border text-sm font-medium ${
            bannerNotice.tone === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {bannerNotice.tone === 'success' ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <AlertTriangle className="h-5 w-5" />
            )}
            <span>{bannerNotice.text}</span>
          </div>
          <button
            onClick={() => setBannerNotice(null)}
            className="hover:opacity-75 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
              <Webhook className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold text-slate-100">
              Webhook Delivery Monitor
            </h1>
            <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">
              Control Plane · Cross-Tenant
            </span>
            <span className="hidden sm:inline-block px-2 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20">
              Audited (webhooks)
            </span>
          </div>
          <p className="text-sm text-slate-400">
            Real-time delivery status, response codes, retry backoff schedules, manual redelivery, and auto-disable for continuously failing endpoints.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canEdit && (
            <button
              onClick={() => {
                setShowAutoDisableModal(true);
                setAutoDisableResult(null);
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg transition"
            >
              <ShieldAlert className="h-4 w-4" />
              Run Auto-Disable
            </button>
          )}

          <button
            onClick={() => {
              fetchSummary();
              if (activeTab === 'deliveries') fetchDeliveries();
              else fetchEndpoints();
            }}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Deliveries (24h)</span>
            <Activity className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100">
            {loadingSummary ? '...' : (summary?.totalDeliveries24h ?? 0)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            7-day volume: {summary?.totalDeliveries7d ?? 0}
          </div>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">24h Success Rate</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            {loadingSummary ? '...' : `${summary?.successRate24h ?? 100}%`}
          </div>
          <div className="text-xs text-slate-400 mt-1">HTTP 2xx responses</div>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Currently Retrying</span>
            <RefreshCw className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-300">
            {loadingSummary ? '...' : (summary?.retryingCount ?? 0)}
          </div>
          <div className="text-xs text-amber-400/80 mt-1 flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Exponential backoff active
          </div>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">24h Delivery Failures</span>
            <Ban className="h-4 w-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400">
            {loadingSummary ? '...' : (summary?.failedCount24h ?? 0)}
          </div>
          <div className="text-xs text-rose-400/80 mt-1">Terminal failed attempts</div>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Failing Endpoints (≥3d)</span>
            <AlertTriangle className="h-4 w-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100">
            {loadingSummary ? '...' : (summary?.failingEndpointsCount ?? 0)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {summary?.totalActiveEndpoints ?? 0} active · {summary?.totalDisabledEndpoints ?? 0} disabled
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800 flex items-center gap-6">
        <button
          onClick={() => setActiveTab('deliveries')}
          className={`pb-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'deliveries'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="h-4 w-4" />
          Deliveries Log
          <span className="px-2 py-0.5 text-xs rounded-full bg-slate-800 text-slate-300">
            {deliveries.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('endpoints')}
          className={`pb-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'endpoints'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Webhook className="h-4 w-4" />
          Endpoints Health & Auto-Disable
          <span className="px-2 py-0.5 text-xs rounded-full bg-slate-800 text-slate-300">
            {endpoints.length}
          </span>
        </button>
      </div>

      {/* TAB 1: DELIVERIES LOG */}
      {activeTab === 'deliveries' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2 flex-1 max-w-md bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search by URL, tenant, event ID or error..."
                value={deliverySearch}
                onChange={(e) => setDeliverySearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchDeliveries()}
                className="bg-transparent text-slate-200 placeholder-slate-500 focus:outline-none w-full text-sm"
              />
              {deliverySearch && (
                <button onClick={() => { setDeliverySearch(''); fetchDeliveries(); }}>
                  <X className="h-3.5 w-3.5 text-slate-400" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={deliveryStatusFilter}
                onChange={(e) => setDeliveryStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-3 py-2 focus:outline-none"
              >
                <option value="all">All States</option>
                <option value="delivered">Delivered (2xx)</option>
                <option value="retrying">Retrying (Queued)</option>
                <option value="failed">Failed (Terminal)</option>
                <option value="pending">Pending</option>
              </select>

              <select
                value={deliveryEventFilter}
                onChange={(e) => setDeliveryEventFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-3 py-2 focus:outline-none"
              >
                <option value="">All Events</option>
                <option value="employee.created">employee.created</option>
                <option value="leave.approved">leave.approved</option>
                <option value="payroll.finalized">payroll.finalized</option>
                <option value="webhook.test">webhook.test</option>
              </select>

              <button
                onClick={fetchDeliveries}
                className="px-3 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition"
              >
                Filter
              </button>
            </div>
          </div>

          {/* Deliveries Table */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-xs uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Tenant & Destination</th>
                    <th className="px-4 py-3">Event Type</th>
                    <th className="px-4 py-3">Delivery State</th>
                    <th className="px-4 py-3">Response</th>
                    <th className="px-4 py-3">Attempts</th>
                    <th className="px-4 py-3">Next Retry / Timing</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loadingDeliveries ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-500">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="h-5 w-5 animate-spin text-indigo-400" />
                          Loading webhook deliveries...
                        </div>
                      </td>
                    </tr>
                  ) : deliveries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-500">
                        No webhook deliveries matching criteria.
                      </td>
                    </tr>
                  ) : (
                    deliveries.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-800/30 transition">
                        {/* Tenant & Destination */}
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-slate-100 flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-slate-400" />
                            {d.tenantName}
                            <span className="text-xs text-slate-500 font-mono">
                              ({d.tenantSubdomain})
                            </span>
                          </div>
                          <div className="text-xs font-semibold text-slate-300 mt-0.5">
                            {d.webhookName}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400 truncate max-w-xs mt-0.5">
                            <span className="truncate">{d.webhookUrl}</span>
                            <button
                              onClick={() => copyToClipboard(d.webhookUrl)}
                              title="Copy URL"
                              className="text-slate-500 hover:text-slate-300"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        </td>

                        {/* Event Type */}
                        <td className="px-4 py-3.5">
                          <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">
                            {d.eventType}
                          </span>
                          <div className="text-[10px] text-slate-500 font-mono mt-1 truncate max-w-[140px]">
                            {d.eventId}
                          </div>
                        </td>

                        {/* State Badge */}
                        <td className="px-4 py-3.5">
                          {renderStateBadge(d.deliveryState)}
                        </td>

                        {/* Response HTTP Status */}
                        <td className="px-4 py-3.5">
                          {renderHttpStatus(d.httpStatus, d.errorMessage)}
                          {d.errorMessage && (
                            <div
                              className="text-[11px] text-rose-300/80 truncate max-w-xs mt-1"
                              title={d.errorMessage}
                            >
                              {d.errorMessage}
                            </div>
                          )}
                        </td>

                        {/* Attempts */}
                        <td className="px-4 py-3.5 font-mono text-xs">
                          <span
                            className={
                              d.attempts >= d.maxAttempts
                                ? 'text-rose-400 font-bold'
                                : d.attempts > 1
                                ? 'text-amber-400'
                                : 'text-slate-200'
                            }
                          >
                            {d.attempts} / {d.maxAttempts}
                          </span>
                        </td>

                        {/* Next Retry / Timing */}
                        <td className="px-4 py-3.5 text-xs text-slate-400">
                          {d.nextAttemptAt ? (
                            <div className="text-amber-300 font-medium flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Retry scheduled:{' '}
                              {new Date(d.nextAttemptAt).toLocaleTimeString()}
                            </div>
                          ) : d.deliveredAt ? (
                            <div className="text-emerald-400">
                              Delivered {new Date(d.deliveredAt).toLocaleTimeString()}
                            </div>
                          ) : d.failedAt ? (
                            <div className="text-rose-400">
                              Failed {new Date(d.failedAt).toLocaleTimeString()}
                            </div>
                          ) : (
                            <div className="text-slate-500">
                              Queued {new Date(d.queuedAt).toLocaleTimeString()}
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-right space-x-2">
                          <button
                            onClick={() => handleInspectDelivery(d.id)}
                            title="Inspect Payload & Headers"
                            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-md transition"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {canEdit && (
                            <button
                              onClick={() => handleRedeliver(d.id)}
                              disabled={redeliveringId === d.id}
                              title="Trigger Manual Redelivery"
                              className="px-2.5 py-1 text-xs font-semibold text-indigo-300 bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-800/60 rounded-md transition disabled:opacity-50"
                            >
                              {redeliveringId === d.id ? 'Queuing...' : 'Redeliver'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ENDPOINTS HEALTH & AUTO-DISABLE */}
      {activeTab === 'endpoints' && (
        <div className="space-y-4">
          {/* Policy Banner */}
          <div className="p-4 bg-indigo-950/30 border border-indigo-800/40 rounded-xl flex items-start gap-3">
            <Zap className="h-5 w-5 text-indigo-400 mt-0.5 shrink-0" />
            <div className="text-xs space-y-1">
              <p className="font-semibold text-indigo-200">
                Automated Webhook Endpoint Protection & Failure Thresholds
              </p>
              <p className="text-indigo-300/80">
                Endpoints failing continuously for N days without any successful delivery can be automatically deactivated by the platform control plane to protect network throughput. A notification is dispatched to the tenant administrators explaining the disruption.
              </p>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2 flex-1 max-w-md bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search endpoints by name, URL, or tenant..."
                value={endpointSearch}
                onChange={(e) => setEndpointSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchEndpoints()}
                className="bg-transparent text-slate-200 placeholder-slate-500 focus:outline-none w-full text-sm"
              />
              {endpointSearch && (
                <button onClick={() => { setEndpointSearch(''); fetchEndpoints(); }}>
                  <X className="h-3.5 w-3.5 text-slate-400" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={failingOnlyFilter}
                  onChange={(e) => setFailingOnlyFilter(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                />
                Failing endpoints only
              </label>

              <select
                value={endpointStatusFilter}
                onChange={(e) => setEndpointStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-3 py-2 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="disabled">Disabled Only</option>
              </select>

              <button
                onClick={fetchEndpoints}
                className="px-3 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition"
              >
                Filter
              </button>
            </div>
          </div>

          {/* Endpoints Table */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-xs uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Tenant & Endpoint</th>
                    <th className="px-4 py-3">Destination URL</th>
                    <th className="px-4 py-3">Subscribed Events</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">7-Day Deliveries</th>
                    <th className="px-4 py-3">Failure Health</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loadingEndpoints ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-500">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="h-5 w-5 animate-spin text-indigo-400" />
                          Loading endpoints...
                        </div>
                      </td>
                    </tr>
                  ) : endpoints.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-500">
                        No webhook endpoints found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    endpoints.map((ep) => (
                      <tr key={ep.id} className="hover:bg-slate-800/30 transition">
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-slate-400" />
                            {ep.tenantName}
                          </div>
                          <div className="text-xs text-slate-300 font-medium mt-0.5">
                            {ep.name}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 font-mono text-xs text-indigo-300 max-w-xs truncate">
                          <div className="flex items-center gap-1 truncate">
                            <span className="truncate">{ep.url}</span>
                            <button
                              onClick={() => copyToClipboard(ep.url)}
                              title="Copy URL"
                              className="text-slate-500 hover:text-slate-300"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {ep.events.map((e) => (
                              <span
                                key={e}
                                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700"
                              >
                                {e}
                              </span>
                            ))}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          {ep.status === 'active' ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                              <Ban className="h-3 w-3" />
                              Disabled
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-emerald-400 font-bold">
                              {ep.delivered7d} ok
                            </span>
                            <span className="text-slate-600">/</span>
                            <span
                              className={
                                ep.failed7d > 0
                                  ? 'text-rose-400 font-bold'
                                  : 'text-slate-400'
                              }
                            >
                              {ep.failed7d} failed
                            </span>
                          </div>
                          {ep.retryingNow > 0 && (
                            <div className="text-[11px] text-amber-400 mt-0.5">
                              {ep.retryingNow} retrying now
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          {ep.consecutiveFailingDays >= 1 ? (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                                ep.consecutiveFailingDays >= 3
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse'
                                  : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                              }`}
                            >
                              <AlertTriangle className="h-3 w-3" />
                              Failing for {ep.consecutiveFailingDays}d
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Healthy
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-right space-x-2">
                          {canEdit ? (
                            <button
                              onClick={() => handleToggleEndpoint(ep)}
                              className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition ${
                                ep.status === 'active'
                                  ? 'text-amber-300 bg-amber-950/40 hover:bg-amber-900/60 border-amber-800/60'
                                  : 'text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/60 border-emerald-800/60'
                              }`}
                            >
                              {ep.status === 'active' ? 'Disable' : 'Enable'}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-500 italic">Read-only</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: Delivery Payload Inspector */}
      {/* ============================================================ */}
      {inspectingDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-indigo-400">
                <Eye className="h-5 w-5" />
                <h3 className="font-bold text-slate-100">
                  Webhook Delivery Payload & Diagnostics
                </h3>
              </div>
              <button
                onClick={() => setInspectingDelivery(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
              <div>
                <span className="text-slate-500">Delivery ID:</span>{' '}
                <span className="font-mono text-slate-200">
                  {inspectingDelivery.id}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Event:</span>{' '}
                <span className="font-mono text-indigo-300">
                  {inspectingDelivery.eventType}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Target Endpoint:</span>{' '}
                <span className="font-semibold text-slate-200">
                  {inspectingDelivery.webhookName}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Status:</span>{' '}
                {renderStateBadge(inspectingDelivery.deliveryState)}
              </div>
              <div className="col-span-2 truncate">
                <span className="text-slate-500">URL:</span>{' '}
                <span className="font-mono text-indigo-400">
                  {inspectingDelivery.webhookUrl}
                </span>
              </div>
            </div>

            {inspectingDelivery.errorMessage && (
              <div className="p-3 bg-rose-950/30 border border-rose-800/40 rounded-xl text-xs text-rose-300 space-y-0.5">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" />
                  Delivery Failure Diagnostic:
                </div>
                <div className="font-mono">{inspectingDelivery.errorMessage}</div>
              </div>
            )}

            <div className="flex-1 min-h-0 flex flex-col space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>Signed JSON Payload:</span>
                <button
                  onClick={() =>
                    copyToClipboard(
                      JSON.stringify(inspectingDelivery.payload, null, 2),
                    )
                  }
                  className="flex items-center gap-1 text-slate-400 hover:text-slate-200 text-[11px]"
                >
                  <Copy className="h-3 w-3" />
                  Copy Payload
                </button>
              </div>
              <pre className="flex-1 overflow-auto bg-slate-950 border border-slate-800 p-3 rounded-xl font-mono text-xs text-emerald-400 leading-relaxed">
                {JSON.stringify(inspectingDelivery.payload, null, 2)}
              </pre>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setInspectingDelivery(null)}
                className="px-4 py-2 text-sm text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
              >
                Close
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleRedeliver(inspectingDelivery.id)}
                  disabled={redeliveringId === inspectingDelivery.id}
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  {redeliveringId === inspectingDelivery.id
                    ? 'Queuing...'
                    : 'Trigger Immediate Redelivery'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: Auto-Disable Failing Endpoints */}
      {/* ============================================================ */}
      {showAutoDisableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-amber-400">
                <ShieldAlert className="h-5 w-5" />
                <h3 className="font-bold text-slate-100">
                  Run Failing Endpoints Auto-Disable
                </h3>
              </div>
              <button
                onClick={() => setShowAutoDisableModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl text-xs text-amber-300 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Automated Network Hygiene Protection
              </p>
              <p className="text-amber-300/80">
                Identifies all active endpoints across all tenants that have experienced continuous delivery failures without any successful responses over the last N days. Auto-disables them and notifies the tenant admins.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Failure Threshold (Consecutive Days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={failingDaysInput}
                  onChange={(e) => setFailingDaysInput(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
                <p className="text-[11px] text-slate-500">
                  Endpoints with 100% failure rate for ≥ this duration will be disabled.
                </p>
              </div>

              <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                <input
                  type="checkbox"
                  checked={isDryRun}
                  onChange={(e) => setIsDryRun(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                />
                <div>
                  <span className="font-semibold text-slate-200">
                    Dry Run Mode (Simulation)
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Audit candidates without updating statuses or sending notifications.
                  </p>
                </div>
              </label>

              {autoDisableResult && (
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs">
                  <div className="font-semibold text-slate-200 flex items-center justify-between">
                    <span>Evaluation Outcome:</span>
                    <span className="text-amber-400 font-mono">
                      {autoDisableResult.disabledEndpoints.length} candidate(s)
                    </span>
                  </div>
                  {autoDisableResult.disabledEndpoints.length > 0 ? (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {autoDisableResult.disabledEndpoints.map((c) => (
                        <div
                          key={c.id}
                          className="p-2 bg-slate-900 rounded border border-slate-800 flex items-center justify-between text-[11px]"
                        >
                          <div>
                            <div className="font-semibold text-slate-200">
                              {c.name} ({c.tenantName})
                            </div>
                            <div className="font-mono text-slate-400 truncate max-w-xs">
                              {c.url}
                            </div>
                          </div>
                          <span className="text-rose-400 font-bold">
                            {c.consecutiveDays}d failing
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-emerald-400 text-center py-2">
                      No endpoints found failing beyond the {failingDaysInput}-day threshold!
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAutoDisableModal(false)}
                className="px-4 py-2 text-sm text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
              >
                Close
              </button>
              <button
                type="button"
                disabled={runningAutoDisable}
                onClick={handleExecuteAutoDisable}
                className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
              >
                {runningAutoDisable ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Evaluating...
                  </>
                ) : isDryRun ? (
                  'Run Simulation'
                ) : (
                  'Execute Auto-Disable'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
