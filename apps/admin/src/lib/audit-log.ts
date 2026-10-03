import type { AuditLogAction, AuditLogEntry, AuditLogQuery } from '@hrm/shared-types';

export const AUDIT_ACTIONS: readonly AuditLogAction[] = [
  'create',
  'update',
  'delete',
  'approve',
  'finalize',
  'reject',
  'suspend',
  'restore',
];

export const AUDIT_PAGE_SIZES = [25, 50, 100];
export const DEFAULT_AUDIT_PAGE_SIZE = 25;

/** Filter state as kept in the URL, so a filtered view can be shared during a review. */
export interface AuditFilters {
  module: string;
  userId: string;
  action: AuditLogAction | '';
  recordId: string;
  /** Local calendar dates, YYYY-MM-DD. */
  from: string;
  to: string;
  page: number;
  pageSize: number;
}

export const EMPTY_AUDIT_FILTERS: AuditFilters = {
  module: '',
  userId: '',
  action: '',
  recordId: '',
  from: '',
  to: '',
  page: 1,
  pageSize: DEFAULT_AUDIT_PAGE_SIZE,
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

function positiveInt(raw: string | null, fallback: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export function filtersFromSearchParams(params: URLSearchParams): AuditFilters {
  const action = params.get('action') ?? '';
  const pageSize = positiveInt(params.get('pageSize'), DEFAULT_AUDIT_PAGE_SIZE);
  const date = (key: string) => {
    const value = params.get(key) ?? '';
    return DATE_RE.test(value) ? value : '';
  };
  return {
    module: params.get('module') ?? '',
    userId: params.get('user') ?? '',
    action: (AUDIT_ACTIONS as readonly string[]).includes(action) ? (action as AuditLogAction) : '',
    recordId: params.get('record') ?? '',
    from: date('from'),
    to: date('to'),
    page: positiveInt(params.get('page'), 1),
    pageSize: AUDIT_PAGE_SIZES.includes(pageSize) ? pageSize : DEFAULT_AUDIT_PAGE_SIZE,
  };
}

export function filtersToSearchParams(filters: AuditFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.module) params.set('module', filters.module);
  if (filters.userId) params.set('user', filters.userId);
  if (filters.action) params.set('action', filters.action);
  if (filters.recordId) params.set('record', filters.recordId);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.page > 1) params.set('page', String(filters.page));
  if (filters.pageSize !== DEFAULT_AUDIT_PAGE_SIZE) params.set('pageSize', String(filters.pageSize));
  return params;
}

export function hasActiveFilters(filters: AuditFilters): boolean {
  return Boolean(
    filters.module || filters.userId || filters.action || filters.recordId || filters.from || filters.to,
  );
}

function localDayStart(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isDateRangeValid(from: string, to: string): boolean {
  return !from || !to || from <= to;
}

/**
 * API query for the current filters. Dates are whole local days: `from` is inclusive from
 * local midnight and `to` covers the entire day, sent as an exclusive bound on the next midnight.
 */
export function filtersToQuery(filters: AuditFilters): AuditLogQuery {
  const query: AuditLogQuery = { page: filters.page, pageSize: filters.pageSize };
  if (filters.module) query.module = filters.module;
  if (filters.userId) query.userId = filters.userId;
  if (filters.action) query.action = filters.action;
  if (filters.recordId && isUuid(filters.recordId)) query.recordId = filters.recordId.trim();
  if (filters.from) query.from = localDayStart(filters.from).toISOString();
  if (filters.to) {
    const end = localDayStart(filters.to);
    end.setDate(end.getDate() + 1);
    query.to = end.toISOString();
  }
  return query;
}

export type DateRangePreset = 'today' | '7d' | '30d' | '90d';

function toDateInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function presetRange(preset: DateRangePreset, today = new Date()): { from: string; to: string } {
  const days = { today: 0, '7d': 6, '30d': 29, '90d': 89 }[preset];
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
  return { from: toDateInput(start), to: toDateInput(today) };
}

/** `employee_relations` → `Employee relations`. */
export function humanizeKey(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function actorLabel(actor: AuditLogEntry['actor'], fallback: string): string {
  return actor.name ?? actor.email ?? fallback;
}

export type FieldChangeKind = 'added' | 'removed' | 'changed' | 'unchanged';

export interface FieldChange {
  key: string;
  before: unknown;
  after: unknown;
  kind: FieldChangeKind;
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Field-by-field comparison of an entry's stored before/after values, changes first. */
export function diffAuditValues(entry: Pick<AuditLogEntry, 'oldValue' | 'newValue'>): FieldChange[] {
  const before = entry.oldValue ?? {};
  const after = entry.newValue ?? {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const order: Record<FieldChangeKind, number> = { changed: 0, added: 1, removed: 2, unchanged: 3 };

  return keys
    .map((key): FieldChange => {
      const inBefore = key in before;
      const inAfter = key in after;
      const kind: FieldChangeKind =
        inBefore && inAfter
          ? sameValue(before[key], after[key])
            ? 'unchanged'
            : 'changed'
          : inAfter
            ? 'added'
            : 'removed';
      return { key, before: before[key], after: after[key], kind };
    })
    .sort((a, b) => order[a.kind] - order[b.kind] || a.key.localeCompare(b.key));
}

/** Number of fields that actually differ, for the list summary. */
export function countChangedFields(entry: Pick<AuditLogEntry, 'oldValue' | 'newValue'>): number {
  return diffAuditValues(entry).filter((c) => c.kind !== 'unchanged').length;
}

export function formatAuditValue(value: unknown, empty: string): string {
  if (value === null || value === undefined || value === '') return empty;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return JSON.stringify(value, null, 2);
}

export function formatAuditTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}
