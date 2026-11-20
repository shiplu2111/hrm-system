import type {
  ContractorInvoiceRecord,
  ContractorInvoiceStatus,
  ContractorKind,
} from '@hrm/shared-types';

export const INVOICE_STATUS_TONE: Record<
  ContractorInvoiceStatus,
  'neutral' | 'accent' | 'success' | 'warning' | 'error' | 'info'
> = {
  draft: 'neutral',
  submitted: 'warning',
  approved: 'info',
  scheduled: 'accent',
  paid: 'success',
  rejected: 'error',
  cancelled: 'neutral',
};

export const CONTRACTOR_KIND_BADGE_CLASSES: Record<ContractorKind, string> = {
  freelancer:
    'border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-800/70 dark:bg-teal-950/50 dark:text-teal-300',
  consultant:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/70 dark:bg-amber-950/50 dark:text-amber-300',
  vendor:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/70 dark:bg-emerald-950/50 dark:text-emerald-300',
};

export const AP_PRIMARY_BUTTON_CLASS =
  'bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white focus-visible:ring-teal-500/40';

export const AP_LEDGER_CARD_CLASS =
  'border-teal-200/80 dark:border-teal-900/60 border-t-2 border-t-teal-600';

export function formatContractorDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatContractorMoney(amount: string | number, currency = 'AUD'): string {
  const numeric = typeof amount === 'number' ? amount : Number(amount);
  if (Number.isNaN(numeric)) return `${currency} ${amount}`;
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(numeric);
}

/** Multiplies two non-negative decimal strings using scaled integers (avoids float drift). */
export function computeHoursAmount(hoursWorked: string, hourlyRate: string): string {
  const cleanHours = hoursWorked.trim();
  const cleanRate = hourlyRate.trim();
  if (!/^\d+(\.\d{1,4})?$/.test(cleanHours) || !/^\d+(\.\d{1,4})?$/.test(cleanRate)) {
    return '';
  }

  const [hInt, hFrac = ''] = cleanHours.split('.');
  const [rInt, rFrac = ''] = cleanRate.split('.');
  const hoursScaled = BigInt(hInt + hFrac.padEnd(2, '0').slice(0, 2));
  const rateScaled = BigInt(rInt + rFrac.padEnd(2, '0').slice(0, 2));
  const totalHundredths = hoursScaled * rateScaled;
  // totalHundredths is in 10^-4 units; round half-up to 10^-2 cents
  const cents = (totalHundredths + 50n) / 100n;
  const whole = cents / 100n;
  const rem = cents % 100n;
  return `${whole.toString()}.${rem.toString().padStart(2, '0')}`;
}

export function sumMoneyStrings(values: string[]): string {
  let cents = 0n;
  for (const raw of values) {
    const clean = raw.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(clean)) continue;
    const [whole, frac = ''] = clean.split('.');
    cents += BigInt(whole) * 100n + BigInt(frac.padEnd(2, '0').slice(0, 2));
  }
  const whole = cents / 100n;
  const rem = cents % 100n;
  return `${whole.toString()}.${rem.toString().padStart(2, '0')}`;
}

export function isInvoiceOverdue(invoice: ContractorInvoiceRecord): boolean {
  if (['paid', 'rejected', 'cancelled'].includes(invoice.status)) {
    return false;
  }
  const due = new Date(invoice.dueAt);
  if (Number.isNaN(due.getTime())) return false;
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  return due.getTime() < todayStart.getTime();
}

