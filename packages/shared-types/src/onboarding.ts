import type { AssetCategory } from './assets';

export type OnboardingTaskCategory =
  | 'document_collection'
  | 'policy_acceptance'
  | 'equipment_provisioning'
  | 'system_access'
  | 'general';

export type OnboardingTaskType =
  | 'document_collection'
  | 'policy_acceptance'
  | 'manual_task'
  | 'provisioning';

export type OnboardingStatus = 'in_progress' | 'completed' | 'cancelled';

export type OnboardingTaskStatus = 'pending' | 'completed' | 'skipped';

/**
 * Where the document behind a document/policy task stands:
 * `missing` — nothing uploaded; `awaiting_file` — record created without an attachment;
 * `pending_verification` — uploaded, the type requires verification and nobody has verified it;
 * `verified` — verified; `on_file` — uploaded and the type needs no verification.
 */
export type OnboardingDocumentStatus =
  | 'missing'
  | 'awaiting_file'
  | 'pending_verification'
  | 'verified'
  | 'on_file';

export const ONBOARDING_TASK_CATEGORY_LABELS: Record<OnboardingTaskCategory, string> = {
  document_collection: 'Document Collection',
  policy_acceptance: 'Policy Acceptance',
  equipment_provisioning: 'Equipment Provisioning',
  system_access: 'System Access',
  general: 'General',
};

export const ONBOARDING_TASK_TYPE_LABELS: Record<OnboardingTaskType, string> = {
  document_collection: 'Collect a document',
  policy_acceptance: 'Policy acceptance',
  manual_task: 'Manual task',
  provisioning: 'Provisioning',
};

export const ONBOARDING_TASK_CATEGORIES = Object.keys(
  ONBOARDING_TASK_CATEGORY_LABELS,
) as OnboardingTaskCategory[];

export const ONBOARDING_TASK_TYPES = Object.keys(
  ONBOARDING_TASK_TYPE_LABELS,
) as OnboardingTaskType[];

/** Document and policy tasks are tied to a document type; the others never are. */
export function onboardingTaskTypeNeedsDocumentType(taskType: OnboardingTaskType): boolean {
  return taskType === 'document_collection' || taskType === 'policy_acceptance';
}

export interface OnboardingChecklistTemplateItemRecord {
  id: string;
  templateId: string;
  title: string;
  description: string | null;
  category: OnboardingTaskCategory;
  taskType: OnboardingTaskType;
  documentTypeId: string | null;
  documentTypeName: string | null;
  documentRequiresVerification: boolean | null;
  assetCategory: AssetCategory | null;
  policyDocumentUrl: string | null;
  assigneeLabel: string | null;
  dueDaysOffset: number | null;
  sortOrder: number;
  isRequired: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingChecklistTemplateRecord {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  itemCount: number;
  /** Onboardings started from this template; a template in use cannot be deleted. */
  onboardingCount: number;
  items?: OnboardingChecklistTemplateItemRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface ReorderOnboardingTemplateItemsInput {
  itemIds: string[];
}

export interface EmployeeOnboardingTaskRecord {
  id: string;
  onboardingId: string;
  templateItemId: string | null;
  title: string;
  description: string | null;
  category: OnboardingTaskCategory;
  taskType: OnboardingTaskType;
  documentTypeId: string | null;
  documentTypeName: string | null;
  employeeDocumentId: string | null;
  documentRequiresVerification: boolean | null;
  documentVerified: boolean | null;
  documentStatus: OnboardingDocumentStatus | null;
  documentUploadedAt: string | null;
  documentVerifiedAt: string | null;
  assetCategory: AssetCategory | null;
  companyAssetId: string | null;
  companyAssetName: string | null;
  pendingAssetAssignCount: number | null;
  policyDocumentUrl: string | null;
  policyAcceptedAt: string | null;
  assigneeLabel: string | null;
  dueDate: string | null;
  isOverdue: boolean;
  status: OnboardingTaskStatus;
  completedAt: string | null;
  sortOrder: number;
  isRequired: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeOnboardingRecord {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  designationName: string | null;
  hireDate: string | null;
  templateId: string | null;
  templateName: string | null;
  status: OnboardingStatus;
  startedAt: string;
  completedAt: string | null;
  welcomeSentAt: string | null;
  /** Share of required tasks that are completed or skipped. */
  progressPercent: number;
  /** Completed or skipped tasks, required and optional. */
  completedTaskCount: number;
  totalTaskCount: number;
  requiredTaskCount: number;
  requiredCompletedCount: number;
  overdueTaskCount: number;
  documentsMissingCount: number;
  documentsPendingVerificationCount: number;
  tasks?: EmployeeOnboardingTaskRecord[];
  createdAt: string;
  updatedAt: string;
}
