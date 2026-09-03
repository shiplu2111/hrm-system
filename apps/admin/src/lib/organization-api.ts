import type {
  CompanySummary,
  CostCentreRecord,
  DepartmentRecord,
  DepartmentTreeNode,
  DesignationRecord,
  JobLevelRecord,
  NamedOrgEntity,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

function companyPath(companyId: string, resource: string): string {
  return `/organization/companies/${companyId}/${resource}`;
}

export function listCompanies(): Promise<CompanySummary[]> {
  return tenantApiRequest<CompanySummary[]>('/organization/companies');
}

// Departments
export function listDepartments(companyId: string): Promise<DepartmentRecord[]> {
  return tenantApiRequest<DepartmentRecord[]>(
    companyPath(companyId, 'departments'),
  );
}

export function getDepartmentTree(
  companyId: string,
): Promise<DepartmentTreeNode[]> {
  return tenantApiRequest<DepartmentTreeNode[]>(
    companyPath(companyId, 'departments/tree'),
  );
}

export function createDepartment(
  companyId: string,
  input: { name: string; parentDepartmentId?: string | null },
): Promise<DepartmentRecord> {
  return tenantApiRequest<DepartmentRecord>(
    companyPath(companyId, 'departments'),
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function updateDepartment(
  companyId: string,
  id: string,
  input: { name?: string; parentDepartmentId?: string | null },
): Promise<DepartmentRecord> {
  return tenantApiRequest<DepartmentRecord>(
    `${companyPath(companyId, 'departments')}/${id}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function deleteDepartment(companyId: string, id: string): Promise<void> {
  return tenantApiRequest<void>(
    `${companyPath(companyId, 'departments')}/${id}`,
    { method: 'DELETE' },
  );
}

// Job levels
export function listJobLevels(companyId: string): Promise<JobLevelRecord[]> {
  return tenantApiRequest<JobLevelRecord[]>(
    companyPath(companyId, 'job-levels'),
  );
}

export function createJobLevel(
  companyId: string,
  input: { code: string; name: string; rank: number },
): Promise<JobLevelRecord> {
  return tenantApiRequest<JobLevelRecord>(
    companyPath(companyId, 'job-levels'),
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function updateJobLevel(
  companyId: string,
  id: string,
  input: Partial<{ code: string; name: string; rank: number }>,
): Promise<JobLevelRecord> {
  return tenantApiRequest<JobLevelRecord>(
    `${companyPath(companyId, 'job-levels')}/${id}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function deleteJobLevel(companyId: string, id: string): Promise<void> {
  return tenantApiRequest<void>(
    `${companyPath(companyId, 'job-levels')}/${id}`,
    { method: 'DELETE' },
  );
}

// Designations
export function listDesignations(
  companyId: string,
): Promise<DesignationRecord[]> {
  return tenantApiRequest<DesignationRecord[]>(
    companyPath(companyId, 'designations'),
  );
}

export function createDesignation(
  companyId: string,
  input: {
    name: string;
    departmentId?: string | null;
    jobLevelId?: string | null;
    salaryGrade?: string | null;
  },
): Promise<DesignationRecord> {
  return tenantApiRequest<DesignationRecord>(
    companyPath(companyId, 'designations'),
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function updateDesignation(
  companyId: string,
  id: string,
  input: Partial<{
    name: string;
    departmentId: string | null;
    jobLevelId: string | null;
    salaryGrade: string | null;
  }>,
): Promise<DesignationRecord> {
  return tenantApiRequest<DesignationRecord>(
    `${companyPath(companyId, 'designations')}/${id}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function deleteDesignation(companyId: string, id: string): Promise<void> {
  return tenantApiRequest<void>(
    `${companyPath(companyId, 'designations')}/${id}`,
    { method: 'DELETE' },
  );
}

// Employment types
export function listEmploymentTypes(
  companyId: string,
): Promise<NamedOrgEntity[]> {
  return tenantApiRequest<NamedOrgEntity[]>(
    companyPath(companyId, 'employment-types'),
  );
}

export function createEmploymentType(
  companyId: string,
  input: { name: string },
): Promise<NamedOrgEntity> {
  return tenantApiRequest<NamedOrgEntity>(
    companyPath(companyId, 'employment-types'),
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function updateEmploymentType(
  companyId: string,
  id: string,
  input: { name: string },
): Promise<NamedOrgEntity> {
  return tenantApiRequest<NamedOrgEntity>(
    `${companyPath(companyId, 'employment-types')}/${id}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function deleteEmploymentType(
  companyId: string,
  id: string,
): Promise<void> {
  return tenantApiRequest<void>(
    `${companyPath(companyId, 'employment-types')}/${id}`,
    { method: 'DELETE' },
  );
}

// Teams
export function listTeams(companyId: string): Promise<NamedOrgEntity[]> {
  return tenantApiRequest<NamedOrgEntity[]>(companyPath(companyId, 'teams'));
}

export function createTeam(
  companyId: string,
  input: { name: string },
): Promise<NamedOrgEntity> {
  return tenantApiRequest<NamedOrgEntity>(companyPath(companyId, 'teams'), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateTeam(
  companyId: string,
  id: string,
  input: { name: string },
): Promise<NamedOrgEntity> {
  return tenantApiRequest<NamedOrgEntity>(
    `${companyPath(companyId, 'teams')}/${id}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function deleteTeam(companyId: string, id: string): Promise<void> {
  return tenantApiRequest<void>(`${companyPath(companyId, 'teams')}/${id}`, {
    method: 'DELETE',
  });
}

// Cost centres
export function listCostCentres(
  companyId: string,
): Promise<CostCentreRecord[]> {
  return tenantApiRequest<CostCentreRecord[]>(
    companyPath(companyId, 'cost-centres'),
  );
}

export function createCostCentre(
  companyId: string,
  input: { name: string; code: string },
): Promise<CostCentreRecord> {
  return tenantApiRequest<CostCentreRecord>(
    companyPath(companyId, 'cost-centres'),
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function updateCostCentre(
  companyId: string,
  id: string,
  input: Partial<{ name: string; code: string }>,
): Promise<CostCentreRecord> {
  return tenantApiRequest<CostCentreRecord>(
    `${companyPath(companyId, 'cost-centres')}/${id}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function deleteCostCentre(companyId: string, id: string): Promise<void> {
  return tenantApiRequest<void>(
    `${companyPath(companyId, 'cost-centres')}/${id}`,
    { method: 'DELETE' },
  );
}
