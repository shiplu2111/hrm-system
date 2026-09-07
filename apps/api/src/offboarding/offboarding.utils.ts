import type {
  EmployeeOffboardingRecord,
  EmployeeOffboardingTaskRecord,
  ExitInterviewRecord,
  OffboardingChecklistTemplateItemRecord,
  OffboardingChecklistTemplateRecord,
} from '@hrm/shared-types';
import type {
  EmployeeOffboarding,
  EmployeeOffboardingTask,
  ExitInterviewRecord as ExitInterviewRow,
  OffboardingChecklistTemplate,
  OffboardingChecklistTemplateItem,
} from '@prisma/client';
import { AssetAssignmentStatus } from '@prisma/client';

export function formatDateValue(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

export function formatDateTimeValue(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString();
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
  _count?: { assetReturns: number };
};

type OffboardingRow = EmployeeOffboarding & {
  employee: {
    firstName: string;
    lastName: string;
    employeeNumber: string;
    designation?: { name: string } | null;
  };
  template?: { name: string } | null;
  tasks?: TaskRow[];
  exitInterview?: ExitInterviewRow & {
    interviewer?: { firstName: string; lastName: string } | null;
  } | null;
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

export function toExitInterviewRecord(
  row: ExitInterviewRow & {
    interviewer?: { firstName: string; lastName: string } | null;
  },
): ExitInterviewRecord {
  return {
    id: row.id,
    offboardingId: row.offboardingId,
    employeeId: row.employeeId,
    scheduledAt: formatDateTimeValue(row.scheduledAt),
    conductedAt: formatDateTimeValue(row.conductedAt),
    interviewerEmployeeId: row.interviewerEmployeeId,
    interviewerName: row.interviewer
      ? `${row.interviewer.firstName} ${row.interviewer.lastName}`.trim()
      : null,
    feedback: row.feedback,
    reasonForLeaving: row.reasonForLeaving,
    wouldRehire: row.wouldRehire,
    rating: row.rating,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toTaskRecord(
  row: TaskRow,
  pendingAssetCount?: number | null,
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
    pendingAssetCount: pendingAssetCount ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toOffboardingRecord(
  row: OffboardingRow,
  includeTasks = false,
  pendingAssetCounts?: Map<string, number>,
): EmployeeOffboardingRecord {
  const tasks = includeTasks && row.tasks
    ? row.tasks.map((task) =>
        toTaskRecord(task, pendingAssetCounts?.get(task.id) ?? null),
      )
    : undefined;
  const totalTaskCount = row._count?.tasks ?? row.tasks?.length ?? 0;
  const completedTaskCount =
    row.tasks?.filter(
      (task) => task.status === 'completed' || task.status === 'skipped',
    ).length ?? 0;
  const progressPercent =
    totalTaskCount > 0
      ? Math.round((completedTaskCount / totalTaskCount) * 100)
      : 0;

  return {
    id: row.id,
    companyId: row.companyId,
    employeeId: row.employeeId,
    employeeName: `${row.employee.firstName} ${row.employee.lastName}`.trim(),
    employeeNumber: row.employee.employeeNumber,
    designationName: row.employee.designation?.name ?? null,
    templateId: row.templateId,
    templateName: row.template?.name ?? null,
    status: row.status,
    lastWorkingDate: formatDateValue(row.lastWorkingDate),
    startedAt: row.startedAt.toISOString(),
    completedAt: formatDateTimeValue(row.completedAt),
    accessRevokedAt: formatDateTimeValue(row.accessRevokedAt),
    progressPercent,
    completedTaskCount,
    totalTaskCount,
    tasks,
    exitInterview: row.exitInterview
      ? toExitInterviewRecord(row.exitInterview)
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export { AssetAssignmentStatus };
