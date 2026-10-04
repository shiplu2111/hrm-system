import type {
  EmployeeOnboardingRecord,
  EmployeeOnboardingTaskRecord,
  OnboardingChecklistTemplateItemRecord,
  OnboardingChecklistTemplateRecord,
  OnboardingDocumentStatus,
  OnboardingTaskType,
} from '@hrm/shared-types';
import type {
  AssetCategory,
  EmployeeOnboarding,
  EmployeeOnboardingTask,
  OnboardingChecklistTemplate,
  OnboardingChecklistTemplateItem,
} from '@prisma/client';

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

type TemplateItemRow = OnboardingChecklistTemplateItem & {
  documentType?: { name: string; requiresVerification?: boolean } | null;
};

type TemplateRow = OnboardingChecklistTemplate & {
  _count?: { items?: number; onboardings?: number };
  items?: TemplateItemRow[];
};

type LinkedDocument = {
  fileKey: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
};

type TaskRow = EmployeeOnboardingTask & {
  documentType?: { name: string; requiresVerification: boolean } | null;
  employeeDocument?: LinkedDocument | null;
  companyAsset?: { name: string } | null;
};

type OnboardingRow = EmployeeOnboarding & {
  employee: {
    firstName: string;
    lastName: string;
    employeeNumber: string;
    hireDate?: Date | null;
    designation?: { name: string } | null;
  };
  template?: { name: string } | null;
  tasks?: TaskRow[];
  _count?: { tasks: number };
};

export function resolveOnboardingDocumentStatus(input: {
  documentTypeId: string | null;
  requiresVerification: boolean;
  document: LinkedDocument | null | undefined;
}): OnboardingDocumentStatus | null {
  if (!input.documentTypeId) return null;
  const doc = input.document;
  if (!doc) return 'missing';
  if (doc.verifiedAt) return 'verified';
  if (!doc.fileKey) return 'awaiting_file';
  return input.requiresVerification ? 'pending_verification' : 'on_file';
}

export function isOnboardingTaskOverdue(
  task: { status: string; dueDate: Date | string | null },
  today: string,
): boolean {
  if (task.status !== 'pending' || !task.dueDate) return false;
  const due = typeof task.dueDate === 'string' ? task.dueDate : formatDateValue(task.dueDate);
  return due !== null && due < today;
}

export interface OnboardingProgressSummary {
  progressPercent: number;
  completedTaskCount: number;
  totalTaskCount: number;
  requiredTaskCount: number;
  requiredCompletedCount: number;
  overdueTaskCount: number;
  documentsMissingCount: number;
  documentsPendingVerificationCount: number;
}

/**
 * Progress counts only required tasks (completed or skipped), matching the rule that
 * an onboarding completes once every required task is done. With no required tasks,
 * every task counts.
 */
export function summarizeOnboardingTasks(
  tasks: Array<{
    status: string;
    isRequired: boolean;
    dueDate: Date | string | null;
    documentStatus: OnboardingDocumentStatus | null;
  }>,
  today: string,
): OnboardingProgressSummary {
  const isDone = (status: string) => status === 'completed' || status === 'skipped';
  const required = tasks.filter((task) => task.isRequired);
  const basis = required.length > 0 ? required : tasks;
  const basisDone = basis.filter((task) => isDone(task.status)).length;
  const pending = tasks.filter((task) => task.status === 'pending');

  return {
    progressPercent: basis.length > 0 ? Math.round((basisDone / basis.length) * 100) : 0,
    completedTaskCount: tasks.filter((task) => isDone(task.status)).length,
    totalTaskCount: tasks.length,
    requiredTaskCount: required.length,
    requiredCompletedCount: required.filter((task) => isDone(task.status)).length,
    overdueTaskCount: tasks.filter((task) => isOnboardingTaskOverdue(task, today)).length,
    documentsMissingCount: pending.filter(
      (task) => task.documentStatus === 'missing' || task.documentStatus === 'awaiting_file',
    ).length,
    documentsPendingVerificationCount: pending.filter(
      (task) => task.documentStatus === 'pending_verification',
    ).length,
  };
}

export interface TemplateItemFieldInput {
  documentTypeId?: string | null;
  assetCategory?: AssetCategory | null;
  policyDocumentUrl?: string | null;
}

/** Clears fields that do not apply to the task type, so a type change never leaves stale links. */
export function normalizeTemplateItemFields(
  taskType: OnboardingTaskType,
  fields: TemplateItemFieldInput,
): Required<TemplateItemFieldInput> {
  const needsDocument = taskType === 'document_collection' || taskType === 'policy_acceptance';
  const url = fields.policyDocumentUrl?.trim();
  return {
    documentTypeId: needsDocument ? (fields.documentTypeId ?? null) : null,
    assetCategory: taskType === 'provisioning' ? (fields.assetCategory ?? null) : null,
    policyDocumentUrl: taskType === 'policy_acceptance' && url ? url : null,
  };
}

