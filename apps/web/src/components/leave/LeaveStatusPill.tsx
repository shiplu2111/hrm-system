import { LEAVE_REQUEST_STATUS_META, type LeaveRequestStatus } from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { StatusPill } from '@hrm/portal-ui';

export function LeaveStatusPill({ status }: { status: LeaveRequestStatus }) {
  const { t } = useAppTranslation();
  const meta = LEAVE_REQUEST_STATUS_META[status] ?? LEAVE_REQUEST_STATUS_META.pending;
  return (
    <StatusPill tone={meta.tone}>
      {t(`leave.status.${status}`, { defaultValue: meta.label })}
    </StatusPill>
  );
}
