import type { AuditLogAction } from '@hrm/shared-types';

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'error' | 'info';

export const auditActionTone = {
  create: 'success',
  update: 'accent',
  delete: 'error',
  approve: 'success',
  finalize: 'info',
  reject: 'error',
  suspend: 'warning',
  restore: 'info',
} satisfies Record<AuditLogAction, Tone>;
