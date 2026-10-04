import type { AssetCategory } from './assets';
import type {
  PayComponentCalculationType,
  PayComponentType,
  PayrollAdjustmentRecord,
  PayrollPeriodStatus,
  PayrollRunStatus,
} from './payroll';

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

export const OFFBOARDING_TASK_CATEGORY_LABELS: Record<OffboardingTaskCategory, string> = {
  clearance: 'Clearance',
  asset_return: 'Asset Return',
  access_revocation: 'Access Revocation',
  exit_process: 'Exit Process',
  final_settlement: 'Final Settlement',
};

export const OFFBOARDING_TASK_CATEGORIES = Object.keys(
  OFFBOARDING_TASK_CATEGORY_LABELS,
) as OffboardingTaskCategory[];

export type ExitReasonCategory =
  | 'better_opportunity'
  | 'compensation'
  | 'career_growth'
  | 'management'
  | 'work_life_balance'
  | 'culture'
  | 'relocation'
  | 'personal'
  | 'retirement'
  | 'contract_end'
  | 'termination'
  | 'other';

export const EXIT_REASON_CATEGORY_LABELS: Record<ExitReasonCategory, string> = {
  better_opportunity: 'Better opportunity elsewhere',
  compensation: 'Compensation & benefits',
  career_growth: 'Career growth / development',
  management: 'Manager or leadership',
  work_life_balance: 'Work-life balance / workload',
  culture: 'Team or company culture',
  relocation: 'Relocation',
  personal: 'Personal or family reasons',
  retirement: 'Retirement',
  contract_end: 'End of contract',
  termination: 'Terminated by company',
  other: 'Other',
};

export const EXIT_REASON_CATEGORIES = Object.keys(
  EXIT_REASON_CATEGORY_LABELS,
) as ExitReasonCategory[];

export type ExitInterviewRatingArea =
  | 'role'
  | 'manager'
  | 'team'
  | 'compensation'
  | 'growth'
  | 'work_life_balance';

export const EXIT_INTERVIEW_RATING_AREA_LABELS: Record<ExitInterviewRatingArea, string> = {
  role: 'Role & responsibilities',
  manager: 'Manager support',
  team: 'Team & culture',
  compensation: 'Compensation & benefits',
  growth: 'Growth & learning',
  work_life_balance: 'Work-life balance',
};

export const EXIT_INTERVIEW_RATING_AREAS = Object.keys(
  EXIT_INTERVIEW_RATING_AREA_LABELS,
) as ExitInterviewRatingArea[];

export type ExitInterviewRatings = Partial<Record<ExitInterviewRatingArea, number>>;

export type ExitInterviewStatus = 'not_started' | 'scheduled' | 'completed';

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
  status: ExitInterviewStatus;
  scheduledAt: string | null;
  conductedAt: string | null;
  interviewerEmployeeId: string | null;
  interviewerName: string | null;
  reasonCategory: ExitReasonCategory | null;
  reasonForLeaving: string | null;
  ratings: ExitInterviewRatings;
  /** Overall experience, 1–5. */
  rating: number | null;
  likedMost: string | null;
  improvementSuggestions: string | null;
  /** Additional comments / interviewer notes. */
  feedback: string | null;
  wouldRecommend: boolean | null;
  /** Company-side rehire eligibility. */
  wouldRehire: boolean | null;
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
  isOverdue: boolean;
  /** Asset-return tasks: assets of the task's category still assigned. */
  pendingAssetCount: number | null;
  createdAt: string;
  updatedAt: string;
}

/** An asset assigned to the employee — live from the asset register. */
export interface OffboardingAssetRecord {
  assignmentId: string;
  assetId: string;
  assetName: string;
  assetTag: string;
  category: AssetCategory;
  serialNumber: string | null;
  purchaseValue: string | null;
  currency: string;
  status: 'active' | 'returned';
  assignedAt: string;
  returnedAt: string | null;
  conditionOnAssign: string | null;
  conditionOnReturn: string | null;
  notes: string | null;
  /** True when this offboarding's checklist has an asset-return step covering the category. */
  coveredByChecklist: boolean;
}

export interface OffboardingAccessStatus {
  hasPortalAccount: boolean;
  email: string | null;
  accountActive: boolean;
  activeSessionCount: number;
  lastLoginAt: string | null;
  revokedAt: string | null;
}

export interface OffboardingSettlementLine {
  componentId: string;
  componentName: string;
  componentType: PayComponentType;
  original: string | null;
  revised: string | null;
  difference: string;
}

/** The final-settlement payroll adjustment (PAYROLL_LOGIC.md §11) with its context. */
export interface OffboardingSettlementRecord {
  adjustment: PayrollAdjustmentRecord;
  currency: string;
  originalRun: {
    id: string;
    periodStart: string;
    periodEnd: string;
    status: PayrollRunStatus;
  };
  applyToPeriod: {
    id: string;
    startDate: string;
    endDate: string;
    paymentDate: string;
    status: PayrollPeriodStatus;
  } | null;
  /** Per-component comparison; empty when neither side has a stored breakdown. */
  lines: OffboardingSettlementLine[];
  originalBreakdownAvailable: boolean;
}

export interface OffboardingSettlementOptions {
  runs: Array<{
    id: string;
    periodId: string;
    periodStart: string;
    periodEnd: string;
    status: PayrollRunStatus;
    grossPay: string;
    netPay: string;
    payCurrency: string;
  }>;
  periods: Array<{
    id: string;
    startDate: string;
    endDate: string;
    paymentDate: string;
    status: PayrollPeriodStatus;
  }>;
  components: Array<{
    id: string;
    name: string;
    type: PayComponentType;
    calculationType: PayComponentCalculationType;
    /** Amount on the employee's current salary structure, when assigned. */
    currentAmount: string | null;
  }>;
}

export interface EmployeeOffboardingRecord {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  designationName: string | null;
  departmentName: string | null;
  templateId: string | null;
  templateName: string | null;
  status: OffboardingStatus;
  lastWorkingDate: string | null;
  startedAt: string;
  completedAt: string | null;
  accessRevokedAt: string | null;
  /** Required tasks done or skipped, as a percentage (all tasks when none are required). */
  progressPercent: number;
  completedTaskCount: number;
  totalTaskCount: number;
  requiredTaskCount: number;
  requiredCompletedCount: number;
  overdueTaskCount: number;
  assetsOutstandingCount: number;
  tasks?: EmployeeOffboardingTaskRecord[];
  exitInterview?: ExitInterviewRecord | null;
  /** Detail view only. */
  assets?: OffboardingAssetRecord[];
  access?: OffboardingAccessStatus;
  /** Detail view only, and only for users with payroll view permission. */
  settlement?: OffboardingSettlementRecord | null;
  settlementVisible?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SaveExitInterviewInput {
  scheduledAt?: string | null;
  conductedAt?: string | null;
  interviewerEmployeeId?: string | null;
  reasonCategory?: ExitReasonCategory | null;
  reasonForLeaving?: string | null;
  ratings?: ExitInterviewRatings;
  rating?: number | null;
  likedMost?: string | null;
  improvementSuggestions?: string | null;
  feedback?: string | null;
  wouldRecommend?: boolean | null;
  wouldRehire?: boolean | null;
  /** Marks the interview conducted and completes the checklist step. */
  complete?: boolean;
}

export interface SettlementLineInput {
  componentId: string;
  amount: string;
}

export interface GenerateFinalSettlementInput {
  originalPayrollRunId?: string;
  applyToPayrollPeriodId?: string;
  reason?: string;
  lines?: SettlementLineInput[];
}
