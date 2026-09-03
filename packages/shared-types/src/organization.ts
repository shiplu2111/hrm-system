/** Organization setup types (MODULES.md §03) */

export interface CompanySummary {
  id: string;
  name: string;
  countryId: string;
  financialYearStart: string;
}

export interface DepartmentRecord {
  id: string;
  companyId: string;
  name: string;
  parentDepartmentId: string | null;
  employeeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentTreeNode {
  id: string;
  companyId: string;
  name: string;
  parentDepartmentId: string | null;
  employeeCount: number;
  children: DepartmentTreeNode[];
}

export interface JobLevelRecord {
  id: string;
  companyId: string;
  code: string;
  name: string;
  rank: number;
  createdAt: string;
  updatedAt: string;
}

export interface DesignationRecord {
  id: string;
  companyId: string;
  name: string;
  departmentId: string | null;
  jobLevelId: string | null;
  salaryGrade: string | null;
  createdAt: string;
  updatedAt: string;
  department: { id: string; name: string } | null;
  jobLevel: { id: string; code: string; name: string } | null;
}

export interface NamedOrgEntity {
  id: string;
  companyId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CostCentreRecord {
  id: string;
  companyId: string;
  name: string;
  code: string;
  createdAt: string;
  updatedAt: string;
}
