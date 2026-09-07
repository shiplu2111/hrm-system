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

export interface OnboardingChecklistTemplateItemRecord {
  id: string;
  templateId: string;
  title: string;
  description: string | null;
  category: OnboardingTaskCategory;
  taskType: OnboardingTaskType;
  documentTypeId: string | null;
  documentTypeName: string | null;
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
  items?: OnboardingChecklistTemplateItemRecord[];
  createdAt: string;
  updatedAt: string;
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
  assetCategory: AssetCategory | null;
  companyAssetId: string | null;
  companyAssetName: string | null;
  pendingAssetAssignCount: number | null;
  policyDocumentUrl: string | null;
  policyAcceptedAt: string | null;
  assigneeLabel: string | null;
  dueDate: string | null;
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
  templateId: string | null;
  templateName: string | null;
  status: OnboardingStatus;
  startedAt: string;
  completedAt: string | null;
  welcomeSentAt: string | null;
  progressPercent: number;
  completedTaskCount: number;
  totalTaskCount: number;
  tasks?: EmployeeOnboardingTaskRecord[];
  createdAt: string;
  updatedAt: string;
}
