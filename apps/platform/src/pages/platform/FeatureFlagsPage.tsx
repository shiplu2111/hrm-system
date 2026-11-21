import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  Flag,
  HelpCircle,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  SlidersHorizontal,
  Trash2,
  UserCheck,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import type {
  FeatureEvaluationResult,
  FlagTenantOverrideDetailView,
  PlatformFeatureFlagDetailView,
  PlatformFeatureFlagView,
  PlatformTenantSummary,
} from '@hrm/shared-types';
import {
  createFeatureFlag,
  evaluateFeatureFlag,
  getFeatureFlagDetail,
  listFeatureFlags,
  removeTenantFeatureOverride,
  setTenantFeatureOverride,
  updateFeatureFlag,
} from '@/lib/feature-flags-api';
import { fetchPlatformTenants } from '@/lib/api-client';
import { usePermission } from '@/hooks/usePermission';

export function FeatureFlagsPage() {
  const canEdit = usePermission('platform', 'edit');

  // State: flags list
  const [flags, setFlags] = useState<PlatformFeatureFlagView[]>([]);
  const [isLoadingFlags, setIsLoadingFlags] = useState<boolean>(true);
  const [flagsError, setFlagsError] = useState<string | null>(null);

  // State: tenants list for overrides
  const [allTenants, setAllTenants] = useState<PlatformTenantSummary[]>([]);

  // Search & filter
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [rolloutFilter, setRolloutFilter] = useState<'all' | '100' | 'in_progress' | '0'>('all');

  // Selected flag & drawer state
  const [selectedFlagKey, setSelectedFlagKey] = useState<string | null>(null);
  const [flagDetail, setFlagDetail] = useState<PlatformFeatureFlagDetailView | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [drawerTab, setDrawerTab] = useState<'overrides' | 'add_override' | 'inspector' | 'rollout'>('overrides');

  // Add override form state
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [overrideValue, setOverrideValue] = useState<boolean>(true);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [overrideExpiresAt, setOverrideExpiresAt] = useState<string>('');
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [isSubmittingOverride, setIsSubmittingOverride] = useState<boolean>(false);

  // Inspector / Simulator state
  const [inspectTenantId, setInspectTenantId] = useState<string>('');
  const [evaluationResult, setEvaluationResult] = useState<FeatureEvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);

  // Quick edit rollout modal
  const [editingRolloutFlag, setEditingRolloutFlag] = useState<PlatformFeatureFlagView | null>(null);
  const [rolloutDraft, setRolloutDraft] = useState<number>(0);
  const [defaultStateDraft, setDefaultStateDraft] = useState<boolean>(false);
  const [isSavingRollout, setIsSavingRollout] = useState<boolean>(false);

  // Create Flag modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createKey, setCreateKey] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createDefaultState, setCreateDefaultState] = useState(false);
  const [createRollout, setCreateRollout] = useState(0);
  const [isCreatingFlag, setIsCreatingFlag] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Load flags and tenants
  const loadFlags = async () => {
    try {
      setIsLoadingFlags(true);
      setFlagsError(null);
      const data = await listFeatureFlags();
      setFlags(data);
    } catch (err: any) {
      setFlagsError(err.message || 'Failed to load feature flags.');
    } finally {
      setIsLoadingFlags(false);
    }
  };

  const loadTenants = async () => {
    try {
      const data = await fetchPlatformTenants();
      setAllTenants(data);
      if (data.length > 0) {
        setSelectedTenantId(data[0].id);
        setInspectTenantId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load tenants for overrides', err);
    }
  };

  useEffect(() => {
    loadFlags();
    loadTenants();
  }, []);

  // Open flag drawer
  const openFlagDrawer = async (key: string, initialTab: 'overrides' | 'add_override' | 'inspector' | 'rollout' = 'overrides') => {
    setSelectedFlagKey(key);
    setDrawerTab(initialTab);
    setOverrideError(null);
    setOverrideReason('');
    setOverrideExpiresAt('');
    setEvaluationResult(null);

    try {
      setIsLoadingDetail(true);
      const detail = await getFeatureFlagDetail(key);
      setFlagDetail(detail);

      // Auto evaluate on first tenant if available
      if (allTenants.length > 0) {
        const firstTenant = allTenants[0].id;
        setInspectTenantId(firstTenant);
        const evalRes = await evaluateFeatureFlag(key, firstTenant);
        setEvaluationResult(evalRes);
      }
    } catch (err: any) {
      alert(`Could not load flag details: ${err.message || 'Server error'}`);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const closeDrawer = () => {
    setSelectedFlagKey(null);
    setFlagDetail(null);
  };

  // Re-evaluate inspector when inspect tenant changes
  const handleInspectTenantChange = async (tenantId: string) => {
    setInspectTenantId(tenantId);
    if (!selectedFlagKey || !tenantId) return;

    try {
      setIsEvaluating(true);
      const res = await evaluateFeatureFlag(selectedFlagKey, tenantId);
      setEvaluationResult(res);
    } catch (err) {
      console.error('Evaluation failed', err);
    } finally {
      setIsEvaluating(false);
    }
  };

  // Handle Save Override
  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFlagKey) return;

    if (!selectedTenantId) {
      setOverrideError('Please select a tenant.');
      return;
    }

    if (!overrideReason.trim()) {
      setOverrideError('A justification reason is required for platform audit logs.');
      return;
    }

    try {
      setIsSubmittingOverride(true);
      setOverrideError(null);

      await setTenantFeatureOverride(selectedTenantId, {
        key: selectedFlagKey,
        value: overrideValue,
        reason: overrideReason.trim(),
        expiresAt: overrideExpiresAt ? new Date(overrideExpiresAt).toISOString() : null,
      });

      // Refresh drawer detail and flags list
      const updatedDetail = await getFeatureFlagDetail(selectedFlagKey);
      setFlagDetail(updatedDetail);
      await loadFlags();

      // Reset form and switch to overrides list
      setOverrideReason('');
      setOverrideExpiresAt('');
      setDrawerTab('overrides');
    } catch (err: any) {
      setOverrideError(err.message || 'Failed to apply tenant feature override.');
    } finally {
      setIsSubmittingOverride(false);
    }
  };

  // Handle Remove Override
  const handleRemoveOverride = async (tenantId: string, tenantName: string) => {
    if (!selectedFlagKey) return;
    const confirmed = window.confirm(
      `Are you sure you want to remove the feature override for ${tenantName}? The tenant will revert to its plan defaults and gradual rollout bucket.`,
    );
    if (!confirmed) return;

    try {
      await removeTenantFeatureOverride(tenantId, selectedFlagKey);
      const updatedDetail = await getFeatureFlagDetail(selectedFlagKey);
      setFlagDetail(updatedDetail);
      await loadFlags();
    } catch (err: any) {
      alert(`Failed to remove override: ${err.message || 'Server error'}`);
    }
  };

  // Handle Quick Save Rollout
  const handleSaveQuickRollout = async () => {
    if (!editingRolloutFlag) return;

    try {
      setIsSavingRollout(true);
      await updateFeatureFlag(editingRolloutFlag.key, {
        rolloutPercentage: rolloutDraft,
        defaultState: defaultStateDraft,
      });

      setEditingRolloutFlag(null);
      await loadFlags();

      if (selectedFlagKey === editingRolloutFlag.key) {
        const updatedDetail = await getFeatureFlagDetail(editingRolloutFlag.key);
        setFlagDetail(updatedDetail);
      }
    } catch (err: any) {
      alert(`Failed to update rollout: ${err.message || 'Server error'}`);
    } finally {
      setIsSavingRollout(false);
    }
  };

  // Handle Create Flag
  const handleCreateFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createKey.trim()) {
      setCreateError('Flag key is required.');
      return;
    }

    try {
      setIsCreatingFlag(true);
      setCreateError(null);
      await createFeatureFlag({
        key: createKey.trim().toLowerCase(),
        description: createDesc.trim() || undefined,
        defaultState: createDefaultState,
        rolloutPercentage: Number(createRollout),
      });

      setIsCreateModalOpen(false);
      setCreateKey('');
      setCreateDesc('');
      setCreateRollout(0);
      setCreateDefaultState(false);
      await loadFlags();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create feature flag.');
    } finally {
      setIsCreatingFlag(false);
    }
  };

  // Filtered visible flags
  const visibleFlags = useMemo(() => {
    return flags.filter((f) => {
      const matchSearch =
        f.key.toLowerCase().includes(search.toLowerCase()) ||
        (f.description && f.description.toLowerCase().includes(search.toLowerCase()));

      const matchStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'enabled'
            ? f.defaultState === true
            : f.defaultState === false;

      const matchRollout =
        rolloutFilter === 'all'
          ? true
          : rolloutFilter === '100'
            ? f.rolloutPercentage === 100
            : rolloutFilter === '0'
              ? f.rolloutPercentage === 0
              : f.rolloutPercentage > 0 && f.rolloutPercentage < 100;

      return matchSearch && matchStatus && matchRollout;
    });
  }, [flags, search, statusFilter, rolloutFilter]);

  return (
    <div className="space-y-6 p-6">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Feature Flags & Rollouts
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
              Runtime Gates
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Control feature accessibility with fallback states, gradual percentage rollout buckets, and audited per-tenant overrides.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadFlags}
            disabled={isLoadingFlags}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-50"
            title="Refresh flags"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoadingFlags ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 dark:bg-amber-600 dark:hover:bg-amber-700 hover:bg-slate-800 rounded-lg shadow-sm transition"
            >
              <Plus className="h-4 w-4" />
              New Feature Flag
            </button>
          )}
        </div>
      </div>

      {/* 2. Search & Filters Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search feature flags by key or description..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="h-3.5 w-3.5" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">All Default States</option>
              <option value="enabled">Default Enabled</option>
              <option value="disabled">Default Disabled</option>
            </select>
          </div>

          {/* Rollout Filter */}
          <select
            value={rolloutFilter}
            onChange={(e) => setRolloutFilter(e.target.value as any)}
            className="text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="all">All Rollout Ranges</option>
            <option value="100">100% General Availability</option>
            <option value="in_progress">Gradual (1% - 99%)</option>
            <option value="0">0% Rollout (Restricted)</option>
          </select>
        </div>
      </div>

      {/* 3. Feature Flags List Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Feature Key</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4 text-center">Default State</th>
                <th className="py-3 px-4">Gradual Rollout</th>
                <th className="py-3 px-4 text-center">Overrides</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoadingFlags && flags.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-amber-500 mb-2" />
                    Loading platform feature flags...
                  </td>
                </tr>
              ) : visibleFlags.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No feature flags match your filters.
                  </td>
                </tr>
              ) : (
                visibleFlags.map((flag) => {
                  const hasOverrides = (flag.overrideCount ?? 0) > 0;
                  return (
                    <tr
                      key={flag.key}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition cursor-pointer"
                      onClick={() => openFlagDrawer(flag.key)}
                    >
                      {/* Key */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-amber-400">
                        <div className="flex items-center gap-2">
                          <Flag className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{flag.key}</span>
                        </div>
                      </td>

                      {/* Description */}
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                        {flag.description || '—'}
                      </td>

                      {/* Default State */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                            flag.defaultState
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                              : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                          }`}
                        >
                          {flag.defaultState ? (
                            <>
                              <Check className="h-3 w-3" /> Enabled
                            </>
                          ) : (
                            <>
                              <X className="h-3 w-3" /> Disabled
                            </>
                          )}
                        </span>
                      </td>

                      {/* Rollout % */}
                      <td className="py-3.5 px-4 w-48">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {flag.rolloutPercentage}% Rollout
                            </span>
                            <span className="text-slate-400">
                              {flag.rolloutPercentage === 100
                                ? 'All Tenants'
                                : flag.rolloutPercentage === 0
                                  ? 'Off'
                                  : 'Gradual'}
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full transition-all duration-300 ${
                                flag.rolloutPercentage === 100
                                  ? 'bg-emerald-500'
                                  : flag.rolloutPercentage > 0
                                    ? 'bg-amber-500'
                                    : 'bg-slate-300 dark:bg-slate-700'
                              }`}
                              style={{ width: `${flag.rolloutPercentage}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Overrides Count */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                            hasOverrides
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800'
                              : 'bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800/40 dark:text-slate-500 dark:border-slate-800'
                          }`}
                        >
                          <Building2 className="h-3 w-3" />
                          {flag.overrideCount ?? 0}{' '}
                          {(flag.overrideCount ?? 0) === 1 ? 'override' : 'overrides'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openFlagDrawer(flag.key, 'overrides')}
                            className="px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded transition"
                          >
                            Overrides
                          </button>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRolloutFlag(flag);
                                setRolloutDraft(flag.rolloutPercentage);
                                setDefaultStateDraft(flag.defaultState);
                              }}
                              className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition"
                              title="Edit Rollout"
                            >
                              <Sliders className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. PER-FLAG SLIDE-OVER DRAWER */}
      {selectedFlagKey && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div
            className="w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 overflow-hidden animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-black text-slate-900 dark:text-amber-400">
                    {selectedFlagKey}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      flagDetail?.defaultState
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    Default: {flagDetail?.defaultState ? 'Enabled' : 'Disabled'}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                    {flagDetail?.rolloutPercentage}% Rollout
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  {flagDetail?.description || 'Feature flag configuration and tenant override management.'}
                </p>
              </div>

              <button
                type="button"
                onClick={closeDrawer}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
                title="Close drawer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 px-5 gap-4 bg-white dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setDrawerTab('overrides')}
                className={`py-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                  drawerTab === 'overrides'
                    ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                Tenant Overrides ({flagDetail?.overrides?.length || 0})
              </button>

              {canEdit && (
                <button
                  type="button"
                  onClick={() => setDrawerTab('add_override')}
                  className={`py-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                    drawerTab === 'add_override'
                      ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                  }`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Override
                </button>
              )}

              <button
                type="button"
                onClick={() => setDrawerTab('inspector')}
                className={`py-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                  drawerTab === 'inspector'
                    ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Plan vs Override Inspector
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {isLoadingDetail ? (
                <div className="py-16 text-center text-slate-500">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-amber-500 mb-2" />
                  Loading flag overrides...
                </div>
              ) : drawerTab === 'overrides' ? (
                /* TAB 1: Overrides List */
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Active and Scheduled Tenant Overrides
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setDrawerTab('add_override')}
                        className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add New Override
                      </button>
                    )}
                  </div>

                  {flagDetail?.overrides && flagDetail.overrides.length > 0 ? (
                    flagDetail.overrides.map((ov) => (
                      <div
                        key={ov.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4 space-y-3 shadow-xs"
                      >
                        {/* Top row: Tenant Name, Plan, and State Pill */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-slate-900 dark:text-white">
                                {ov.tenantName}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                                {ov.tenantSubdomain}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              Subscription Plan: <strong className="text-slate-700 dark:text-slate-200">{ov.planName || 'Standard'}</strong>
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                                ov.enabled
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                  : 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                              }`}
                            >
                              Override: {ov.enabled ? 'Force Enabled' : 'Force Disabled'}
                            </span>

                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => handleRemoveOverride(ov.tenantId, ov.tenantName)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded transition"
                                title="Remove override"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* CLEAR "PLAN DEFAULT VS OVERRIDE" COMPARISON INDICATOR */}
                        <div className="rounded-lg p-2.5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-start gap-2.5">
                          <HelpCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                          <div className="text-xs space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500">Plan Default:</span>
                              <span
                                className={`font-semibold px-1.5 py-0.2 rounded text-[10px] ${
                                  ov.planDefault
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                }`}
                              >
                                {ov.planDefault ? 'Enabled' : 'Disabled'}
                              </span>
                              <span className="text-slate-400">&rarr;</span>
                              <span className="text-slate-500">Governing Decision:</span>
                              <span className="font-bold text-amber-600 dark:text-amber-400">
                                {ov.explanation}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Audit Reason Callout */}
                        <div className="text-xs bg-slate-100/80 dark:bg-slate-900/60 p-2.5 rounded-lg border-l-4 border-amber-500">
                          <span className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">
                            Audit Justification (Required):
                          </span>
                          <p className="text-slate-600 dark:text-slate-300 italic">
                            &ldquo;{ov.reason || 'No justification provided'}&rdquo;
                          </p>
                        </div>

                        {/* Expiry & Meta */}
                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            {ov.expiresAt ? (
                              <span className={ov.isExpired ? 'text-red-500 font-semibold' : ''}>
                                {ov.isExpired ? 'Expired: ' : 'Expires: '}
                                {new Date(ov.expiresAt).toLocaleDateString()}
                              </span>
                            ) : (
                              <span>Permanent (No expiration)</span>
                            )}
                          </div>
                          <span>Granted {new Date(ov.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center space-y-2">
                      <ShieldCheck className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto" />
                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        No Overrides Configured
                      </h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        All tenants receive this feature strictly according to their subscription plan tier and the {flagDetail?.rolloutPercentage}% gradual rollout bucket.
                      </p>
                    </div>
                  )}
                </div>
              ) : drawerTab === 'add_override' ? (
                /* TAB 2: Add Tenant Override Form */
                <form onSubmit={handleSaveOverride} className="space-y-4">
                  <div className="rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-3.5 text-xs text-amber-800 dark:text-amber-300">
                    <strong>Audited Operation:</strong> Creating an override forces feature enablement or restriction regardless of the tenant&apos;s plan tier. All changes are immutable in <code>platform_audit_logs</code>.
                  </div>

                  {overrideError && (
                    <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-3 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{overrideError}</span>
                    </div>
                  )}

                  {/* Tenant Select */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      Target Tenant *
                    </label>
                    <select
                      value={selectedTenantId}
                      onChange={(e) => setSelectedTenantId(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      {allTenants.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.subdomain}) — {t.plan || 'Standard Plan'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Override State */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      Override State *
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setOverrideValue(true)}
                        className={`p-3 rounded-lg border text-left text-xs font-semibold transition ${
                          overrideValue === true
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-500/20'
                            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="font-bold flex items-center gap-1.5 mb-1">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Force Enabled
                        </div>
                        <span className="text-[11px] text-slate-500">
                          Grants access even if plan restricts it.
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setOverrideValue(false)}
                        className={`p-3 rounded-lg border text-left text-xs font-semibold transition ${
                          overrideValue === false
                            ? 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-700 ring-2 ring-rose-500/20'
                            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="font-bold flex items-center gap-1.5 mb-1">
                          <XCircle className="h-4 w-4 text-rose-500" /> Force Disabled
                        </div>
                        <span className="text-[11px] text-slate-500">
                          Blocks access even if plan includes it.
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Required Reason */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      Audit Justification (Required) *
                    </label>
                    <textarea
                      rows={3}
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="e.g. Early adopter beta trial approved by Product Leadership; pilot evaluation for enterprise contract renewal."
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-[11px] text-slate-400">
                      Must describe why this tenant deviates from normal plan entitlements.
                    </span>
                  </div>

                  {/* Optional Expiry Date */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      Expiration Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={overrideExpiresAt}
                      onChange={(e) => setOverrideExpiresAt(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-[11px] text-slate-400">
                      Leave empty for permanent override until manually removed.
                    </span>
                  </div>

                  <div className="pt-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setDrawerTab('overrides')}
                      className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingOverride}
                      className="px-4 py-2 text-xs font-bold text-white bg-slate-900 dark:bg-amber-600 dark:hover:bg-amber-700 hover:bg-slate-800 rounded-lg shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isSubmittingOverride && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Save Feature Override
                    </button>
                  </div>
                </form>
              ) : (
                /* TAB 3: Plan vs Override Inspector / Simulator */
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      Select Tenant to Inspect Feature Resolution
                    </label>
                    <select
                      value={inspectTenantId}
                      onChange={(e) => handleInspectTenantChange(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      {allTenants.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.subdomain}) — Plan: {t.plan || 'Standard'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {isEvaluating ? (
                    <div className="py-12 text-center text-slate-500">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-amber-500 mb-2" />
                      Evaluating resolution chain...
                    </div>
                  ) : evaluationResult ? (
                    <div className="space-y-4">
                      {/* Big Effective Access Banner */}
                      <div
                        className={`rounded-xl p-5 border flex items-center justify-between ${
                          evaluationResult.enabled
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                            : 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                        }`}
                      >
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider block opacity-75">
                            Effective Tenant Entitlement
                          </span>
                          <span className="text-xl font-black">
                            {evaluationResult.enabled ? 'FEATURE IS ENABLED' : 'FEATURE IS RESTRICTED'}
                          </span>
                          <p className="mt-1 text-xs opacity-90">
                            Governing Authority:{' '}
                            <strong className="underline">
                              {evaluationResult.source === 'tenant_override'
                                ? 'Tenant Override (Priority 1)'
                                : evaluationResult.source === 'flag_rollout'
                                  ? 'Gradual Rollout Hash Bucket (Priority 2)'
                                  : 'Subscription Plan Default (Priority 3)'}
                            </strong>
                          </p>
                        </div>

                        {evaluationResult.enabled ? (
                          <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="h-10 w-10 text-rose-600 dark:text-rose-400 shrink-0" />
                        )}
                      </div>

                      {/* Step-by-Step Resolution Chain Breakdown */}
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                          Evaluation Chain Trace (Rules §2)
                        </h4>

                        {/* Step 1: Override */}
                        <div className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-xs">
                          <span className="font-mono font-bold text-amber-500 shrink-0">1.</span>
                          <div className="flex-1">
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              Tenant Override Check
                            </span>
                            <p className="text-slate-500 mt-0.5">
                              {evaluationResult.source === 'tenant_override' ? (
                                <span className="text-emerald-600 font-semibold">
                                  MATCHED: Override active ({evaluationResult.reason || 'Reason recorded'})
                                </span>
                              ) : (
                                'No active override found for this tenant.'
                              )}
                            </p>
                          </div>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              evaluationResult.source === 'tenant_override'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'text-slate-400'
                            }`}
                          >
                            {evaluationResult.source === 'tenant_override' ? 'GOVERNING' : 'PASSED'}
                          </span>
                        </div>

                        {/* Step 2: Rollout */}
                        <div className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-xs">
                          <span className="font-mono font-bold text-amber-500 shrink-0">2.</span>
                          <div className="flex-1">
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              Rollout Percentage Hash
                            </span>
                            <p className="text-slate-500 mt-0.5">
                              Tenant hash bucket: #{evaluationResult.bucket ?? 'N/A'} vs Rollout:{' '}
                              {flagDetail?.rolloutPercentage}%.
                            </p>
                          </div>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              evaluationResult.source === 'flag_rollout'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'text-slate-400'
                            }`}
                          >
                            {evaluationResult.source === 'flag_rollout' ? 'GOVERNING' : 'SKIPPED'}
                          </span>
                        </div>

                        {/* Step 3: Plan Default */}
                        <div className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-xs">
                          <span className="font-mono font-bold text-amber-500 shrink-0">3.</span>
                          <div className="flex-1">
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              Subscription Plan Entitlement
                            </span>
                            <p className="text-slate-500 mt-0.5">
                              Plan code: <code>{evaluationResult.planCode || 'starter'}</code>.
                            </p>
                          </div>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              evaluationResult.source === 'plan_default'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'text-slate-400'
                            }`}
                          >
                            {evaluationResult.source === 'plan_default' ? 'GOVERNING' : 'SKIPPED'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. QUICK EDIT ROLLOUT MODAL */}
      {editingRolloutFlag && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Adjust Rollout: {editingRolloutFlag.key}
                </h3>
                <p className="text-xs text-slate-500">Gradual rollout & default fallback state.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingRolloutFlag(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                  <span>Rollout Percentage:</span>
                  <span className="font-mono text-amber-600 dark:text-amber-400 text-sm">
                    {rolloutDraft}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={rolloutDraft}
                  onChange={(e) => setRolloutDraft(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>0% (Disabled)</span>
                  <span>50% (Pilot)</span>
                  <span>100% (General Availability)</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    Default Fallback State
                  </span>
                  <span className="text-[11px] text-slate-400">
                    State for tenants outside the rollout percentage.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setDefaultStateDraft((prev) => !prev)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                    defaultStateDraft
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {defaultStateDraft ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingRolloutFlag(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveQuickRollout}
                disabled={isSavingRollout}
                className="px-4 py-1.5 text-xs font-bold text-white bg-slate-900 dark:bg-amber-600 dark:hover:bg-amber-700 hover:bg-slate-800 rounded-lg transition flex items-center gap-1.5"
              >
                {isSavingRollout && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. CREATE FEATURE FLAG MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateFlag}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Create Platform Feature Flag
                </h3>
                <p className="text-xs text-slate-500">Define a new runtime toggleable feature gate.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {createError && (
                <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-3 text-xs text-red-700 dark:text-red-300">
                  {createError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Feature Key / Identifier *
                </label>
                <input
                  type="text"
                  required
                  value={createKey}
                  onChange={(e) => setCreateKey(e.target.value)}
                  placeholder="e.g. advanced_analytics_v2"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Description
                </label>
                <input
                  type="text"
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  placeholder="What capability does this flag gate?"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                  <span>Initial Rollout Percentage:</span>
                  <span className="font-mono text-amber-600 dark:text-amber-400">{createRollout}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={createRollout}
                  onChange={(e) => setCreateRollout(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Initial Default State:
                </span>
                <button
                  type="button"
                  onClick={() => setCreateDefaultState((prev) => !prev)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${
                    createDefaultState
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {createDefaultState ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreatingFlag}
                className="px-4 py-1.5 text-xs font-bold text-white bg-slate-900 dark:bg-amber-600 dark:hover:bg-amber-700 hover:bg-slate-800 rounded-lg transition flex items-center gap-1.5"
              >
                {isCreatingFlag && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Create Flag
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
