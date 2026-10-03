import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, ChevronRight, Copy, Filter, History, Lock, ScrollText, X } from 'lucide-react';
import type { AuditLogEntry, AuditLogFilterOptions } from '@hrm/shared-types';
import { usePermission } from '@hrm/portal-ui';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FieldError } from '@/components/ui/FieldError';
import { Input, Label, Select } from '@/components/ui/Form';
import { Pagination } from '@/components/ui/Pagination';
import { OrgErrorBanner, OrgTableSkeleton } from '@/components/org/OrgScreenParts';
import { AuditEntryDetail } from '@/components/audit/AuditEntryDetail';
import { auditActionTone } from '@/components/audit/audit-tones';
import { getAuditLogFilters, listAuditLogs } from '@/lib/audit-api';
import { auditCopy } from '@/lib/audit-copy';
import {
  AUDIT_ACTIONS,
  AUDIT_PAGE_SIZES,
  EMPTY_AUDIT_FILTERS,
  actorLabel,
  countChangedFields,
  filtersFromSearchParams,
  filtersToQuery,
  filtersToSearchParams,
  formatAuditTimestamp,
  hasActiveFilters,
  humanizeKey,
  isDateRangeValid,
  isUuid,
  presetRange,
  type AuditFilters,
  type DateRangePreset,
} from '@/lib/audit-log';
import { formatRelativeTime } from '@/lib/leave-request';
import { ApiError } from '@/lib/tenant-api-client';

const copy = auditCopy;
const PRESETS: DateRangePreset[] = ['today', '7d', '30d', '90d'];

function changeSummary(entry: AuditLogEntry): string {
  if (entry.action === 'delete' && !entry.newValue) return copy.deletedSummary;
  if (!entry.oldValue && entry.newValue) return copy.createdSummary(Object.keys(entry.newValue).length);
  return copy.changeSummary(countChangedFields(entry));
}

function CopyIdButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void copyId();
      }}
      className="rounded p-1 text-muted hover:bg-[rgb(var(--bg-hover))] hover:text-primary"
      aria-label={copied ? copy.copied : copy.copyRecordId}
      title={copied ? copy.copied : copy.copyRecordId}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function AuditLogContent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);

  const [options, setOptions] = useState<AuditLogFilterOptions>({ modules: [], actors: [] });
  const [optionsError, setOptionsError] = useState(false);
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);
  const [recordDraft, setRecordDraft] = useState(filters.recordId);
  const [recordError, setRecordError] = useState<string | null>(null);
  const requestId = useRef(0);

  const rangeValid = isDateRangeValid(filters.from, filters.to);
  const recordValid = !filters.recordId || isUuid(filters.recordId);

  useEffect(() => setRecordDraft(filters.recordId), [filters.recordId]);

  const updateFilters = useCallback(
    (patch: Partial<AuditFilters>) => {
      const resetsPage = Object.keys(patch).some((k) => k !== 'page');
      const next = { ...filters, ...(resetsPage ? { page: 1 } : {}), ...patch };
      setSearchParams(filtersToSearchParams(next));
    },
    [filters, setSearchParams],
  );

  useEffect(() => {
    let cancelled = false;
    getAuditLogFilters()
      .then((result) => !cancelled && setOptions(result))
      .catch(() => !cancelled && setOptionsError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    if (!rangeValid || !recordValid) {
      requestId.current += 1;
      setEntries([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const page = await listAuditLogs(filtersToQuery(filters));
      if (id !== requestId.current) return;
      setEntries(page.entries);
      setTotal(page.total);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err instanceof ApiError ? err.message : copy.loadError);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [filters, rangeValid, recordValid]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!loading && entries.length === 0 && total > 0 && filters.page > 1) {
      updateFilters({ page: 1 });
    }
  }, [loading, entries.length, total, filters.page, updateFilters]);

  const applyRecordId = () => {
    const value = recordDraft.trim();
    if (value && !isUuid(value)) {
      setRecordError(copy.filters.recordIdInvalid);
      return;
    }
    setRecordError(null);
    if (value !== filters.recordId) updateFilters({ recordId: value });
  };

  const moduleOptions = useMemo(
    () => (filters.module && !options.modules.includes(filters.module) ? [...options.modules, filters.module] : options.modules),
    [options.modules, filters.module],
  );

  const actorName = (userId: string) => {
    const actor = options.actors.find((a) => a.id === userId);
    return actor ? actorLabel(actor, copy.unknownUser) : `${userId.slice(0, 8)}…`;
  };

  const activePreset = PRESETS.find((p) => {
    const range = presetRange(p);
    return range.from === filters.from && range.to === filters.to;
  });

  const chips: { key: keyof AuditFilters | 'range'; label: string; clear: Partial<AuditFilters> }[] = [
    ...(filters.module ? [{ key: 'module' as const, label: `${copy.filters.module}: ${humanizeKey(filters.module)}`, clear: { module: '' } }] : []),
    ...(filters.userId ? [{ key: 'userId' as const, label: `${copy.filters.user}: ${actorName(filters.userId)}`, clear: { userId: '' } }] : []),
    ...(filters.action ? [{ key: 'action' as const, label: `${copy.filters.action}: ${copy.actions[filters.action]}`, clear: { action: '' as const } }] : []),
    ...(filters.recordId ? [{ key: 'recordId' as const, label: `${copy.filters.recordId}: ${filters.recordId.slice(0, 8)}…`, clear: { recordId: '' } }] : []),
    ...(filters.from || filters.to
      ? [{
          key: 'range' as const,
          label: activePreset ? copy.filters.presets[activePreset] : `${filters.from || '…'} → ${filters.to || '…'}`,
          clear: { from: '', to: '' },
        }]
      : []),
  ];

  const filtered = hasActiveFilters(filters);

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-xl font-bold text-primary">{copy.title}</h1>
        <p className="text-sm text-secondary mt-0.5 max-w-3xl">{copy.description}</p>
      </div>

      <Card>
        <CardBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="audit-module">{copy.filters.module}</Label>
              <Select id="audit-module" value={filters.module} onChange={(e) => updateFilters({ module: e.target.value })}>
                <option value="">{copy.filters.allModules}</option>
                {moduleOptions.map((m) => (
                  <option key={m} value={m}>
                    {humanizeKey(m)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="audit-user">{copy.filters.user}</Label>
              <Select id="audit-user" value={filters.userId} onChange={(e) => updateFilters({ userId: e.target.value })}>
                <option value="">{copy.filters.allUsers}</option>
                {filters.userId && !options.actors.some((a) => a.id === filters.userId) && (
                  <option value={filters.userId}>{actorName(filters.userId)}</option>
                )}
                {options.actors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name ? `${a.name}${a.email ? ` (${a.email})` : ''}` : a.email ?? a.id}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="audit-action">{copy.filters.action}</Label>
              <Select
                id="audit-action"
                value={filters.action}
                onChange={(e) => updateFilters({ action: e.target.value as AuditFilters['action'] })}
              >
                <option value="">{copy.filters.allActions}</option>
                {AUDIT_ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {copy.actions[a]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="audit-record">{copy.filters.recordId}</Label>
              <Input
                id="audit-record"
                value={recordDraft}
                onChange={(e) => {
                  setRecordDraft(e.target.value);
                  if (recordError) setRecordError(null);
                }}
                onBlur={applyRecordId}
                onKeyDown={(e) => e.key === 'Enter' && applyRecordId()}
                placeholder={copy.filters.recordIdPlaceholder}
                spellCheck={false}
                aria-invalid={recordError || !recordValid ? true : undefined}
                className={`font-mono text-xs ${recordError || !recordValid ? 'border-error-500 focus:ring-error-500/30' : ''}`}
              />
              <FieldError message={recordError ?? (!recordValid ? copy.filters.recordIdInvalid : undefined)} />
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="grid grid-cols-2 gap-3 lg:w-80">
              <div>
                <Label htmlFor="audit-from">{copy.filters.from}</Label>
                <Input
                  id="audit-from"
                  type="date"
                  value={filters.from}
                  max={filters.to || undefined}
                  onChange={(e) => updateFilters({ from: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="audit-to">{copy.filters.to}</Label>
                <Input
                  id="audit-to"
                  type="date"
                  value={filters.to}
                  min={filters.from || undefined}
                  onChange={(e) => updateFilters({ to: e.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={copy.filters.quickRanges}>
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={activePreset === preset}
                  onClick={() => updateFilters(presetRange(preset))}
                  className={`h-9 rounded-lg border px-3 text-xs font-medium transition-colors ${
                    activePreset === preset
                      ? 'border-accent-500 bg-accent-50 text-accent-700 dark:bg-accent-950/40 dark:text-accent-300'
                      : 'border-base text-secondary hover:bg-[rgb(var(--bg-hover))]'
                  }`}
                >
                  {copy.filters.presets[preset]}
                </button>
              ))}
            </div>
          </div>
          {!rangeValid && <FieldError message={copy.filters.rangeInvalid} />}

          {chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-base pt-3">
              <Filter className="h-3.5 w-3.5 text-muted" />
              {chips.map((chip) => (
                <span
                  key={chip.key}
                  className="inline-flex items-center gap-1 rounded-full border border-base bg-[rgb(var(--bg-muted))] py-0.5 pl-2.5 pr-1 text-xs text-primary"
                >
                  {chip.label}
                  <button
                    type="button"
                    onClick={() => updateFilters(chip.clear)}
                    className="rounded-full p-0.5 text-muted hover:bg-[rgb(var(--bg-hover))] hover:text-primary"
                    aria-label={copy.filters.removeFilter(chip.label)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={() => setSearchParams(filtersToSearchParams({ ...EMPTY_AUDIT_FILTERS, pageSize: filters.pageSize }))}
                className="text-xs font-medium text-accent-600 hover:underline dark:text-accent-300"
              >
                {copy.filters.clear}
              </button>
            </div>
          )}
        </CardBody>
      </Card>

      {optionsError && <p className="text-xs text-warning-700 dark:text-warning-300">{copy.filtersError}</p>}
      {error && <OrgErrorBanner message={error} onRetry={() => void load()} />}

      {!error && (
        <Card>
          <CardBody className="p-0">
            {loading ? (
              <OrgTableSkeleton columns={6} rows={8} />
            ) : entries.length === 0 ? (
              <EmptyState
                icon={ScrollText}
                title={filtered ? copy.noMatchesTitle : copy.emptyTitle}
                description={filtered ? copy.noMatchesDescription : copy.emptyDescription}
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                        {[copy.columns.time, copy.columns.user, copy.columns.action, copy.columns.module, copy.columns.record, copy.columns.changes].map(
                          (heading) => (
                            <th key={heading} className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase text-secondary">
                              {heading}
                            </th>
                          ),
                        )}
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgb(var(--border-base))]">
                      {entries.map((entry) => {
                        const name = actorLabel(entry.actor, copy.unknownUser);
                        return (
                          <tr
                            key={entry.id}
                            onClick={() => setSelected(entry)}
                            className="cursor-pointer hover:bg-[rgb(var(--bg-hover))]"
                          >
                            <td className="whitespace-nowrap px-4 py-3">
                              <div className="text-primary">{formatAuditTimestamp(entry.createdAt)}</div>
                              <div className="text-xs text-muted">{formatRelativeTime(entry.createdAt)}</div>
                            </td>
                            <td className="px-4 py-3 min-w-[160px]">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateFilters({ userId: entry.actor.id });
                                }}
                                className="text-left hover:underline"
                                title={copy.filterByUser(name)}
                              >
                                <div className={entry.actor.name || entry.actor.email ? 'text-primary' : 'italic text-muted'}>{name}</div>
                                {entry.actor.name && entry.actor.email && (
                                  <div className="text-xs text-muted">{entry.actor.email}</div>
                                )}
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <Badge tone={auditActionTone[entry.action]} dot>
                                {copy.actions[entry.action]}
                              </Badge>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-secondary">{humanizeKey(entry.module)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-0.5">
                                <span className="font-mono text-xs text-secondary" title={entry.recordId}>
                                  {entry.recordId.slice(0, 8)}…
                                </span>
                                <CopyIdButton value={entry.recordId} />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateFilters({ recordId: entry.recordId });
                                  }}
                                  className="rounded p-1 text-muted hover:bg-[rgb(var(--bg-hover))] hover:text-primary"
                                  aria-label={copy.filterByRecord}
                                  title={copy.filterByRecord}
                                >
                                  <History className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-secondary">{changeSummary(entry)}</td>
                            <td className="pr-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelected(entry);
                                }}
                                className="rounded p-1 text-muted hover:bg-[rgb(var(--bg-hover))] hover:text-primary"
                                aria-label={copy.viewDetails}
                              >
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={filters.page}
                  pageSize={filters.pageSize}
                  totalItems={total}
                  pageSizeOptions={AUDIT_PAGE_SIZES}
                  onPageChange={(page) => updateFilters({ page })}
                  onPageSizeChange={(pageSize) => updateFilters({ pageSize })}
                />
              </>
            )}
          </CardBody>
        </Card>
      )}

      {selected && (
        <AuditEntryDetail
          key={selected.id}
          entry={selected}
          onClose={() => setSelected(null)}
          onShowRecordHistory={(recordId) => {
            setSelected(null);
            updateFilters({ recordId });
          }}
        />
      )}
    </div>
  );
}

export function AuditLogPage() {
  const canView = usePermission('audit', 'view');
  if (!canView) {
    return (
      <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
        <EmptyState icon={Lock} title={copy.noAccessTitle} description={copy.noAccessDescription} />
      </div>
    );
  }
  return <AuditLogContent />;
}
