/** Employee lifecycle event types (MODULES.md §05) */

import type { PermissionAction } from './common';
import type { EmploymentStatus } from './employee';

export type LifecycleEventType =
  | 'promotion'
  | 'transfer'
  | 'salary_revision'
  | 'probation'
  | 'confirmation'
  | 'suspension'
  | 'resignation'
  | 'termination'
  | 'rehire'
  | 'performance_review';

export interface LifecycleEventRecord {
  id: string;
  employeeId: string;
  eventType: LifecycleEventType;
  effectiveDate: string;
  details: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLifecycleEventInput {
  eventType: LifecycleEventType;
  effectiveDate: string;
  details: Record<string, unknown>;
}

/** Holds full access within the tenant (ROLES_PERMISSIONS.md §1). */
export const LIFECYCLE_FULL_ACCESS_ROLE = 'Company Owner';

export interface LifecycleActionPolicy {
  /** Roles allowed to record the event, in addition to Company Owner. */
  roles: readonly string[];
  /** Every permission listed must be held by the actor's role. */
  permissions: readonly { module: string; action: PermissionAction }[];
}

/**
 * Who may record each lifecycle event through the API (ROLES_PERMISSIONS.md §1–§3).
 * performance_review is written by the performance module, never directly by a user.
 */
export const LIFECYCLE_ACTION_POLICY: Record<LifecycleEventType, LifecycleActionPolicy> = {
  promotion: { roles: ['HR Admin'], permissions: [{ module: 'employee', action: 'edit' }] },
  transfer: { roles: ['HR Admin'], permissions: [{ module: 'employee', action: 'edit' }] },
  salary_revision: {
    roles: ['HR Admin', 'Payroll Admin'],
    permissions: [
      { module: 'employee', action: 'view' },
      { module: 'payroll', action: 'edit' },
    ],
  },
  probation: { roles: ['HR Admin'], permissions: [{ module: 'employee', action: 'edit' }] },
  confirmation: { roles: ['HR Admin'], permissions: [{ module: 'employee', action: 'edit' }] },
  suspension: { roles: ['HR Admin'], permissions: [{ module: 'employee', action: 'edit' }] },
  resignation: { roles: ['HR Admin'], permissions: [{ module: 'employee', action: 'edit' }] },
  termination: { roles: ['HR Admin'], permissions: [{ module: 'employee', action: 'edit' }] },
  rehire: {
    roles: ['HR Admin'],
    permissions: [
      { module: 'employee', action: 'create' },
      { module: 'employee', action: 'edit' },
    ],
  },
  performance_review: { roles: [], permissions: [{ module: 'performance', action: 'approve' }] },
};

export interface LifecycleActor {
  roleName: string;
  employeeId: string | null;
  permissions: readonly { module: string; action: string }[];
}

export type LifecycleActionDecision =
  | { allowed: true }
  | { allowed: false; reason: 'role' | 'permission' | 'self' | 'status'; message: string };

const EVENT_NOUNS: Record<LifecycleEventType, string> = {
  promotion: 'promotions',
  transfer: 'transfers',
  salary_revision: 'salary revisions',
  probation: 'probation changes',
  confirmation: 'confirmations',
  suspension: 'suspensions',
  resignation: 'resignations',
  termination: 'terminations',
  rehire: 'rehires',
  performance_review: 'performance review outcomes',
};

function allowedRolesLabel(roles: readonly string[]): string {
  const all = [...roles, LIFECYCLE_FULL_ACCESS_ROLE];
  if (all.length === 1) return all[0];
  return `${all.slice(0, -1).join(', ')} or ${all[all.length - 1]}`;
}

/** Returns why an event can't be recorded for an employee in their current status, if it can't. */
export function lifecycleStatusBlock(
  eventType: LifecycleEventType,
  status: EmploymentStatus,
): string | null {
  if (eventType === 'rehire') {
    return status === 'terminated' ? null : 'Only terminated employees can be rehired.';
  }
  if (status === 'terminated') {
    return 'This employee has left the company. Rehire them before recording other events.';
  }
  if (eventType === 'suspension' && status === 'inactive') {
    return 'This employee is already inactive.';
  }
  return null;
}

/**
 * Shared by the API (enforcement) and the admin UI (gating) so both agree on who can act.
 * Set `enforceRoles: false` for API-key / OAuth callers, which are limited by scopes only.
 */
export function evaluateLifecycleAction(
  actor: LifecycleActor,
  eventType: LifecycleEventType,
  target?: { employeeId: string; employmentStatus?: EmploymentStatus },
  options: { enforceRoles?: boolean } = {},
): LifecycleActionDecision {
  const policy = LIFECYCLE_ACTION_POLICY[eventType];
  const enforceRoles = options.enforceRoles ?? true;
  const isFullAccess = actor.roleName === LIFECYCLE_FULL_ACCESS_ROLE;

  if (enforceRoles && !isFullAccess && !policy.roles.includes(actor.roleName)) {
    return {
      allowed: false,
      reason: 'role',
      message: `Only ${allowedRolesLabel(policy.roles)} can record ${EVENT_NOUNS[eventType]}.`,
    };
  }

  const missing = policy.permissions.find(
    (required) =>
      !actor.permissions.some(
        (p) => p.module === required.module && p.action === required.action,
      ),
  );
  if (missing) {
    return {
      allowed: false,
      reason: 'permission',
      message: `Your role is missing the ${missing.module}:${missing.action} permission.`,
    };
  }

  if (target && actor.employeeId && actor.employeeId === target.employeeId) {
    return {
      allowed: false,
      reason: 'self',
      message: 'You cannot record lifecycle events on your own employee record.',
    };
  }

  if (target?.employmentStatus) {
    const block = lifecycleStatusBlock(eventType, target.employmentStatus);
    if (block) return { allowed: false, reason: 'status', message: block };
  }

  return { allowed: true };
}
