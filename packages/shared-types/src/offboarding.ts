import type { AssetCategory } from './assets';

export type OffboardingTaskCategory =
  | 'clearance'
  | 'asset_return'
  | 'access_revocation'
  | 'exit_process'
  | 'final_settlement';

export type OffboardingTaskType =
  | 'clearance'
  | 'asset_return'
  | 'access_revocation'
  | 'exit_interview'
  | 'final_settlement'
  | 'manual_task';

export type OffboardingStatus = 'in_progress' | 'completed' | 'cancelled';

export type OffboardingTaskStatus = 'pending' | 'completed' | 'skipped';

export interface OffboardingChecklistTemplateItemRecord {
  id: string;
  templateId: string;
  title: string;
  description: string | null;
  category: OffboardingTaskCategory;
  taskType: OffboardingTaskType;
  assetCategory: AssetCategory | null;
  assigneeLabel: string | null;
  dueDaysOffset: number | null;
  sortOrder: number;
  isRequired: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OffboardingChecklistTemplateRecord {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  itemCount: number;
  items?: OffboardingChecklistTemplateItemRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface ExitInterviewRecord {
  id: string;
  offboardingId: string;
  employeeId: string;
  scheduledAt: string | null;
  conductedAt: string | null;
  interviewerEmployeeId: string | null;
  interviewerName: string | null;
  feedback: string | null;
  reasonForLeaving: string | null;
  wouldRehire: boolean | null;
  rating: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeOffboardingTaskRecord {
  id: string;
  offboardingId: string;
  templateItemId: string | null;
  title: string;
  description: string | null;
  category: OffboardingTaskCategory;
  taskType: OffboardingTaskType;
  assetCategory: AssetCategory | null;
  companyAssetId: string | null;
  companyAssetName: string | null;
  payrollAdjustmentId: string | null;
  assigneeLabel: string | null;
  dueDate: string | null;
  status: OffboardingTaskStatus;
  completedAt: string | null;
  sortOrder: number;
  isRequired: boolean;
  pendingAssetCount: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeOffboardingRecord {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  designationName: string | null;
  templateId: string | null;
  templateName: string | null;
  status: OffboardingStatus;
  lastWorkingDate: string | null;
  startedAt: string;
  completedAt: string | null;
  accessRevokedAt: string | null;
  progressPercent: number;
  completedTaskCount: number;
  totalTaskCount: number;
  tasks?: EmployeeOffboardingTaskRecord[];
  exitInterview?: ExitInterviewRecord | null;
  createdAt: string;
  updatedAt: string;
}
