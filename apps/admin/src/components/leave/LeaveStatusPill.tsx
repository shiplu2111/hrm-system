import { LEAVE_REQUEST_STATUS_META, type LeaveRequestStatus } from '@hrm/shared-types';
import { StatusPill } from '@/components/ui/StatusPill';

export function LeaveStatusPill({ status }: { status: LeaveRequestStatus }) {
  const meta = LEAVE_REQUEST_STATUS_META[status];
  return <StatusPill tone={meta.tone}>{meta.label}</StatusPill>;
}
