import { BadRequestException } from '@nestjs/common';
import type { HrCaseStatus } from '@hrm/shared-types';

/** Allowed HR case status transitions (MODULES.md §28). */
export const HR_CASE_STATUS_TRANSITIONS: Record<
  HrCaseStatus,
  readonly HrCaseStatus[]
> = {
  open: ['investigating'],
  investigating: ['resolved', 'open'],
  resolved: ['closed', 'investigating'],
  closed: [],
};

export function assertHrCaseStatusTransition(
  from: HrCaseStatus,
  to: HrCaseStatus,
): void {
  if (from === to) return;
  const allowed = HR_CASE_STATUS_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new BadRequestException({
      code: 'INVALID_TRANSITION',
      message: `Cannot transition HR case from "${from}" to "${to}"`,
    });
  }
}

export function isHrCaseTerminal(status: HrCaseStatus): boolean {
  return status === 'closed';
}
