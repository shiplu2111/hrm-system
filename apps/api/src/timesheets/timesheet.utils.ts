import type {
  TimesheetEntryStatus,
  WorkflowInstanceRecord,
} from '@hrm/shared-types';
import { getCurrentWorkflowStep } from '../workflow/workflow.utils';

export const DEFAULT_TIMESHEET_APPROVAL_STEPS = [
  { roleName: 'Manager' },
] as const;

export function computeTimesheetHours(
  startTime: Date,
  endTime: Date,
  breakMinutes: number,
): number {
  const rawMs =
    endTime.getTime() - startTime.getTime() - breakMinutes * 60 * 1000;
  const hours = rawMs / 3_600_000;
  return Math.max(0, Math.round(hours * 100) / 100);
}

export function splitBillableHours(
  totalHours: number,
  isBillable: boolean,
): { billableHours: number; nonBillableHours: number } {
  if (isBillable) {
    return { billableHours: totalHours, nonBillableHours: 0 };
  }
  return { billableHours: 0, nonBillableHours: totalHours };
}

export function formatDateValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseDateString(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) {
    throw new Error(`Invalid date "${value}", expected YYYY-MM-DD`);
  }
  return new Date(Date.UTC(year, month - 1, day));
}

export function parseIsoDateTime(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid datetime "${value}"`);
  }
  return parsed;
}

export function resolveTimesheetDisplayStatus(input: {
  status: TimesheetEntryStatus;
  workflow: WorkflowInstanceRecord | null;
}): string {
  const { status, workflow } = input;
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'draft') return 'Draft';

  const step = workflow ? getCurrentWorkflowStep(workflow.steps) : null;
  if (!step) return 'Pending Approval';
  if (step.assigneeType === 'direct_manager' || step.roleName === 'Manager') {
    return 'Pending Manager';
  }
  return `Pending ${step.roleName}`;
}
