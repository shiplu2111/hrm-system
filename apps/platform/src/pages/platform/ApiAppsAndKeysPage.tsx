// apps/platform/src/pages/platform/ApiAppsAndKeysPage.tsx
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
  Filter,
  KeyRound,
  Lock,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sliders,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import type {
  PlatformApiKeyItem,
  PlatformApiRegistrySummary,
  PlatformOAuthClientItem,
  TenantRateLimitItem,
} from '@hrm/shared-types';
import {
  getPlatformApiRegistrySummary,
  listPlatformApiKeys,
  listPlatformOAuthClients,
  listTenantRateLimits,
  removeTenantRateLimitOverride,
  revokePlatformApiKey,
  revokePlatformOAuthClient,
  setTenantRateLimitOverride,
} from '../../lib/platform-api-registry-api';
import { usePermission } from '@/hooks/usePermission';

type TabKey = 'keys' | 'oauth' | 'rate-limits';

export const ApiAppsAndKeysPage: React.FC = () => {
  const canEdit = usePermission('platform', 'edit');
  const [activeTab, setActiveTab] = useState<TabKey>('keys');

  // Summary state
  const [summary, setSummary] = useState<PlatformApiRegistrySummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // API Keys state
  const [keys, setKeys] = useState<PlatformApiKeyItem[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [keySearch, setKeySearch] = useState('');
  const [keyStatusFilter, setKeyStatusFilter] = useState<'all' | 'active' | 'revoked'>('all');
  const [keyScopeFilter, setKeyScopeFilter] = useState('');

  // OAuth Clients state
  const [oauthClients, setOauthClients] = useState<PlatformOAuthClientItem[]>([]);
  const [loadingOauth, setLoadingOauth] = useState(false);
  const [oauthSearch, setOauthSearch] = useState('');
  const [oauthStatusFilter, setOauthStatusFilter] = useState<'all' | 'active' | 'revoked'>('all');

  // Rate limits state
  const [rateLimits, setRateLimits] = useState<TenantRateLimitItem[]>([]);
  const [loadingRateLimits, setLoadingRateLimits] = useState(false);
  const [rateLimitSearch, setRateLimitSearch] = useState('');
  const [onlyOverridesFilter, setOnlyOverridesFilter] = useState(false);

  // Modals
  const [revokingKey, setRevokingKey] = useState<PlatformApiKeyItem | null>(null);
  const [revokeKeyReason, setRevokeKeyReason] = useState('');
  const [submittingRevokeKey, setSubmittingRevokeKey] = useState(false);

  const [revokingOauth, setRevokingOauth] = useState<PlatformOAuthClientItem | null>(null);
  const [revokeOauthReason, setRevokeOauthReason] = useState('');
  const [submittingRevokeOauth, setSubmittingRevokeOauth] = useState(false);

  const [configuringTenant, setConfiguringTenant] = useState<TenantRateLimitItem | null>(null);
  const [overrideRateLimit, setOverrideRateLimit] = useState<number>(1000);
  const [overrideBurstLimit, setOverrideBurstLimit] = useState<number>(2000);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideExpiresAt, setOverrideExpiresAt] = useState('');
  const [submittingOverride, setSubmittingOverride] = useState(false);

  // Flash notification
  const [bannerNotice, setBannerNotice] = useState<{
    tone: 'success' | 'danger';
    text: string;
  } | null>(null);

  const showNotice = (text: string, tone: 'success' | 'danger' = 'success') => {
    setBannerNotice({ text, tone });
    setTimeout(() => setBannerNotice(null), 5000);
  };

  // Fetch summary
  const fetchSummary = async () => {
    try {
      setLoadingSummary(true);
      const data = await getPlatformApiRegistrySummary();
      setSummary(data);
    } catch (err: any) {
      console.error('Failed to load API summary', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  // Fetch API Keys
  const fetchKeys = async () => {
    try {
      setLoadingKeys(true);
      const res = await listPlatformApiKeys({
        search: keySearch || undefined,
        status: keyStatusFilter,
        scope: keyScopeFilter || undefined,
        limit: 50,
      });
      setKeys(res.data);
    } catch (err: any) {
      console.error('Failed to load API keys', err);
      showNotice(err.message || 'Failed to load API keys', 'danger');
    } finally {
      setLoadingKeys(false);
    }
  };

  // Fetch OAuth clients
  const fetchOauthClients = async () => {
    try {
      setLoadingOauth(true);
      const res = await listPlatformOAuthClients({
        search: oauthSearch || undefined,
        status: oauthStatusFilter,
        limit: 50,
      });
      setOauthClients(res.data);
    } catch (err: any) {
      console.error('Failed to load OAuth clients', err);
      showNotice(err.message || 'Failed to load OAuth clients', 'danger');
    } finally {
      setLoadingOauth(false);
    }
  };

  // Fetch Rate Limits
  const fetchRateLimits = async () => {
    try {
      setLoadingRateLimits(true);
      const res = await listTenantRateLimits({
        search: rateLimitSearch || undefined,
        hasOverride: onlyOverridesFilter ? true : undefined,
        limit: 50,
      });
      setRateLimits(res.data);
    } catch (err: any) {
      console.error('Failed to load rate limits', err);
      showNotice(err.message || 'Failed to load rate limits', 'danger');
    } finally {
      setLoadingRateLimits(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  useEffect(() => {
    if (activeTab === 'keys') {
      fetchKeys();
    } else if (activeTab === 'oauth') {
      fetchOauthClients();
    } else if (activeTab === 'rate-limits') {
      fetchRateLimits();
    }
  }, [activeTab, keyStatusFilter, keyScopeFilter, oauthStatusFilter, onlyOverridesFilter]);

  // Handlers for API Key Revocation
  const handleConfirmRevokeKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokingKey) return;
    if (!revokeKeyReason.trim()) {
      alert('Please provide a mandatory reason for revoking this API key.');
      return;
    }

    try {
      setSubmittingRevokeKey(true);
      await revokePlatformApiKey(revokingKey.id, {
        reason: revokeKeyReason.trim(),
      });
      showNotice(`API Key "${revokingKey.name}" was immediately revoked.`);
      setRevokingKey(null);
      setRevokeKeyReason('');
      fetchKeys();
      fetchSummary();
    } catch (err: any) {
      showNotice(err.message || 'Failed to revoke API key', 'danger');
    } finally {
      setSubmittingRevokeKey(false);
    }
  };

  // Handlers for OAuth Client Revocation
  const handleConfirmRevokeOauth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokingOauth) return;
    if (!revokeOauthReason.trim()) {
      alert('Please provide a mandatory reason for revoking this OAuth client.');
      return;
    }

    try {
      setSubmittingRevokeOauth(true);
      await revokePlatformOAuthClient(revokingOauth.id, {
        reason: revokeOauthReason.trim(),
      });
      showNotice(
        `OAuth Client "${revokingOauth.name}" and its tokens were immediately revoked.`,
      );
      setRevokingOauth(null);
      setRevokeOauthReason('');
      fetchOauthClients();
      fetchSummary();
    } catch (err: any) {
      showNotice(err.message || 'Failed to revoke OAuth client', 'danger');
    } finally {
      setSubmittingRevokeOauth(false);
    }
  };

  // Handlers for Rate Limit Overrides
  const handleOpenOverrideModal = (item: TenantRateLimitItem) => {
    setConfiguringTenant(item);
    if (item.override) {
      setOverrideRateLimit(item.override.rateLimitPerMin);
      setOverrideBurstLimit(
        item.override.burstLimit ?? Math.round(item.override.rateLimitPerMin * 1.5),
      );
      setOverrideReason(item.override.reason);
      setOverrideExpiresAt(
        item.override.expiresAt ? item.override.expiresAt.split('T')[0] : '',
      );
    } else {
      setOverrideRateLimit(Math.max(item.defaultRateLimitPerMin * 2, 500));
      setOverrideBurstLimit(Math.max(item.defaultBurstLimit * 2, 1000));
      setOverrideReason('');
      setOverrideExpiresAt('');
    }
  };

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configuringTenant) return;
    if (!overrideReason.trim()) {
      alert('A specific business or operational reason is required for rate-limit overrides.');
      return;
    }

    try {
      setSubmittingOverride(true);
      await setTenantRateLimitOverride(configuringTenant.tenantId, {
        rateLimitPerMin: Number(overrideRateLimit),
        burstLimit: Number(overrideBurstLimit),
        reason: overrideReason.trim(),
        expiresAt: overrideExpiresAt ? new Date(overrideExpiresAt).toISOString() : null,
      });
      showNotice(
        `Rate limit override configured for "${configuringTenant.tenantName}" (${overrideRateLimit} req/min).`,
      );
      setConfiguringTenant(null);
      fetchRateLimits();
      fetchSummary();
    } catch (err: any) {
      showNotice(err.message || 'Failed to configure override', 'danger');
    } finally {
      setSubmittingOverride(false);
    }
  };

  const handleRemoveOverride = async (item: TenantRateLimitItem) => {
    if (
      !confirm(
        `Are you sure you want to remove the rate limit override for "${item.tenantName}"? The tenant will revert to the plan default (${item.defaultRateLimitPerMin} req/min).`,
      )
    ) {
      return;
    }

    try {
      await removeTenantRateLimitOverride(item.tenantId);
      showNotice(`Override removed for "${item.tenantName}". Reverted to plan baseline.`);
      fetchRateLimits();
      fetchSummary();
    } catch (err: any) {
      showNotice(err.message || 'Failed to remove override', 'danger');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
    showNotice(`Copied "${text}" to clipboard!`);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
      {/* Banner notice */}
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
              <KeyRound className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold text-slate-100">
              API Apps & Keys Registry
            </h1>
            <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">
              Phase 2 · Stage 22
            </span>
            <span className="hidden sm:inline-block px-2 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20">
              Control Plane
            </span>
          </div>
          <p className="text-sm text-slate-400">
            Cross-tenant registry of all developer API keys, OAuth applications, immediate revocation, and rate-limit overrides.
          </p>
        </div>

        <button
          onClick={() => {
            fetchSummary();
            if (activeTab === 'keys') fetchKeys();
            if (activeTab === 'oauth') fetchOauthClients();
            if (activeTab === 'rate-limits') fetchRateLimits();
          }}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Active API Keys</span>
            <KeyRound className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100">
            {loadingSummary ? '...' : (summary?.totalActiveKeys ?? 0)}
          </div>
          <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Active credentials
          </div>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Total API Volume</span>
            <Activity className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100">
            {loadingSummary
              ? '...'
              : (summary?.totalApiCalls30d ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-slate-400 mt-1">Cross-tenant calls</div>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Rate Limit Overrides</span>
            <Sliders className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-300">
            {loadingSummary ? '...' : (summary?.activeRateLimitOverrides ?? 0)}
          </div>
          <div className="text-xs text-amber-400/80 mt-1">Active policy overrides</div>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">OAuth Applications</span>
            <Lock className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100">
            {loadingSummary ? '...' : (summary?.totalOAuthClients ?? 0)}
          </div>
          <div className="text-xs text-slate-400 mt-1">Registered clients</div>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Revoked Keys</span>
            <Ban className="h-4 w-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100">
            {loadingSummary ? '...' : (summary?.totalRevokedKeys ?? 0)}
          </div>
          <div className="text-xs text-rose-400 mt-1">Disabled credentials</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800 flex items-center gap-6">
        <button
          onClick={() => setActiveTab('keys')}
          className={`pb-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'keys'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <KeyRound className="h-4 w-4" />
          API Keys Registry
          <span className="px-2 py-0.5 text-xs rounded-full bg-slate-800 text-slate-300">
            {keys.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('oauth')}
          className={`pb-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'oauth'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Lock className="h-4 w-4" />
          OAuth Applications
          <span className="px-2 py-0.5 text-xs rounded-full bg-slate-800 text-slate-300">
            {oauthClients.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('rate-limits')}
          className={`pb-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'rate-limits'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="h-4 w-4" />
          Tenant Rate Limits & Overrides
          <span className="px-2 py-0.5 text-xs rounded-full bg-slate-800 text-slate-300">
            {rateLimits.length}
          </span>
        </button>
      </div>

      {/* TAB 1: API KEYS REGISTRY */}
      {activeTab === 'keys' && (
        <div className="space-y-4">
          {/* Filters bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2 flex-1 max-w-md bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search by key name, prefix, or tenant..."
                value={keySearch}
                onChange={(e) => setKeySearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchKeys()}
                className="bg-transparent text-slate-200 placeholder-slate-500 focus:outline-none w-full text-sm"
              />
              {keySearch && (
                <button onClick={() => { setKeySearch(''); fetchKeys(); }}>
                  <X className="h-3.5 w-3.5 text-slate-400" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={keyStatusFilter}
                onChange={(e) => setKeyStatusFilter(e.target.value as any)}
                className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-3 py-2 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="revoked">Revoked Only</option>
              </select>

              <select
                value={keyScopeFilter}
                onChange={(e) => setKeyScopeFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-3 py-2 focus:outline-none"
              >
                <option value="">All Scopes</option>
                <option value="read:employees">read:employees</option>
                <option value="write:employees">write:employees</option>
                <option value="read:attendance">read:attendance</option>
                <option value="write:attendance">write:attendance</option>
                <option value="read:leave">read:leave</option>
                <option value="write:payroll">write:payroll</option>
              </select>

              <button
                onClick={fetchKeys}
                className="px-3 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition"
              >
                Filter
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-xs uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Tenant</th>
                    <th className="px-4 py-3">Key Name & Prefix</th>
                    <th className="px-4 py-3">Scopes</th>
                    <th className="px-4 py-3">Call Volume</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Last Used</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loadingKeys ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-500">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="h-5 w-5 animate-spin text-indigo-400" />
                          Loading API keys...
                        </div>
                      </td>
                    </tr>
                  ) : keys.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-500">
                        No API keys found matching filters.
                      </td>
                    </tr>
                  ) : (
                    keys.map((k) => (
                      <tr key={k.id} className="hover:bg-slate-800/30 transition">
                        {/* Tenant */}
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-slate-100 flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-slate-400" />
                            {k.tenantName}
                          </div>
                          <div className="text-xs text-slate-400 font-mono">
                            {k.tenantSubdomain ? `${k.tenantSubdomain}.hrm.com` : 'No subdomain'}
                          </div>
                        </td>

                        {/* Name & Masked */}
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-200">{k.name}</div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="font-mono text-xs text-indigo-300 bg-indigo-950/50 px-1.5 py-0.5 rounded border border-indigo-800/40">
                              {k.prefix}
                            </span>
                            <button
                              onClick={() => copyToClipboard(k.prefix)}
                              title="Copy prefix"
                              className="text-slate-500 hover:text-slate-300 transition"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                            <span className="text-xs text-slate-500 font-mono">
                              ••••••••
                            </span>
                          </div>
                        </td>

                        {/* Scopes */}
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {k.scopes.map((scope) => (
                              <span
                                key={scope}
                                className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${
                                  scope.startsWith('write:')
                                    ? 'bg-amber-950/60 text-amber-300 border border-amber-800/50'
                                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                                }`}
                              >
                                {scope}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Call Volume */}
                        <td className="px-4 py-3.5">
                          <div className="font-mono font-semibold text-slate-200">
                            {k.callVolume.toLocaleString()}
                          </div>
                          <div className="text-[11px] text-slate-500">total requests</div>
                        </td>

                        {/* Created */}
                        <td className="px-4 py-3.5 text-xs text-slate-400">
                          <div>{new Date(k.createdAt).toLocaleDateString()}</div>
                          <div className="text-[11px] text-slate-500">
                            by {k.createdByName || 'Platform staff'}
                          </div>
                        </td>

                        {/* Last Used */}
                        <td className="px-4 py-3.5 text-xs">
                          {k.lastUsedAt ? (
                            <div className="text-slate-300 flex items-center gap-1">
                              <Clock className="h-3 w-3 text-slate-500" />
                              {new Date(k.lastUsedAt).toLocaleDateString()}
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">Never</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5">
                          {k.status === 'active' ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              <Ban className="h-3 w-3" />
                              Revoked
                            </span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="px-4 py-3.5 text-right">
                          {canEdit ? (
                            k.status === 'active' ? (
                              <button
                                onClick={() => {
                                  setRevokingKey(k);
                                  setRevokeKeyReason('');
                                }}
                                className="px-2.5 py-1 text-xs font-medium text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 rounded-md transition"
                              >
                                Revoke
                              </button>
                            ) : (
                              <span className="text-xs text-slate-600">Revoked</span>
                            )
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

      {/* TAB 2: OAUTH APPLICATIONS */}
      {activeTab === 'oauth' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2 flex-1 max-w-md bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search by client name, client ID, or tenant..."
                value={oauthSearch}
                onChange={(e) => setOauthSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchOauthClients()}
                className="bg-transparent text-slate-200 placeholder-slate-500 focus:outline-none w-full text-sm"
              />
              {oauthSearch && (
                <button onClick={() => { setOauthSearch(''); fetchOauthClients(); }}>
                  <X className="h-3.5 w-3.5 text-slate-400" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={oauthStatusFilter}
                onChange={(e) => setOauthStatusFilter(e.target.value as any)}
                className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-3 py-2 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="revoked">Revoked Only</option>
              </select>

              <button
                onClick={fetchOauthClients}
                className="px-3 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition"
              >
                Filter
              </button>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-xs uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Tenant</th>
                    <th className="px-4 py-3">Application Name</th>
                    <th className="px-4 py-3">Client ID</th>
                    <th className="px-4 py-3">Redirect URIs</th>
                    <th className="px-4 py-3">Scopes</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loadingOauth ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-500">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="h-5 w-5 animate-spin text-indigo-400" />
                          Loading OAuth clients...
                        </div>
                      </td>
                    </tr>
                  ) : oauthClients.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-500">
                        No OAuth applications registered across tenants.
                      </td>
                    </tr>
                  ) : (
                    oauthClients.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-800/30 transition">
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-slate-100 flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-slate-400" />
                            {c.tenantName}
                          </div>
                          <div className="text-xs text-slate-400 font-mono">
                            {c.tenantSubdomain ? `${c.tenantSubdomain}.hrm.com` : ''}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-200">{c.name}</div>
                          {c.description && (
                            <div className="text-xs text-slate-400 truncate max-w-xs">
                              {c.description}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1 font-mono text-xs text-indigo-300">
                            {c.clientId}
                            <button
                              onClick={() => copyToClipboard(c.clientId)}
                              title="Copy Client ID"
                              className="text-slate-500 hover:text-slate-300"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="space-y-1 text-xs font-mono text-slate-400 max-w-xs truncate">
                            {c.redirectUris.map((uri) => (
                              <div key={uri} className="truncate" title={uri}>
                                {uri}
                              </div>
                            ))}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {c.scopes.map((s) => (
                              <span
                                key={s}
                                className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          {c.status === 'active' ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              <Ban className="h-3 w-3" />
                              Revoked
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          {canEdit ? (
                            c.status === 'active' ? (
                              <button
                                onClick={() => {
                                  setRevokingOauth(c);
                                  setRevokeOauthReason('');
                                }}
                                className="px-2.5 py-1 text-xs font-medium text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 rounded-md transition"
                              >
                                Revoke
                              </button>
                            ) : (
                              <span className="text-xs text-slate-600">Revoked</span>
                            )
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

      {/* TAB 3: RATE LIMITS & OVERRIDES */}
      {activeTab === 'rate-limits' && (
        <div className="space-y-4">
          {/* Information box */}
          <div className="p-4 bg-indigo-950/30 border border-indigo-800/40 rounded-xl flex items-start gap-3">
            <Zap className="h-5 w-5 text-indigo-400 mt-0.5 shrink-0" />
            <div className="text-xs space-y-1">
              <p className="font-semibold text-indigo-200">
                Plan Baseline vs. Control Plane Rate-Limit Overrides
              </p>
              <p className="text-indigo-300/80">
                Standard baseline rate limits are resolved by tier: Free (60/min), Starter (120/min), Business (300/min), and Enterprise (1,000/min). Platform Administrators can grant explicit, audited overrides per tenant with mandatory operational justification.
              </p>
            </div>
          </div>

          {/* Filters bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2 flex-1 max-w-md bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search tenant name or subdomain..."
                value={rateLimitSearch}
                onChange={(e) => setRateLimitSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchRateLimits()}
                className="bg-transparent text-slate-200 placeholder-slate-500 focus:outline-none w-full text-sm"
              />
              {rateLimitSearch && (
                <button onClick={() => { setRateLimitSearch(''); fetchRateLimits(); }}>
                  <X className="h-3.5 w-3.5 text-slate-400" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyOverridesFilter}
                  onChange={(e) => setOnlyOverridesFilter(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                />
                Show active overrides only
              </label>

              <button
                onClick={fetchRateLimits}
                className="px-3 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition"
              >
                Apply
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-xs uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Tenant & Plan</th>
                    <th className="px-4 py-3">Plan Default</th>
                    <th className="px-4 py-3">Override Status</th>
                    <th className="px-4 py-3">Effective Limit</th>
                    <th className="px-4 py-3">Override Justification</th>
                    <th className="px-4 py-3">Granted By / Expiration</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loadingRateLimits ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-500">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="h-5 w-5 animate-spin text-indigo-400" />
                          Loading tenant rate limits...
                        </div>
                      </td>
                    </tr>
                  ) : rateLimits.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-500">
                        No tenants found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    rateLimits.map((t) => (
                      <tr key={t.tenantId} className="hover:bg-slate-800/30 transition">
                        {/* Tenant */}
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-slate-400" />
                            {t.tenantName}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-slate-400 font-mono">
                              {t.tenantSubdomain || 'no-subdomain'}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded border border-slate-700 uppercase font-semibold">
                              {t.planTier}
                            </span>
                          </div>
                        </td>

                        {/* Plan Default */}
                        <td className="px-4 py-3.5 text-xs text-slate-300">
                          <div className="font-mono">
                            {t.defaultRateLimitPerMin.toLocaleString()} req/min
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Burst: {t.defaultBurstLimit.toLocaleString()}
                          </div>
                        </td>

                        {/* Override Status */}
                        <td className="px-4 py-3.5">
                          {t.override && t.override.isActive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <Zap className="h-3 w-3" />
                              Active Override
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">
                              Baseline default
                            </span>
                          )}
                        </td>

                        {/* Effective Limit */}
                        <td className="px-4 py-3.5">
                          <div
                            className={`font-mono font-bold text-sm ${
                              t.override && t.override.isActive
                                ? 'text-amber-400'
                                : 'text-slate-100'
                            }`}
                          >
                            {t.effectiveRateLimitPerMin.toLocaleString()} req/min
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Burst: {t.effectiveBurstLimit.toLocaleString()}
                          </div>
                        </td>

                        {/* Justification */}
                        <td className="px-4 py-3.5 text-xs max-w-xs">
                          {t.override ? (
                            <p className="text-slate-200 line-clamp-2" title={t.override.reason}>
                              "{t.override.reason}"
                            </p>
                          ) : (
                            <span className="text-slate-500 italic">None</span>
                          )}
                        </td>

                        {/* Granted By / Expiration */}
                        <td className="px-4 py-3.5 text-xs text-slate-400">
                          {t.override ? (
                            <div>
                              <div className="text-slate-300">
                                {t.override.grantedByName || t.override.grantedByEmail || 'Platform Admin'}
                              </div>
                              <div className="text-[11px] text-amber-300/80">
                                {t.override.expiresAt
                                  ? `Expires ${new Date(t.override.expiresAt).toLocaleDateString()}`
                                  : 'No expiration'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-right space-x-2">
                          {canEdit ? (
                            <>
                              <button
                                onClick={() => handleOpenOverrideModal(t)}
                                className="px-2.5 py-1 text-xs font-medium text-indigo-300 bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-800/60 rounded-md transition"
                              >
                                {t.override ? 'Edit Override' : 'Set Override'}
                              </button>

                              {t.override && (
                                <button
                                  onClick={() => handleRemoveOverride(t)}
                                  title="Reset to plan tier default"
                                  className="px-2 py-1 text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 border border-slate-700 hover:border-rose-800/50 rounded-md transition"
                                >
                                  Reset
                                </button>
                              )}
                            </>
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
      {/* MODAL: Revoke API Key */}
      {/* ============================================================ */}
      {revokingKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-rose-400">
                <ShieldAlert className="h-5 w-5" />
                <h3 className="font-bold text-slate-100">
                  Immediate API Key Revocation
                </h3>
              </div>
              <button
                onClick={() => setRevokingKey(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3 bg-rose-950/30 border border-rose-800/40 rounded-xl text-xs text-rose-300 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Action takes effect immediately across all edge nodes.
              </p>
              <p className="text-rose-300/80">
                Any subsequent HTTP request using this key will be rejected immediately with HTTP 401 Unauthorized (<span className="font-mono">KEY_REVOKED</span>). This action is recorded in the immutable platform audit log.
              </p>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <div>
                <span className="text-slate-500">Tenant:</span>{' '}
                <span className="font-semibold text-slate-200">
                  {revokingKey.tenantName} ({revokingKey.tenantSubdomain})
                </span>
              </div>
              <div>
                <span className="text-slate-500">Key Name:</span>{' '}
                <span className="font-semibold text-slate-200">
                  {revokingKey.name}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Prefix:</span>{' '}
                <span className="font-mono text-indigo-300">
                  {revokingKey.prefix}
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmRevokeKey} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Mandatory Reason for Revocation <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={revokeKeyReason}
                  onChange={(e) => setRevokeKeyReason(e.target.value)}
                  placeholder="e.g. Key leaked in customer public repo, suspected security compromise, employee offboarding, etc."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRevokingKey(null)}
                  className="px-4 py-2 text-sm text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRevokeKey}
                  className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
                >
                  {submittingRevokeKey ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Revoking...
                    </>
                  ) : (
                    'Confirm Immediate Revocation'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: Revoke OAuth Client */}
      {/* ============================================================ */}
      {revokingOauth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-rose-400">
                <ShieldAlert className="h-5 w-5" />
                <h3 className="font-bold text-slate-100">
                  Revoke OAuth 2.0 Application
                </h3>
              </div>
              <button
                onClick={() => setRevokingOauth(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3 bg-rose-950/30 border border-rose-800/40 rounded-xl text-xs text-rose-300">
              Revoking this OAuth application will also invalidate all active Bearer access tokens issued to it.
            </div>

            <div className="space-y-1 text-xs text-slate-300">
              <div>
                <span className="text-slate-500">Client:</span>{' '}
                <span className="font-semibold text-slate-200">
                  {revokingOauth.name}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Client ID:</span>{' '}
                <span className="font-mono text-indigo-300">
                  {revokingOauth.clientId}
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmRevokeOauth} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Mandatory Reason for Revocation <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={revokeOauthReason}
                  onChange={(e) => setRevokeOauthReason(e.target.value)}
                  placeholder="e.g. Third-party vendor integration terminated, unauthorized client credentials, etc."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRevokingOauth(null)}
                  className="px-4 py-2 text-sm text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRevokeOauth}
                  className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
                >
                  {submittingRevokeOauth ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Revoking...
                    </>
                  ) : (
                    'Revoke Application'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: Configure Rate Limit Override */}
      {/* ============================================================ */}
      {configuringTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-indigo-400">
                <Sliders className="h-5 w-5" />
                <h3 className="font-bold text-slate-100">
                  Configure Tenant Rate-Limit Override
                </h3>
              </div>
              <button
                onClick={() => setConfiguringTenant(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1">
              <div className="text-slate-400">
                Tenant:{' '}
                <span className="font-semibold text-slate-200">
                  {configuringTenant.tenantName} ({configuringTenant.tenantSubdomain})
                </span>
              </div>
              <div className="text-slate-400">
                Current Plan:{' '}
                <span className="font-semibold text-indigo-300">
                  {configuringTenant.planTier} (Baseline: {configuringTenant.defaultRateLimitPerMin} req/min)
                </span>
              </div>
            </div>

            <form onSubmit={handleSaveOverride} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Rate Limit (req / min) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={50000}
                    required
                    value={overrideRateLimit}
                    onChange={(e) => setOverrideRateLimit(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <p className="text-[11px] text-slate-500">10 to 50,000 req/min</p>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Burst Limit
                  </label>
                  <input
                    type="number"
                    min={overrideRateLimit}
                    value={overrideBurstLimit}
                    onChange={(e) => setOverrideBurstLimit(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <p className="text-[11px] text-slate-500">Must be ≥ rate limit</p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300">
                  Expiration Date (Optional)
                </label>
                <input
                  type="date"
                  value={overrideExpiresAt}
                  onChange={(e) => setOverrideExpiresAt(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[11px] text-slate-500">Leave blank for permanent override until manually revoked.</p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Mandatory Operational / Business Reason <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Annual SAP ERP migration batch, high-throughput biometric attendance kiosks rollout, VIP enterprise contract addendum."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConfiguringTenant(null)}
                  className="px-4 py-2 text-sm text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOverride}
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
                >
                  {submittingOverride ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Apply Override'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
