import type {
  EmployeeOffboardingRecord,
  EmployeeOffboardingTaskRecord,
  ExitInterviewRatings,
  ExitInterviewRecord,
  ExitInterviewStatus,
  ExitReasonCategory,
  OffboardingChecklistTemplateItemRecord,
  OffboardingChecklistTemplateRecord,
  OffboardingSettlementLine,
  PayrollCalculationLine,
  PayrollCalculationPreview,
} from '@hrm/shared-types';
import {
  EXIT_INTERVIEW_RATING_AREAS,
} from '@hrm/shared-types';
import type {
  EmployeeOffboarding,
  EmployeeOffboardingTask,
  ExitInterviewRecord as ExitInterviewRow,
  OffboardingChecklistTemplate,
  OffboardingChecklistTemplateItem,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export function formatDateValue(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

export function formatDateTimeValue(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString();
}

export function todayIsoDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function addDays(base: Date, days: number): Date {
  const result = new Date(base);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

type TemplateItemRow = OffboardingChecklistTemplateItem;
type TemplateRow = OffboardingChecklistTemplate & {
  _count?: { items: number };
  items?: TemplateItemRow[];
};

type TaskRow = EmployeeOffboardingTask & {
  companyAsset?: { name: string } | null;
};

type ExitInterviewRowWithInterviewer = ExitInterviewRow & {
  interviewer?: { firstName: string; lastName: string } | null;
};

type OffboardingRow = EmployeeOffboarding & {
  employee: {
    firstName: string;
    lastName: string;
    employeeNumber: string;
    designation?: { name: string } | null;
    department?: { name: string } | null;
  };
  template?: { name: string } | null;
  tasks?: TaskRow[];
  exitInterview?: ExitInterviewRowWithInterviewer | null;
  _count?: { tasks: number };
};

export function toTemplateItemRecord(
  row: TemplateItemRow,
): OffboardingChecklistTemplateItemRecord {
  return {
    id: row.id,
    templateId: row.templateId,
    title: row.title,
    description: row.description,
    category: row.category,
    taskType: row.taskType,
    assetCategory: row.assetCategory,
    assigneeLabel: row.assigneeLabel,
    dueDaysOffset: row.dueDaysOffset,
    sortOrder: row.sortOrder,
    isRequired: row.isRequired,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toTemplateRecord(
  row: TemplateRow,
  includeItems = false,
): OffboardingChecklistTemplateRecord {
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    description: row.description,
    isDefault: row.isDefault,
    isActive: row.isActive,
    itemCount: row._count?.items ?? row.items?.length ?? 0,
    items: includeItems && row.items
      ? row.items.map(toTemplateItemRecord)
      : undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function resolveExitInterviewStatus(
  row: { scheduledAt: Date | null; conductedAt: Date | null } | null | undefined,
): ExitInterviewStatus {
  if (!row) return 'not_started';
  if (row.conductedAt) return 'completed';
  return row.scheduledAt ? 'scheduled' : 'not_started';
}

/** Keeps known rating areas with whole-number scores from 1 to 5. */
export function sanitizeExitRatings(raw: unknown): ExitInterviewRatings {
  if (typeof raw !== 'object' || raw == null || Array.isArray(raw)) return {};
  const source = raw as Record<string, unknown>;
  const ratings: ExitInterviewRatings = {};
  for (const area of EXIT_INTERVIEW_RATING_AREAS) {
    const value = source[area];
    if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5) {
      ratings[area] = value;
    }
  }
  return ratings;
}

export function toExitInterviewRecord(
  row: ExitInterviewRowWithInterviewer,
): ExitInterviewRecord {
  return {
    id: row.id,
    offboardingId: row.offboardingId,
    employeeId: row.employeeId,
    status: resolveExitInterviewStatus(row),
    scheduledAt: formatDateTimeValue(row.scheduledAt),
    conductedAt: formatDateTimeValue(row.conductedAt),
    interviewerEmployeeId: row.interviewerEmployeeId,
    interviewerName: row.interviewer
      ? `${row.interviewer.firstName} ${row.interviewer.lastName}`.trim()
      : null,
    reasonCategory: (row.reasonCategory as ExitReasonCategory | null) ?? null,
    reasonForLeaving: row.reasonForLeaving,
    ratings: sanitizeExitRatings(row.ratings),
    rating: row.rating,
    likedMost: row.likedMost,
    improvementSuggestions: row.improvementSuggestions,
    feedback: row.feedback,
    wouldRecommend: row.wouldRecommend,
    wouldRehire: row.wouldRehire,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function isOffboardingTaskOverdue(
  task: { status: string; dueDate: Date | string | null },
  today: string,
): boolean {
  if (task.status !== 'pending' || !task.dueDate) return false;
  const due = typeof task.dueDate === 'string' ? task.dueDate : formatDateValue(task.dueDate);
  return due !== null && due < today;
}

export interface OffboardingProgressSummary {
  progressPercent: number;
  completedTaskCount: number;
  totalTaskCount: number;
  requiredTaskCount: number;
  requiredCompletedCount: number;
  overdueTaskCount: number;
}

/**
 * Progress counts required tasks (completed or skipped), matching the rule that an
 * offboarding completes once every required task is done. With none required, all count.
 */
export function summarizeOffboardingTasks(
  tasks: Array<{ status: string; isRequired: boolean; dueDate: Date | string | null }>,
  today: string,
): OffboardingProgressSummary {
  const isDone = (status: string) => status === 'completed' || status === 'skipped';
  const required = tasks.filter((task) => task.isRequired);
  const basis = required.length > 0 ? required : tasks;
  const basisDone = basis.filter((task) => isDone(task.status)).length;

  return {
    progressPercent: basis.length > 0 ? Math.round((basisDone / basis.length) * 100) : 0,
    completedTaskCount: tasks.filter((task) => isDone(task.status)).length,
    totalTaskCount: tasks.length,
    requiredTaskCount: required.length,
    requiredCompletedCount: required.filter((task) => isDone(task.status)).length,
    overdueTaskCount: tasks.filter((task) => isOffboardingTaskOverdue(task, today)).length,
  };
}

export function toTaskRecord(
  row: TaskRow,
  pendingAssetCount?: number | null,
  today: string = todayIsoDate(),
): EmployeeOffboardingTaskRecord {
  return {
    id: row.id,
    offboardingId: row.offboardingId,
    templateItemId: row.templateItemId,
    title: row.title,
    description: row.description,
    category: row.category,
    taskType: row.taskType,
    assetCategory: row.assetCategory,
    companyAssetId: row.companyAssetId,
    companyAssetName: row.companyAsset?.name ?? null,
    payrollAdjustmentId: row.payrollAdjustmentId,
    assigneeLabel: row.assigneeLabel,
    dueDate: formatDateValue(row.dueDate),
    status: row.status,
    completedAt: formatDateTimeValue(row.completedAt),
    sortOrder: row.sortOrder,
    isRequired: row.isRequired,
    isOverdue: isOffboardingTaskOverdue(row, today),
    pendingAssetCount: pendingAssetCount ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toOffboardingRecord(
  row: OffboardingRow,
  options: {
    includeTasks?: boolean;
    pendingAssetCounts?: Map<string, number>;
    assetsOutstandingCount?: number;
    today?: string;
  } = {},
): EmployeeOffboardingRecord {
  const today = options.today ?? todayIsoDate();
  const taskRows = row.tasks ?? [];
  const summary = summarizeOffboardingTasks(taskRows, today);

  return {
    id: row.id,
    companyId: row.companyId,
    employeeId: row.employeeId,
    employeeName: `${row.employee.firstName} ${row.employee.lastName}`.trim(),
    employeeNumber: row.employee.employeeNumber,
    designationName: row.employee.designation?.name ?? null,
    departmentName: row.employee.department?.name ?? null,
    templateId: row.templateId,
    templateName: row.template?.name ?? null,
    status: row.status,
    lastWorkingDate: formatDateValue(row.lastWorkingDate),
    startedAt: row.startedAt.toISOString(),
    completedAt: formatDateTimeValue(row.completedAt),
    accessRevokedAt: formatDateTimeValue(row.accessRevokedAt),
    ...summary,
    assetsOutstandingCount: options.assetsOutstandingCount ?? 0,
    tasks: options.includeTasks
      ? taskRows.map((task) =>
          toTaskRecord(task, options.pendingAssetCounts?.get(task.id) ?? null, today),
        )
      : undefined,
    exitInterview: row.exitInterview ? toExitInterviewRecord(row.exitInterview) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Component-by-component comparison of the original run and the revised settlement
 * calculation. Lines keep the revised order; components only on the original follow.
 */
export function buildSettlementLines(
  original: PayrollCalculationPreview | null,
  revised: PayrollCalculationPreview | null,
): OffboardingSettlementLine[] {
  const collect = (calc: PayrollCalculationPreview | null) => {
    const byComponent = new Map<string, PayrollCalculationLine>();
    for (const line of [...(calc?.earnings ?? []), ...(calc?.deductions ?? [])]) {
      const existing = byComponent.get(line.componentId);
      byComponent.set(
        line.componentId,
        existing
          ? { ...existing, amount: new Decimal(existing.amount).plus(line.amount).toFixed(2) }
          : line,
      );
    }
    return byComponent;
  };

  const originalLines = collect(original);
  const revisedLines = collect(revised);
  const order = [
    ...revisedLines.keys(),
    ...[...originalLines.keys()].filter((id) => !revisedLines.has(id)),
  ];

  const lines = order.map((componentId) => {
    const before = originalLines.get(componentId) ?? null;
    const after = revisedLines.get(componentId) ?? null;
    const source = (after ?? before) as PayrollCalculationLine;
    const difference = new Decimal(after?.amount ?? 0).minus(before?.amount ?? 0);
    return {
      componentId,
      componentName: source.componentName,
      componentType: source.componentType,
      original: original ? (before?.amount ?? '0.00') : null,
      revised: revised ? (after?.amount ?? '0.00') : null,
      difference: difference.toFixed(2),
    };
  });

  return [
    ...lines.filter((line) => line.componentType === 'earning'),
    ...lines.filter((line) => line.componentType !== 'earning'),
  ];
}

/** Validates settlement lines and turns them into salary-structure overrides. */
export function settlementLinesToOverrides(
  lines: Array<{ componentId: string; amount: string }> | undefined,
): Array<{ componentId: string; amount: string }> {
  if (!lines?.length) return [];
  const seen = new Set<string>();
  return lines.map((line) => {
    const amount = line.amount.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(amount)) {
      throw new SettlementLineError('Settlement amounts must be positive numbers with up to 2 decimals');
    }
    if (seen.has(line.componentId)) {
      throw new SettlementLineError('Each pay component can appear only once');
    }
    seen.add(line.componentId);
    return { componentId: line.componentId, amount: new Decimal(amount).toFixed(2) };
  });
}

export class SettlementLineError extends Error {}
