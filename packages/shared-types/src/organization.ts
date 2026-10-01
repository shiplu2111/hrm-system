/** Organization setup types (MODULES.md §03) */

import type { EmploymentStatus } from './employee';

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

// --- Org chart (reporting structure from employees.manager_id) ---

/**
 * `employee`: a filled seat. `vacated`: a departed employee who still has reports.
 * `requisition`: unfilled openings from an open or pending job requisition.
 */
export type OrgChartNodeKind = 'employee' | 'vacated' | 'requisition';

export interface OrgChartPerson {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  status: EmploymentStatus;
  hireDate: string;
  email: string | null;
  phone: string | null;
}

export interface OrgChartVacatedInfo {
  previousHolder: {
    id: string;
    employeeNumber: string;
    name: string;
    exitType: 'resignation' | 'termination' | null;
  };
  /** Effective date of the exit event, when one was recorded. */
  since: string | null;
}

export interface OrgChartRequisitionInfo {
  requisitionId: string;
  referenceNumber: string;
  status: 'open' | 'pending_approval';
  headcount: number;
  filled: number;
  openings: number;
  activeCandidates: number;
  openedAt: string | null;
  /** How the opening was attached: under its requester, its department's most senior employee, or at the top level. */
  placement: 'requester' | 'department' | 'unplaced';
}

export interface OrgChartNode {
  id: string;
  kind: OrgChartNodeKind;
  parentId: string | null;
  title: string | null;
  designationId: string | null;
  departmentId: string | null;
  departmentName: string | null;
  jobLevel: { id: string; code: string; name: string; rank: number } | null;
  employee: OrgChartPerson | null;
  vacated: OrgChartVacatedInfo | null;
  requisition: OrgChartRequisitionInfo | null;
}

export interface OrgChartSummary {
  headcount: number;
  vacatedPositions: number;
  openRequisitions: number;
  openSeats: number;
  pendingSeats: number;
  topLevel: number;
  maxDepth: number;
  averageSpan: number;
}

export interface OrgChartData {
  companyId: string;
  generatedAt: string;
  /** False when the caller lacks recruitment:view; requisition openings are then omitted. */
  includesRequisitions: boolean;
  nodes: OrgChartNode[];
  summary: OrgChartSummary;
}
