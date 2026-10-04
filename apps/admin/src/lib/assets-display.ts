import type { AssetStatus } from '@hrm/shared-types';

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'error' | 'info';

export const ASSET_STATUS_META: Record<AssetStatus, { label: string; tone: BadgeTone }> = {
  available: { label: 'Available', tone: 'success' },
  assigned: { label: 'Assigned', tone: 'accent' },
  in_repair: { label: 'In repair', tone: 'warning' },
  retired: { label: 'Retired', tone: 'neutral' },
};

function toLocalIsoDate(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function todayIsoDate(): string {
  return toLocalIsoDate(new Date());
}

/** Formats a `YYYY-MM-DD` date or ISO timestamp as e.g. "4 Oct 2026". */
export function formatAssetDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatAssetValue(value: string | null, currency: string): string {
  if (value == null) return '—';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(value));
  } catch {
    return `${currency} ${value}`;
  }
}

export type WarrantyState = 'none' | 'expired' | 'expiring' | 'ok';

/** "Expiring" = within the next 60 days. */
export function warrantyState(expiry: string | null): WarrantyState {
  if (!expiry) return 'none';
  const today = todayIsoDate();
  if (expiry < today) return 'expired';
  const soon = new Date(`${today}T00:00:00`);
  soon.setDate(soon.getDate() + 60);
  return expiry <= toLocalIsoDate(soon) ? 'expiring' : 'ok';
}
