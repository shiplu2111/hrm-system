import type { AccountingConnectionStatus } from '@hrm/shared-types';
import { StatusPill } from '@/components/ui/StatusPill';
import { CONNECTION_STATUS_DISPLAY } from '@/lib/accounting-display';

export function ConnectionStatusPill({
  status,
  className,
}: {
  status: AccountingConnectionStatus;
  className?: string;
}) {
  const { tone, label } = CONNECTION_STATUS_DISPLAY[status];
  return (
    <StatusPill tone={tone} className={className}>
      {label}
    </StatusPill>
  );
}
