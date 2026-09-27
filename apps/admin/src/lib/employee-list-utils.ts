import type { EmployeeRecord, EmploymentStatus } from '@hrm/shared-types';

export type EmployeeSortKey = 'name' | 'department' | 'designation' | 'status';
export type SortDirection = 'asc' | 'desc';

export interface EmployeeListFilters {
  search: string;
  departmentId: string;
  designationId: string;
  status: string;
}

export function filterEmployees(
  employees: EmployeeRecord[],
  filters: EmployeeListFilters,
): EmployeeRecord[] {
  const q = filters.search.trim().toLowerCase();

  return employees.filter((employee) => {
    if (q) {
      const haystack = [
        employee.fullName,
        employee.employeeNumber,
        employee.department?.name ?? '',
        employee.designation?.name ?? '',
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filters.departmentId !== 'all' && employee.departmentId !== filters.departmentId) {
      return false;
    }
    if (
      filters.designationId !== 'all' &&
      employee.designationId !== filters.designationId
    ) {
      return false;
    }
    if (filters.status !== 'all' && employee.employmentStatus !== filters.status) {
      return false;
    }
    return true;
  });
}

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

const STATUS_ORDER: Record<EmploymentStatus, number> = {
  active: 0,
  on_leave: 1,
  inactive: 2,
  terminated: 3,
};

export function sortEmployees(
  employees: EmployeeRecord[],
  sortKey: EmployeeSortKey,
  direction: SortDirection,
): EmployeeRecord[] {
  const sorted = [...employees].sort((a, b) => {
    let result = 0;
    switch (sortKey) {
      case 'name':
        result = compareStrings(a.fullName, b.fullName);
        break;
      case 'department':
        result = compareStrings(a.department?.name ?? '', b.department?.name ?? '');
        break;
      case 'designation':
        result = compareStrings(a.designation?.name ?? '', b.designation?.name ?? '');
        break;
      case 'status':
        result =
          STATUS_ORDER[a.employmentStatus] - STATUS_ORDER[b.employmentStatus];
        break;
      default:
        result = 0;
    }
    if (result === 0) {
      result = compareStrings(a.employeeNumber, b.employeeNumber);
    }
    return direction === 'asc' ? result : -result;
  });
  return sorted;
}

export function paginateEmployees<T>(
  items: T[],
  page: number,
  pageSize: number,
): { pageItems: T[]; totalPages: number; safePage: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    pageItems: items.slice(start, start + pageSize),
    totalPages,
    safePage,
  };
}

export function toggleSort(
  currentKey: EmployeeSortKey,
  currentDirection: SortDirection,
  nextKey: EmployeeSortKey,
): { sortKey: EmployeeSortKey; sortDirection: SortDirection } {
  if (currentKey === nextKey) {
    return {
      sortKey: nextKey,
      sortDirection: currentDirection === 'asc' ? 'desc' : 'asc',
    };
  }
  return { sortKey: nextKey, sortDirection: 'asc' };
}
