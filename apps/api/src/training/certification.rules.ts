import { BadRequestException } from '@nestjs/common';
import type { CertificationExpiryState, EmployeeCertificationStatus } from '@hrm/shared-types';
import { CERTIFICATION_EXPIRY_WARNING_DAYS, startOfUtcDay } from './training.utils';

const DAY_MS = 24 * 60 * 60 * 1000;

function reject(code: string, message: string): never {
  throw new BadRequestException({ code, message });
}

/** Parses a `YYYY-MM-DD` date as UTC midnight. */
export function parseDateOnly(value: string, field: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
  if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    reject('VALIDATION_ERROR', `${field} must be a valid date (YYYY-MM-DD)`);
  }
  return date;
}

export function assertCertificationDates(
  issuedAt: Date | null,
  expiryDate: Date | null,
  today: Date,
): void {
  if (issuedAt && startOfUtcDay(issuedAt) > startOfUtcDay(today)) {
    reject('VALIDATION_ERROR', 'The issue date can’t be in the future');
  }
  if (issuedAt && expiryDate && startOfUtcDay(expiryDate) <= startOfUtcDay(issuedAt)) {
    reject('VALIDATION_ERROR', 'The expiry date must be after the issue date');
  }
}

export function assertNotFuture(date: Date | null, today: Date, label: string): void {
  if (date && startOfUtcDay(date) > startOfUtcDay(today)) {
    reject('VALIDATION_ERROR', `${label} can’t be in the future`);
  }
}

/** Whole days from today to the expiry date; negative once expired. */
export function signedDaysUntil(today: Date, expiryDate: Date): number {
  return Math.round((startOfUtcDay(expiryDate).getTime() - startOfUtcDay(today).getTime()) / DAY_MS);
}

/** A certificate is valid through its expiry date and expired from the day after. */
export function certificationExpiryState(
  storedStatus: EmployeeCertificationStatus,
  expiryDate: Date | null,
  today: Date,
): CertificationExpiryState {
  if (storedStatus === 'revoked') return 'revoked';
  if (!expiryDate) return 'no_expiry';
  const days = signedDaysUntil(today, expiryDate);
  if (days < 0) return 'expired';
  if (days <= CERTIFICATION_EXPIRY_WARNING_DAYS) return 'expiring_soon';
  return 'valid';
}

export function normalizeCertificationName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export interface CertificationForRanking {
  id: string;
  employeeId: string;
  name: string;
  status: EmployeeCertificationStatus;
  issuedAt: Date | null;
  expiryDate: Date | null;
  createdAt: Date;
}

function rankKey(row: CertificationForRanking): [number, number, number] {
  return [
    row.expiryDate ? row.expiryDate.getTime() : Number.POSITIVE_INFINITY,
    row.issuedAt?.getTime() ?? 0,
    row.createdAt.getTime(),
  ];
}

function newer(a: CertificationForRanking, b: CertificationForRanking): boolean {
  const [ka, kb] = [rankKey(a), rankKey(b)];
  for (let i = 0; i < ka.length; i += 1) {
    if (ka[i] !== kb[i]) return ka[i] > kb[i];
  }
  return a.id > b.id;
}

/**
 * For each employee and certificate name, the non-revoked certificate that runs longest is current;
 * older ones are superseded by it (renewals keep their history).
 */
export function supersededBy(rows: CertificationForRanking[]): Map<string, string> {
  const current = new Map<string, CertificationForRanking>();
  for (const row of rows) {
    if (row.status === 'revoked') continue;
    const key = `${row.employeeId}|${normalizeCertificationName(row.name)}`;
    const best = current.get(key);
    if (!best || newer(row, best)) current.set(key, row);
  }
  const result = new Map<string, string>();
  for (const row of rows) {
    if (row.status === 'revoked') continue;
    const best = current.get(`${row.employeeId}|${normalizeCertificationName(row.name)}`);
    if (best && best.id !== row.id) result.set(row.id, best.id);
  }
  return result;
}