/** The requested order must name every item of the template exactly once. */
export function validateItemOrder(
  existingIds: string[],
  requestedIds: string[],
): { ok: true } | { ok: false; reason: string } {
  if (new Set(requestedIds).size !== requestedIds.length) {
    return { ok: false, reason: 'Each item may appear only once' };
  }
  if (requestedIds.length !== existingIds.length) {
    return { ok: false, reason: 'The order must include every item in the template' };
  }
  const existing = new Set(existingIds);
  if (!requestedIds.every((id) => existing.has(id))) {
    return { ok: false, reason: 'The order includes an item from another template' };
  }
  return { ok: true };
}

/** "Copy of X", then "Copy of X (2)", "(3)"… until the name is free. */
export function nextCopyName(sourceName: string, takenNames: string[]): string {
  const taken = new Set(takenNames.map((name) => name.trim().toLowerCase()));
  const base = `Copy of ${sourceName}`;
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base} (${n})`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

export function toTemplateItemRecord(
  row: TemplateItemRow,
): OnboardingChecklistTemplateItemRecord {
  return {
    id: row.id,
    templateId: row.templateId,
    title: row.title,
    description: row.description,
    category: row.category,
    taskType: row.taskType,
    documentTypeId: row.documentTypeId,
    documentTypeName: row.documentType?.name ?? null,
    documentRequiresVerification: row.documentType
      ? (row.documentType.requiresVerification ?? null)
      : null,
    assetCategory: row.assetCategory ?? null,
    policyDocumentUrl: row.policyDocumentUrl,
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
): OnboardingChecklistTemplateRecord {
  const items = includeItems && row.items
    ? row.items.map(toTemplateItemRecord)
    : undefined;

  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    description: row.description,
    isDefault: row.isDefault,
    isActive: row.isActive,
    itemCount: row._count?.items ?? row.items?.length ?? 0,
    onboardingCount: row._count?.onboardings ?? 0,
    items,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toTaskRecord(
  row: TaskRow,
  pendingAssetAssignCount?: number | null,
  today: string = todayIsoDate(),
): EmployeeOnboardingTaskRecord {
  const requiresVerification = row.documentType?.requiresVerification ?? false;
  const doc = row.employeeDocument ?? null;

  return {
    id: row.id,
    onboardingId: row.onboardingId,
    templateItemId: row.templateItemId,
    title: row.title,
    description: row.description,
    category: row.category,
    taskType: row.taskType,
    documentTypeId: row.documentTypeId,
    documentTypeName: row.documentType?.name ?? null,
    employeeDocumentId: row.employeeDocumentId,
    documentRequiresVerification: row.documentTypeId ? requiresVerification : null,
    documentVerified: row.employeeDocumentId ? doc?.verifiedAt != null : null,
    documentStatus: resolveOnboardingDocumentStatus({
      documentTypeId: row.documentTypeId,
      requiresVerification,
      document: doc,
    }),
    documentUploadedAt: doc ? doc.createdAt.toISOString() : null,
    documentVerifiedAt: formatDateTimeValue(doc?.verifiedAt),
    assetCategory: row.assetCategory ?? null,
    companyAssetId: row.companyAssetId,
    companyAssetName: row.companyAsset?.name ?? null,
    pendingAssetAssignCount: pendingAssetAssignCount ?? null,
    policyDocumentUrl: row.policyDocumentUrl,
    policyAcceptedAt: formatDateTimeValue(row.policyAcceptedAt),
    assigneeLabel: row.assigneeLabel,
    dueDate: formatDateValue(row.dueDate),
    isOverdue: isOnboardingTaskOverdue(row, today),
    status: row.status,
    completedAt: formatDateTimeValue(row.completedAt),
    sortOrder: row.sortOrder,
    isRequired: row.isRequired,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toOnboardingRecord(
  row: OnboardingRow,
  includeTasks = false,
  pendingAssetCounts?: Map<string, number>,
  today: string = todayIsoDate(),
): EmployeeOnboardingRecord {
  const taskRecords = (row.tasks ?? []).map((task) =>
    toTaskRecord(task, pendingAssetCounts?.get(task.id) ?? null, today),
  );
  const summary = summarizeOnboardingTasks(taskRecords, today);

  return {
    id: row.id,
    companyId: row.companyId,
    employeeId: row.employeeId,
    employeeName: `${row.employee.firstName} ${row.employee.lastName}`.trim(),
    employeeNumber: row.employee.employeeNumber,
    designationName: row.employee.designation?.name ?? null,
    hireDate: formatDateValue(row.employee.hireDate),
    templateId: row.templateId,
    templateName: row.template?.name ?? null,
    status: row.status,
    startedAt: row.startedAt.toISOString(),
    completedAt: formatDateTimeValue(row.completedAt),
    welcomeSentAt: formatDateTimeValue(row.welcomeSentAt),
    ...summary,
    tasks: includeTasks ? taskRecords : undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function addDays(base: Date, days: number): Date {
  const result = new Date(base);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
