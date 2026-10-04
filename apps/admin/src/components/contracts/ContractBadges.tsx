import type { EmploymentContractDisplayStatus, EmploymentContractType } from '@hrm/shared-types';
import { Badge } from '@/components/ui/Badge';
import { CONTRACT_TYPE_LABELS, DISPLAY_STATUS_LABELS } from '@/lib/contracts-api';

const STATUS_TONE: Record<EmploymentContractDisplayStatus, 'success' | 'warning' | 'error' | 'neutral' | 'info'> = {
  active: 'success',
  expiring_soon: 'warning',
  expired: 'error',
  draft: 'neutral',
  pending_approval: 'info',
  terminated: 'neutral',
};

const TYPE_TONE: Record<EmploymentContractType, 'accent' | 'warning' | 'info' | 'neutral'> = {
  permanent: 'accent',
  fixed_term: 'warning',
  casual: 'info',
  project_based: 'neutral',
};

export function ContractStatusBadge({ status }: { status: EmploymentContractDisplayStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} dot>
      {DISPLAY_STATUS_LABELS[status]}
    </Badge>
  );
}

export function ContractTypeBadge({ type }: { type: EmploymentContractType }) {
  return <Badge tone={TYPE_TONE[type]}>{CONTRACT_TYPE_LABELS[type]}</Badge>;
}
