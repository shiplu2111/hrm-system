import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Filter,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import {
  KUDOS_TYPE_LABELS,
  listKudos,
  listKudosModeration,
  removeKudos,
  restoreKudos,
} from '@/lib/engagement-api';
import { ApiError } from '@/lib/tenant-api-client';
import type {
  EmployeeKudosModerationRecord,
  EmployeeKudosModerationStatus,
  EmployeeKudosRecord,
  EmployeeKudosType,
  KudosModerationSummary,
} from '@hrm/shared-types';

type FeedMode = 'feed' | 'moderation';

const MODERATION_REASON_PRESETS = [
  'Inappropriate or offensive language',
  'Harassment or code of conduct violation',
  'Spam or off-topic content',
  'Confidential or sensitive information',
  'Posted in error / duplicate',
];

interface KudosFeedModerationSectionProps {
  companyId: string;
  employees: Array<{ id: string; name: string }>;
  canModerate: boolean;
  canViewAudit: boolean;
  initialKudosFeed: EmployeeKudosRecord[];
  onRefreshParent: () => Promise<void>;
  onError: (message: string) => void;
}

export function KudosFeedModerationSection({
  companyId,
  employees,
  canModerate,
  canViewAudit,
  initialKudosFeed,
  onRefreshParent,
  onError,
}: KudosFeedModerationSectionProps) {
  const [mode, setMode] = useState<FeedMode>(canModerate ? 'moderation' : 'feed');

  // Public feed state
  const [publicFeed, setPublicFeed] = useState<EmployeeKudosRecord[]>(initialKudosFeed);
  const [publicSearch, setPublicSearch] = useState('');
  const [debouncedPublicSearch, setDebouncedPublicSearch] = useState('');
  const [publicTypeFilter, setPublicTypeFilter] = useState<EmployeeKudosType | ''>('');
  const [publicRecipientFilter, setPublicRecipientFilter] = useState('');
  const [publicLoading, setPublicLoading] = useState(false);

  // Moderation queue state
  const [modItems, setModItems] = useState<EmployeeKudosModerationRecord[]>([]);
  const [modSummary, setModSummary] = useState<KudosModerationSummary | null>(null);
  const [modStatusFilter, setModStatusFilter] = useState<EmployeeKudosModerationStatus | 'all'>('all');
  const [modTypeFilter, setModTypeFilter] = useState<EmployeeKudosType | ''>('');
  const [modRecipientFilter, setModRecipientFilter] = useState('');
  const [modSearch, setModSearch] = useState('');
  const [debouncedModSearch, setDebouncedModSearch] = useState('');
  const [modLoading, setModLoading] = useState(false);

  // Action modals state
  const [removeTarget, setRemoveTarget] = useState<EmployeeKudosRecord | EmployeeKudosModerationRecord | null>(null);
  const [removalReason, setRemovalReason] = useState('');
  const [restoreTarget, setRestoreTarget] = useState<EmployeeKudosModerationRecord | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  useEffect(() => {
    setPublicFeed(initialKudosFeed);
  }, [initialKudosFeed]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPublicSearch(publicSearch.trim()), 200);
    return () => clearTimeout(timer);
  }, [publicSearch]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedModSearch(modSearch.trim()), 200);
    return () => clearTimeout(timer);
  }, [modSearch]);

  useEffect(() => {
    if (!canModerate && mode === 'moderation') {
      setMode('feed');
    }
  }, [canModerate, mode]);

  const loadPublicFeed = useCallback(async () => {
    if (!companyId) return;
    setPublicLoading(true);
    try {
      const rows = await listKudos(companyId, {
        limit: 100,
        ...(publicTypeFilter ? { kudosType: publicTypeFilter } : {}),
        ...(publicRecipientFilter ? { toEmployeeId: publicRecipientFilter } : {}),
        ...(debouncedPublicSearch ? { q: debouncedPublicSearch } : {}),
      });
      setPublicFeed(rows);
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Failed to load recognition feed');
    } finally {
      setPublicLoading(false);
    }
  }, [companyId, onError, publicRecipientFilter, debouncedPublicSearch, publicTypeFilter]);

  const loadModerationFeed = useCallback(async () => {
    if (!companyId || !canModerate) return;
    setModLoading(true);
    try {
      const result = await listKudosModeration(companyId, {
        status: modStatusFilter,
        ...(modTypeFilter ? { kudosType: modTypeFilter } : {}),
        ...(modRecipientFilter ? { toEmployeeId: modRecipientFilter } : {}),
        ...(debouncedModSearch ? { q: debouncedModSearch } : {}),
        limit: 100,
      });
      setModItems(result.items);
      setModSummary(result.summary);
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Failed to load moderation queue');
    } finally {
      setModLoading(false);
    }
  }, [companyId, canModerate, modStatusFilter, modTypeFilter, modRecipientFilter, debouncedModSearch, onError]);

  useEffect(() => {
    if (mode === 'moderation' && canModerate) {
      void loadModerationFeed();
    } else if (mode === 'feed') {
      void loadPublicFeed();
    }
  }, [mode, canModerate, loadModerationFeed, loadPublicFeed]);

  const openRemoveModal = (item: EmployeeKudosRecord | EmployeeKudosModerationRecord) => {
    setRemoveTarget(item);
    setRemovalReason('');
    setFeedbackBanner(null);
  };

  const handleConfirmRemove = async () => {
    if (!removeTarget) return;
    setActionLoading(true);
    try {
      await removeKudos(removeTarget.id, removalReason.trim() || undefined);
      setRemoveTarget(null);
      setRemovalReason('');
      setFeedbackBanner(
        'Recognition post removed. It is no longer visible in employee web or mobile feeds.',
      );
      await Promise.all([
        loadPublicFeed(),
        canModerate ? loadModerationFeed() : Promise.resolve(),
        onRefreshParent(),
      ]);
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Failed to remove recognition post');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoreTarget) return;
    setActionLoading(true);
    try {
      await restoreKudos(restoreTarget.id);
      setRestoreTarget(null);
      setFeedbackBanner('Recognition post restored to the active employee feed.');
      await Promise.all([
        loadPublicFeed(),
        canModerate ? loadModerationFeed() : Promise.resolve(),
        onRefreshParent(),
      ]);
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Failed to restore recognition post');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <section className="space-y-4">
      {/* Header & Mode Switcher */}
      <div className="surface flex flex-col justify-between gap-4 rounded-xl border border-base p-4 shadow-card lg:flex-row lg:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-primary">Kudos &amp; Recognition Feed</h3>
            {canModerate && (
              <Badge tone="accent">
                <ShieldCheck className="mr-1 h-3 w-3" /> Moderation Enabled
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted">
            Peer-to-peer and manager recognition across the company, with admin content moderation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canModerate && (
            <div className="flex rounded-lg border border-base bg-[rgb(var(--bg-muted))] p-1">
              <button
                type="button"
                onClick={() => setMode('feed')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  mode === 'feed'
                    ? 'surface text-primary shadow-sm'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" /> Public Feed
              </button>
              <button
                type="button"
                onClick={() => setMode('moderation')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  mode === 'moderation'
                    ? 'surface text-primary shadow-sm'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                <ShieldAlert className="h-3.5 w-3.5 text-amber-500" /> Admin Moderation View
                {modSummary && modSummary.removedCount > 0 && (
                  <span className="ml-1 rounded-full bg-error-100 px-1.5 py-0.5 text-[10px] font-bold text-error-700 dark:bg-error-950/60 dark:text-error-300">
                    {modSummary.removedCount}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {feedbackBanner && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{feedbackBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-xs font-semibold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* =====================================================================
          MODE A: ADMIN MODERATION VIEW
         ===================================================================== */}
      {mode === 'moderation' && canModerate ? (
        <div className="space-y-4">
          {/* Moderation Privacy & Audit Notice */}
          <div className="flex flex-col justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-950/20 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="text-xs">
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  Admin Moderation Controls
                </p>
                <p className="mt-0.5 text-amber-800/90 dark:text-amber-300/90">
                  Removing an inappropriate post immediately hides it from all employee web dashboards and mobile feeds while retaining the moderation reason and audit trail.
                </p>
              </div>
            </div>
            {canViewAudit && (
              <a
                href="/settings/audit-log?module=engagement"
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-300 bg-white/80 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-white dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Audit Log
              </a>
            )}
          </div>

          {/* Moderation KPI Summary Cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="surface rounded-xl border border-base p-4 shadow-card">
              <p className="text-xs font-medium text-secondary">Active Feed Posts</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {modSummary?.activeCount ?? 0}
              </p>
              <p className="mt-0.5 text-[11px] text-muted">
                {modSummary?.thisMonthCount ?? 0} posted this month
              </p>
            </div>
            <div className="surface rounded-xl border border-base p-4 shadow-card">
              <p className="text-xs font-medium text-secondary">Removed / Moderated</p>
              <p className="mt-1 text-2xl font-bold text-rose-600 dark:text-rose-400">
                {modSummary?.removedCount ?? 0}
              </p>
              <p className="mt-0.5 text-[11px] text-muted">Hidden from employees</p>
            </div>
            <div className="surface rounded-xl border border-base p-4 shadow-card">
              <p className="text-xs font-medium text-secondary">Peer Shoutouts (Active)</p>
              <p className="mt-1 text-2xl font-bold text-primary">
                {modSummary?.peerCount ?? 0}
              </p>
              <p className="mt-0.5 text-[11px] text-muted">Colleague-to-colleague</p>
            </div>
            <div className="surface rounded-xl border border-base p-4 shadow-card">
              <p className="text-xs font-medium text-secondary">Manager Recognition (Active)</p>
              <p className="mt-1 text-2xl font-bold text-accent-600 dark:text-accent-400">
                {modSummary?.managerCount ?? 0}
              </p>
              <p className="mt-0.5 text-[11px] text-muted">Direct manager praise</p>
            </div>
          </div>

          {/* Moderation Filters Bar */}
          <div className="surface flex flex-col gap-3 rounded-xl border border-base p-4 shadow-card lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {(['all', 'active', 'removed'] as const).map((statusOption) => (
                <button
                  key={statusOption}
                  type="button"
                  onClick={() => setModStatusFilter(statusOption)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                    modStatusFilter === statusOption
                      ? 'border-accent-600 bg-accent-600 text-white'
                      : 'border-base bg-[rgb(var(--bg-muted))] text-secondary hover:text-primary'
                  }`}
                >
                  {statusOption === 'all'
                    ? `All Posts (${(modSummary?.activeCount ?? 0) + (modSummary?.removedCount ?? 0)})`
                    : statusOption === 'active'
                      ? `Active (${modSummary?.activeCount ?? 0})`
                      : `Removed (${modSummary?.removedCount ?? 0})`}
                </button>
              ))}
            </div>

            <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
              <div className="relative min-w-[220px] flex-1 lg:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  value={modSearch}
                  onChange={(e) => setModSearch(e.target.value)}
                  placeholder="Search message or employee…"
                  className="pl-9"
                />
              </div>

              <Select
                value={modTypeFilter}
                onChange={(e) => setModTypeFilter(e.target.value as EmployeeKudosType | '')}
                className="w-40"
              >
                <option value="">All types</option>
                <option value="peer">Peer recognition</option>
                <option value="manager">Manager recognition</option>
              </Select>

              <Select
                value={modRecipientFilter}
                onChange={(e) => setModRecipientFilter(e.target.value)}
                className="w-44"
              >
                <option value="">All recipients</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </Select>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => void loadModerationFeed()}
                disabled={modLoading}
                title="Refresh moderation queue"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${modLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Moderation Queue List */}
          {modLoading ? (
            <div className="surface flex items-center justify-center rounded-xl border border-base p-12 text-sm text-secondary shadow-card">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading moderation feed…
            </div>
          ) : modItems.length === 0 ? (
            <div className="surface rounded-xl border border-base p-12 text-center text-sm text-muted shadow-card">
              No recognition posts match your moderation filters.
            </div>
          ) : (
            <div className="space-y-3">
              {modItems.map((item) => {
                const isRemoved = item.moderationStatus === 'removed';
                return (
                  <div
                    key={item.id}
                    className={`surface rounded-xl border p-5 shadow-card transition-all ${
                      isRemoved
                        ? 'border-error-200/80 bg-error-50/20 dark:border-error-900/40 dark:bg-error-950/10'
                        : 'border-base'
                    }`}
                  >
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                      <div className="flex-1 space-y-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={isRemoved ? 'error' : 'success'} dot>
                            {isRemoved ? 'Removed' : 'Active'}
                          </Badge>
                          <Badge tone={item.kudosType === 'manager' ? 'accent' : 'neutral'}>
                            <Sparkles className="mr-1 h-3 w-3" />
                            {KUDOS_TYPE_LABELS[item.kudosType]}
                          </Badge>
                          <span className="text-xs text-muted">
                            Posted {new Date(item.createdAt).toLocaleString()}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-primary">
                          <span>{item.fromEmployeeName}</span>
                          <ChevronRight className="h-4 w-4 text-muted" />
                          <span className="text-accent-600 dark:text-accent-400">
                            {item.toEmployeeName}
                          </span>
                        </div>

                        <p
                          className={`whitespace-pre-wrap text-sm leading-relaxed ${
                            isRemoved ? 'text-muted line-through' : 'text-secondary'
                          }`}
                        >
                          &ldquo;{item.message}&rdquo;
                        </p>

                        {isRemoved && (
                          <div className="mt-3 rounded-lg border border-error-200 bg-error-50/70 p-3 text-xs dark:border-error-900/50 dark:bg-error-950/30">
                            <p className="font-semibold text-error-800 dark:text-error-200">
                              Moderation Action Recorded
                            </p>
                            <p className="mt-1 text-error-700 dark:text-error-300">
                              <span className="font-medium">Reason:</span>{' '}
                              {item.removalReason || 'Removed by administrator'}
                            </p>
                            <p className="mt-0.5 text-error-600/90 dark:text-error-400/90">
                              Removed by {item.removedByName ?? 'Administrator'} on{' '}
                              {item.removedAt
                                ? new Date(item.removedAt).toLocaleString()
                                : '—'}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {!isRemoved ? (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => openRemoveModal(item)}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Remove Post
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setRestoreTarget(item)}
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Restore
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* =====================================================================
           MODE B: PUBLIC COMPANY RECOGNITION WALL (ACTIVE FEED ONLY)
           ===================================================================== */
        <div className="space-y-4">
          <div className="surface flex flex-col gap-3 rounded-xl border border-base p-4 shadow-card md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                value={publicSearch}
                onChange={(e) => setPublicSearch(e.target.value)}
                placeholder="Search recognition wall by colleague or message…"
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-muted" />
              <Select
                value={publicTypeFilter}
                onChange={(e) => setPublicTypeFilter(e.target.value as EmployeeKudosType | '')}
                className="w-40"
              >
                <option value="">All types</option>
                <option value="peer">Peer recognition</option>
                <option value="manager">Manager recognition</option>
              </Select>
              <Select
                value={publicRecipientFilter}
                onChange={(e) => setPublicRecipientFilter(e.target.value)}
                className="w-44"
              >
                <option value="">All recipients</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {publicLoading ? (
            <div className="surface flex items-center justify-center rounded-xl border border-base p-12 text-sm text-secondary shadow-card">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading recognition wall…
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {publicFeed.map((item) => (
                <div
                  key={item.id}
                  className="surface flex flex-col justify-between rounded-xl border border-base p-5 shadow-card transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone={item.kudosType === 'manager' ? 'accent' : 'neutral'}>
                        <Sparkles className="mr-1 h-3 w-3" />
                        {KUDOS_TYPE_LABELS[item.kudosType]}
                      </Badge>
                      <span className="text-[11px] text-muted">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-primary">
                      <span>{item.fromEmployeeName}</span>
                      <ChevronRight className="h-4 w-4 text-muted" />
                      <span className="text-accent-600 dark:text-accent-400">
                        {item.toEmployeeName}
                      </span>
                    </div>

                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-secondary">
                      &ldquo;{item.message}&rdquo;
                    </p>
                  </div>

                  {canModerate && (
                    <div className="mt-4 flex justify-end border-t border-base pt-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-error-600 hover:bg-error-50 hover:text-error-700 dark:text-error-400 dark:hover:bg-error-950/30"
                        onClick={() => openRemoveModal(item)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remove post
                      </Button>
                    </div>
                  )}
                </div>
              ))}

              {!publicFeed.length && (
                <div className="surface col-span-2 rounded-xl border border-base p-12 text-center text-sm text-muted shadow-card">
                  No recognition posts shared yet.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          MODAL: REMOVE INAPPROPRIATE KUDOS POST
         ===================================================================== */}
      <Modal
        open={Boolean(removeTarget)}
        onClose={() => !actionLoading && setRemoveTarget(null)}
        title="Remove Inappropriate Recognition Post"
        description="This post will immediately disappear from employee feeds and mobile apps. An audit record will be kept."
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              disabled={actionLoading}
              onClick={() => setRemoveTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={actionLoading}
              onClick={() => void handleConfirmRemove()}
            >
              <Trash2 className="h-4 w-4" /> {actionLoading ? 'Removing…' : 'Confirm Remove'}
            </Button>
          </>
        }
      >
        {removeTarget && (
          <div className="space-y-4">
            <div className="rounded-xl border border-base bg-[rgb(var(--bg-muted))] p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <span>{removeTarget.fromEmployeeName}</span>
                <ChevronRight className="h-3.5 w-3.5 text-muted" />
                <span className="text-accent-600 dark:text-accent-400">
                  {removeTarget.toEmployeeName}
                </span>
              </div>
              <p className="mt-1.5 text-sm italic text-secondary whitespace-pre-wrap">
                &ldquo;{removeTarget.message}&rdquo;
              </p>
            </div>

            <div>
              <Label className="mb-1.5 block text-xs">Quick Moderation Reasons</Label>
              <div className="flex flex-wrap gap-1.5">
                {MODERATION_REASON_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRemovalReason(preset)}
                    className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                      removalReason === preset
                        ? 'border-error-500 bg-error-50 text-error-700 dark:bg-error-950/40 dark:text-error-300'
                        : 'border-base bg-[rgb(var(--bg-base))] text-secondary hover:text-primary'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="kudos-removal-reason">Moderation Reason (logged in audit trail)</Label>
              <Textarea
                id="kudos-removal-reason"
                rows={3}
                maxLength={500}
                value={removalReason}
                onChange={(e) => setRemovalReason(e.target.value)}
                placeholder="Explain why this recognition post violates policy (optional — defaults to 'Removed by administrator')…"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* =====================================================================
          MODAL: RESTORE MODERATED KUDOS POST
         ===================================================================== */}
      <Modal
        open={Boolean(restoreTarget)}
        onClose={() => !actionLoading && setRestoreTarget(null)}
        title="Restore Recognition Post"
        description="Make this recognition post visible again on the public company feed and My Space dashboards."
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              disabled={actionLoading}
              onClick={() => setRestoreTarget(null)}
            >
              Cancel
            </Button>
            <Button disabled={actionLoading} onClick={() => void handleConfirmRestore()}>
              <RotateCcw className="h-4 w-4" /> {actionLoading ? 'Restoring…' : 'Restore to Feed'}
            </Button>
          </>
        }
      >
        {restoreTarget && (
          <div className="space-y-3">
            <div className="rounded-xl border border-base bg-[rgb(var(--bg-muted))] p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <span>{restoreTarget.fromEmployeeName}</span>
                <ChevronRight className="h-3.5 w-3.5 text-muted" />
                <span>{restoreTarget.toEmployeeName}</span>
              </div>
              <p className="mt-1.5 text-sm text-secondary whitespace-pre-wrap">
                &ldquo;{restoreTarget.message}&rdquo;
              </p>
            </div>
            {restoreTarget.removalReason && (
              <p className="text-xs text-muted">
                Previously removed reason: <span className="font-medium text-secondary">{restoreTarget.removalReason}</span>
              </p>
            )}
          </div>
        )}
      </Modal>
    </section>
  );
}

