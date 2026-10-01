import type { LeaveApprovalStep, LeaveRequestRecord } from '@hrm/shared-types';
import { leaveApproverLabel } from '@hrm/shared-types';
import { formatDays, formatIsoDate } from '@/lib/leave-policy';

function parseIso(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00`);
}

/** "Mon, Oct 5, 2026" for one day, "Oct 5 – Oct 7, 2026" for a range. */
export function formatLeaveDates(start: string, end: string): string {
  const from = parseIso(start);
  const to = parseIso(end);
  if (start === end) {
    return from.toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
  const sameYear = from.getFullYear() === to.getFullYear();
  const startLabel = from.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  return `${startLabel} – ${formatIsoDate(end)}`;
}

export function formatLeaveLength(request: Pick<LeaveRequestRecord, 'totalDays' | 'halfDay'>): string {
  return request.halfDay ? 'Half day' : formatDays(request.totalDays);
}

export function formatRelativeTime(iso: string, now = Date.now()): string {
  const seconds = Math.round((now - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatIsoDate(iso);
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Whole days from today until `date` (negative when in the past). */
export function daysUntil(date: string, today = new Date()): number {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((parseIso(date).getTime() - start.getTime()) / 86_400_000);
}

export interface ApprovalProgress {
  current: LeaveApprovalStep | null;
  /** 1-based position of the current step */
  position: number;
  total: number;
  approved: number;
}

export function approvalProgress(chain: LeaveApprovalStep[]): ApprovalProgress {
  const index = chain.findIndex((step) => step.status === 'pending');
  return {
    current: index >= 0 ? chain[index] : null,
    position: index >= 0 ? index + 1 : chain.length,
    total: chain.length,
    approved: chain.filter((step) => step.status === 'approved' || step.status === 'skipped').length,
  };
}

export function currentStepLabel(chain: LeaveApprovalStep[]): string | null {
  const { current, position, total } = approvalProgress(chain);
  if (!current) return null;
  return `Step ${position} of ${total} · ${leaveApproverLabel(current.roleName)}`;
}
