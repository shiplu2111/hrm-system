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
  createdAt: string;
  updatedAt: string;
}

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
}
