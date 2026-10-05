import type {
  GlAccountRecord,
  GlAccountType,
  GlExportDestination,
  GlExportStatusRecord,
  GlPayrollMappingRecord,
  GlSystemMappingKey,
} from '@hrm/shared-types';
import { GL_SYSTEM_MAPPING_LABELS } from '@hrm/shared-types';
import type { StatusPillTone } from '@/components/ui/StatusPill';

export const GL_ACCOUNT_TYPE_LABELS: Record<GlAccountType, string> = {
  asset: 'Asset',
  liability: 'Liability',
  equity: 'Equity',
  revenue: 'Revenue',
  expense: 'Expense',
};

export const GL_ACCOUNT_TYPE_ORDER: GlAccountType[] = [
  'expense',
  'liability',
  'asset',
  'equity',
  'revenue',
];

export type MappingGroup = 'earning' | 'deduction' | 'system';

export function mappingKey(row: GlPayrollMappingRecord): string {
  return row.payComponentId ? `component:${row.payComponentId}` : `system:${row.systemKey}`;
}

export function mappingGroup(row: GlPayrollMappingRecord): MappingGroup {
  if (row.systemKey) return 'system';
  if (row.payComponentType) return row.payComponentType;
  return row.postingSide === 'debit' ? 'earning' : 'deduction';
}

export function mappingSourceLabel(row: GlPayrollMappingRecord): string {
  if (row.payComponentName) return row.payComponentName;
  if (row.systemKey) return GL_SYSTEM_MAPPING_LABELS[row.systemKey as GlSystemMappingKey];
  return 'Unknown source';
}

/** The account type a payroll source normally posts to. */
export function expectedAccountType(row: GlPayrollMappingRecord): GlAccountType {
  if (row.systemKey === 'employer_superannuation_expense') return 'expense';
  if (row.systemKey) return 'liability';
  return mappingGroup(row) === 'earning' ? 'expense' : 'liability';
}

export function accountTypeHint(
  row: GlPayrollMappingRecord,
  account: GlAccountRecord | undefined,
): string | null {
  if (!account) return null;
  const expected = expectedAccountType(row);
  if (account.accountType === expected) return null;
  const what =
    mappingGroup(row) === 'earning'
      ? 'Earnings'
      : mappingGroup(row) === 'deduction'
        ? 'Deductions'
        : 'This line';
  return `${what} usually post to ${withArticle(expected)} account — ${account.code} is ${withArticle(account.accountType)} account.`;
}

function withArticle(type: GlAccountType): string {
  const label = GL_ACCOUNT_TYPE_LABELS[type].toLowerCase();
  return /^[aeiou]/.test(label) ? `an ${label}` : `a ${label}`;
}

export function accountOptionLabel(account: Pick<GlAccountRecord, 'code' | 'name'>): string {
  return `${account.code} · ${account.name}`;
}

export const GL_DESTINATION_LABELS: Record<GlExportDestination, string> = {
  csv: 'CSV file',
  xero: 'Xero',
  quickbooks: 'QuickBooks',
  tally: 'Tally',
};

export function exportOutcomeDisplay(row: GlExportStatusRecord): {
  tone: StatusPillTone;
  label: string;
} {
  if (row.outcome === 'succeeded') return { tone: 'success', label: 'Succeeded' };
  if (row.outcome === 'in_progress') {
    return {
      tone: 'accent',
      label: row.destination === 'csv' ? 'In progress' : 'Syncing',
    };
  }
  return { tone: 'error', label: 'Failed' };
}

export function exportedByText(row: GlExportStatusRecord): string {
  if (row.automatic) {
    return row.exportedByName
      ? `Automatic, after ${row.exportedByName} finalized payroll`
      : 'Automatic, after payroll finalization';
  }
  return row.exportedByName ? `By ${row.exportedByName}` : 'By a user';
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
