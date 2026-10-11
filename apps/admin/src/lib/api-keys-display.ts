import {
  API_ACCESS_SCOPE_PERMISSIONS,
  type ApiAccessScope,
  type PermissionAction,
  type TenantApiKeyRecord,
} from '@hrm/shared-types';
import type { StatusPillTone } from '@/components/ui/StatusPill';

export type AreaAccess = 'none' | 'read' | 'write';

export interface ScopeArea {
  key: string;
  label: string;
  description: string;
  read: ApiAccessScope;
  write: ApiAccessScope;
}

export const SCOPE_AREAS: ScopeArea[] = [
  {
    key: 'employees',
    label: 'Employees',
    description: 'Employee records, profiles and employee reports',
    read: 'read:employees',
    write: 'write:employees',
  },
  {
    key: 'attendance',
    label: 'Attendance',
    description: 'Clock-ins, attendance records and attendance reports',
    read: 'read:attendance',
    write: 'write:attendance',
  },
  {
    key: 'leave',
    label: 'Leave',
    description: 'Leave requests and balances',
    read: 'read:leave',
    write: 'write:leave',
  },
  {
    key: 'payroll',
    label: 'Payroll',
    description: 'Pay runs, payslips and payroll reports',
    read: 'read:payroll',
    write: 'write:payroll',
  },
];

export const AREA_ACCESS_LABELS: Record<AreaAccess, string> = {
  none: 'No access',
  read: 'Read',
  write: 'Read & write',
};

export function areaAccess(area: ScopeArea, scopes: readonly ApiAccessScope[]): AreaAccess {
  if (scopes.includes(area.write)) return 'write';
  if (scopes.includes(area.read)) return 'read';
  return 'none';
}

export function scopesFromAccess(access: Record<string, AreaAccess>): ApiAccessScope[] {
  return SCOPE_AREAS.flatMap((area) => {
    const level = access[area.key] ?? 'none';
    if (level === 'write') return [area.read, area.write];
    if (level === 'read') return [area.read];
    return [];
  });
}

/** Mirrors the API rule: a user can only grant what their own role allows. */
export function canGrantScope(
  scope: ApiAccessScope,
  can: (module: string, action: PermissionAction) => boolean,
): boolean {
  return API_ACCESS_SCOPE_PERMISSIONS[scope].every((p) => can(p.module, p.action));
}

export type KeyState = 'active' | 'expiring' | 'expired' | 'revoked' | 'paused';

const EXPIRING_SOON_MS = 14 * 24 * 60 * 60 * 1000;

export function keyState(key: TenantApiKeyRecord, apiAccessEnabled: boolean, now = Date.now()): KeyState {
  if (key.status === 'revoked') return 'revoked';
  const expiresAt = key.expiresAt ? new Date(key.expiresAt).getTime() : null;
  if (expiresAt !== null && expiresAt <= now) return 'expired';
  if (!apiAccessEnabled) return 'paused';
  if (expiresAt !== null && expiresAt - now <= EXPIRING_SOON_MS) return 'expiring';
  return 'active';
}

export const KEY_STATE_DISPLAY: Record<KeyState, { tone: StatusPillTone; label: string }> = {
  active: { tone: 'success', label: 'Active' },
  expiring: { tone: 'warning', label: 'Expiring soon' },
  expired: { tone: 'neutral', label: 'Expired' },
  revoked: { tone: 'neutral', label: 'Revoked' },
  paused: { tone: 'warning', label: 'Paused — plan' },
};

export function isUsableState(state: KeyState): boolean {
  return state === 'active' || state === 'expiring' || state === 'paused';
}

export const EXPIRY_OPTIONS = [
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '1 year' },
  { value: 'never', label: 'No expiry' },
] as const;

export type ExpiryOption = (typeof EXPIRY_OPTIONS)[number]['value'];

export function expiryDate(option: ExpiryOption, from = new Date()): Date | null {
  if (option === 'never') return null;
  const date = new Date(from);
  date.setDate(date.getDate() + Number(option));
  return date;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatLastUsed(value: string | null, now = Date.now()): string {
  if (!value) return 'Never used';
  const minutes = Math.floor((now - new Date(value).getTime()) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(value);
}

/** Absolute API base for copyable examples; the admin app may call it through a relative proxy path. */
export function apiBaseUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
  return new URL(base, window.location.origin).toString().replace(/\/$/, '');
}
