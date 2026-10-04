export type AssetStatus = 'available' | 'assigned' | 'in_repair' | 'retired';

export type AssetCategory =
  | 'laptop'
  | 'monitor'
  | 'mobile'
  | 'phone'
  | 'sim'
  | 'accessory'
  | 'id_card'
  | 'equipment';

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  laptop: 'Laptop',
  monitor: 'Monitor',
  mobile: 'Mobile',
  phone: 'Phone',
  sim: 'SIM',
  accessory: 'Accessory',
  id_card: 'ID Card',
  equipment: 'Equipment',
};

export type AssetAssignmentStatus = 'active' | 'returned';

export interface CompanyAssetRecord {
  id: string;
  companyId: string;
  name: string;
  assetTag: string;
  category: AssetCategory;
  serialNumber: string | null;
  purchaseDate: string | null;
  warrantyExpiryDate: string | null;
  purchaseValue: string | null;
  currency: string;
  status: AssetStatus;
  notes: string | null;
  assignedEmployeeId: string | null;
  assignedEmployeeName: string | null;
  assignedEmployeeNumber: string | null;
  /** The open assignment, when the asset is with an employee. */
  assignmentId: string | null;
  assignedAt: string | null;
  conditionOnAssign: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Common condition labels offered when assigning or returning an asset. */
export const ASSET_CONDITIONS = ['New', 'Good', 'Fair', 'Minor wear', 'Damaged', 'Missing parts'] as const;

export interface EmployeeAssetAssignmentRecord {
  id: string;
  assetId: string;
  assetName: string;
  assetTag: string;
  employeeId: string;
  employeeName: string;
  status: AssetAssignmentStatus;
  assignedAt: string;
  returnedAt: string | null;
  conditionOnAssign: string | null;
  conditionOnReturn: string | null;
  notes: string | null;
  offboardingTaskId: string | null;
  onboardingTaskId: string | null;
  createdAt: string;
  updatedAt: string;
  /** Assign/return responses only: onboarding or offboarding checklist steps this change completed or reopened. */
  checklistUpdates?: string[];
}
