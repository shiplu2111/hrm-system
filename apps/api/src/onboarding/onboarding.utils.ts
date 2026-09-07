import type {
  EmployeeOnboardingRecord,
  EmployeeOnboardingTaskRecord,
  OnboardingChecklistTemplateItemRecord,
  OnboardingChecklistTemplateRecord,
} from '@hrm/shared-types';
import type {
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

type TemplateItemRow = OnboardingChecklistTemplateItem & {
  documentType?: { name: string } | null;
};

type TemplateRow = OnboardingChecklistTemplate & {
  _count?: { items: number };
  items?: TemplateItemRow[];
};

type TaskRow = EmployeeOnboardingTask & {
  documentType?: { name: string; requiresVerification: boolean } | null;
  employeeDocument?: { verifiedAt: Date | null } | null;
  companyAsset?: { name: string } | null;
};

type OnboardingRow = EmployeeOnboarding & {
  employee: {
    firstName: string;
    lastName: string;
    employeeNumber: string;
    designation?: { name: string } | null;
  };
  template?: { name: string } | null;
  tasks?: TaskRow[];
  _count?: { tasks: number };
};

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
    items,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toTaskRecord(
  row: TaskRow,
  pendingAssetAssignCount?: number | null,
): EmployeeOnboardingTaskRecord {
  const requiresVerification = row.documentType?.requiresVerification ?? false;
  const verified = row.employeeDocument?.verifiedAt != null;

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
    documentRequiresVerification: row.documentTypeId
      ? (row.documentType?.requiresVerification ?? false)
      : null,
    documentVerified: row.employeeDocumentId ? verified : null,
    assetCategory: row.assetCategory ?? null,
    companyAssetId: row.companyAssetId,
    companyAssetName: row.companyAsset?.name ?? null,
    pendingAssetAssignCount: pendingAssetAssignCount ?? null,
    policyDocumentUrl: row.policyDocumentUrl,
    policyAcceptedAt: formatDateTimeValue(row.policyAcceptedAt),
    assigneeLabel: row.assigneeLabel,
    dueDate: formatDateValue(row.dueDate),
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
): EmployeeOnboardingRecord {
  const tasks =
    includeTasks && row.tasks
      ? row.tasks.map((task) =>
          toTaskRecord(task, pendingAssetCounts?.get(task.id) ?? null),
        )
      : undefined;
  const totalTaskCount = row._count?.tasks ?? row.tasks?.length ?? 0;
  const completedTaskCount =
    row.tasks?.filter((task) => task.status === 'completed').length ?? 0;
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
    startedAt: row.startedAt.toISOString(),
    completedAt: formatDateTimeValue(row.completedAt),
    welcomeSentAt: formatDateTimeValue(row.welcomeSentAt),
    progressPercent,
    completedTaskCount,
    totalTaskCount,
    tasks,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function addDays(base: Date, days: number): Date {
  const result = new Date(base);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
