import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  MoreHorizontal,
  Plus,
  UserPlus,
} from 'lucide-react';
import type { EmployeeRecord, EmploymentStatus } from '@hrm/shared-types';
import { PermissionGate, usePermission } from '@hrm/portal-ui';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Form';
import { Avatar } from '@/components/ui/Toggle';
import { EmployeeFormWizard } from '@/components/people/EmployeeFormWizard';
import { Dropdown, DropdownItem, DropdownDivider } from '@/components/ui/Dropdown';
import {
  DataTable,
  DataTableBody,
  DataTableHead,
  SortableHeader,
} from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { EmployeeTableSkeleton } from '@/components/people/EmployeeTableSkeleton';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgPageState } from '@/components/org/OrgPageState';
import { PlanLimitPrompt } from '@/components/billing/PlanLimitPrompt';
import { UpgradeRequestModal } from '@/components/billing/UpgradeRequestModal';
import { useNav } from '@/context/NavContext';
import { useSubscription } from '@/hooks/useSubscription';
import { employeeUsage, isAtLimit } from '@/lib/plan-usage';
import {
  bulkUpdateEmployeeStatus,
  deleteEmployee,
  listEmployees,
} from '@/lib/employees-api';
import {
  filterEmployees,
  paginateEmployees,
  sortEmployees,
  toggleSort,
  type EmployeeListFilters,
  type EmployeeSortKey,
  type SortDirection,
} from '@/lib/employee-list-utils';
import {
  listDepartments,
  listDesignations,
} from '@/lib/organization-api';
import { ApiError } from '@/lib/tenant-api-client';

const statusTone: Record<
  EmploymentStatus,
  'success' | 'warning' | 'accent' | 'error' | 'neutral'
> = {
  active: 'success',
  on_leave: 'warning',
  inactive: 'neutral',
  terminated: 'error',
};

const statusLabel: Record<EmploymentStatus, string> = {
  active: 'Active',
  on_leave: 'On Leave',
  inactive: 'Inactive',
  terminated: 'Terminated',
};

const DEFAULT_FILTERS: EmployeeListFilters = {
  search: '',
  departmentId: 'all',
  designationId: 'all',
  status: 'all',
};

function EmployeeListContent({ companyId }: { companyId: string }) {
  const { openEmployee, navigate } = useNav();
  const canCreateEmployee = usePermission('employee', 'create');
  const canEditEmployee = usePermission('employee', 'edit');
  const { view: subscription, reload: reloadSubscription } = useSubscription();
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const atSeatLimit = subscription ? isAtLimit(employeeUsage(subscription)?.level ?? 'ok') : false;

  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<EmployeeListFilters>(DEFAULT_FILTERS);
  const [sortKey, setSortKey] = useState<EmployeeSortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<EmploymentStatus>('active');
  const [bulkApplying, setBulkApplying] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editEmployeeId, setEditEmployeeId] = useState<string | null>(null);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [designations, setDesignations] = useState<{ id: string; name: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [emps, depts, desigs] = await Promise.all([
        listEmployees(companyId),
        listDepartments(companyId),
        listDesignations(companyId),
      ]);
      setEmployees(emps);
      setDepartments(depts.map((d) => ({ id: d.id, name: d.name })));
      setDesignations(desigs.map((d) => ({ id: d.id, name: d.name })));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [filters, sortKey, sortDirection, pageSize, companyId]);

  const filteredSorted = useMemo(() => {
    const filtered = filterEmployees(employees, filters);
    return sortEmployees(filtered, sortKey, sortDirection);
  }, [employees, filters, sortKey, sortDirection]);

  const { pageItems, safePage } = useMemo(
    () => paginateEmployees(filteredSorted, page, pageSize),
    [filteredSorted, page, pageSize],
  );

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const pageIds = pageItems.map((e) => e.id);
  const allPageSelected =
    pageItems.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));

  const handleSort = (key: EmployeeSortKey) => {
    const next = toggleSort(sortKey, sortDirection, key);
    setSortKey(next.sortKey);
    setSortDirection(next.sortDirection);
  };

  const toggleSelectAllPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkStatusApply = async () => {
    if (selectedIds.size === 0) return;
    setBulkApplying(true);
    setError(null);
    try {
      await bulkUpdateEmployeeStatus({
        employeeIds: [...selectedIds],
        employmentStatus: bulkStatus,
      });
      setSelectedIds(new Set());
      await Promise.all([load(), reloadSubscription()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Bulk status update failed');
    } finally {
      setBulkApplying(false);
    }
  };

  const openCreateWizard = () => {
    if (atSeatLimit && subscription?.nextPlanId) {
      setLimitDialogOpen(true);
      return;
    }
    setEditEmployeeId(null);
    setWizardOpen(true);
  };

  const openEditWizard = (id: string) => {
    setEditEmployeeId(id);
    setWizardOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Soft-delete this employee?')) return;
    try {
      await deleteEmployee(id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await Promise.all([load(), reloadSubscription()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Delete failed');
    }
  };

  const hasEmployees = employees.length > 0;
  const hasFilteredResults = filteredSorted.length > 0;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Employees</h1>
          <p className="text-sm text-secondary mt-0.5">
            {loading
              ? 'Loading employee records…'
              : `${filteredSorted.length.toLocaleString()} of ${employees.length.toLocaleString()} employees`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CompanySelector />
          <PermissionGate module="employee" action="create">
            <Button variant="primary" size="md" onClick={openCreateWizard}>
              <Plus className="h-4 w-4" /> Add Employee
            </Button>
          </PermissionGate>
        </div>
      </div>

      {canCreateEmployee && subscription ? (
        <PlanLimitPrompt view={subscription} onViewPlan={() => navigate('billing')} />
      ) : null}

      {error ? (
        <div className="text-sm text-error-600 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-4 py-2">
          {error}
        </div>
      ) : null}

      {!loading && !hasEmployees ? (
        <Card>
          <CardBody className="p-0">
            <EmptyState
              icon={UserPlus}
              title="No employees yet"
              description="Add your first employee to start building your workforce directory."
              action={
                canCreateEmployee
                  ? {
                      label: 'Add your first employee',
                      onClick: openCreateWizard,
                      icon: Plus,
                    }
                  : undefined
              }
            />
          </CardBody>
        </Card>
      ) : (
        <>
          <Card>
            <CardBody className="flex items-center gap-2 overflow-x-auto">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
                <Input
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, search: e.target.value }))
                  }
                  placeholder="Search employees…"
                  className="pl-9 h-9"
                />
              </div>
              <Select
                value={filters.departmentId}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, departmentId: e.target.value }))
                }
                className="h-9 w-[10.5rem] shrink-0"
                aria-label="Filter by department"
              >
                <option value="all">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
              <Select
                value={filters.designationId}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, designationId: e.target.value }))
                }
                className="h-9 w-[10.5rem] shrink-0"
                aria-label="Filter by designation"
              >
                <option value="all">All Designations</option>
                {designations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
              <Select
                value={filters.status}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, status: e.target.value }))
                }
                className="h-9 w-[9rem] shrink-0"
                aria-label="Filter by status"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="on_leave">On Leave</option>
                <option value="inactive">Inactive</option>
                <option value="terminated">Terminated</option>
              </Select>
            </CardBody>
          </Card>

          {canEditEmployee && selectedIds.size > 0 ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 surface rounded-xl border shadow-card px-4 py-3">
              <span className="text-sm font-medium text-primary">
                {selectedIds.size} selected
              </span>
              <div className="flex items-center gap-2 flex-wrap sm:ml-auto">
                <Select
                  value={bulkStatus}
                  onChange={(e) =>
                    setBulkStatus(e.target.value as EmploymentStatus)
                  }
                  className="h-9 w-auto"
                  aria-label="Bulk employment status"
                >
                  <option value="active">Set Active</option>
                  <option value="on_leave">Set On Leave</option>
                  <option value="inactive">Set Inactive</option>
                  <option value="terminated">Set Terminated</option>
                </Select>
                <Button
                  variant="primary"
                  size="md"
                  disabled={bulkApplying}
                  onClick={() => void handleBulkStatusApply()}
                >
                  Apply status
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear
                </Button>
              </div>
            </div>
          ) : null}

          <Card>
            <CardBody className="p-0">
              {loading ? (
                <EmployeeTableSkeleton />
              ) : !hasFilteredResults ? (
                <EmptyState
                  compact
                  icon={Search}
                  title="No employees match your filters"
                  description="Try adjusting search or filter criteria."
                  action={{
                    label: 'Clear filters',
                    onClick: () => setFilters(DEFAULT_FILTERS),
                    variant: 'secondary',
                  }}
                />
              ) : (
                <>
                  <div className="max-h-[calc(100vh-18rem)] overflow-y-auto scrollbar-thin">
                    <DataTable>
                      <DataTableHead>
                        <tr>
                          {canEditEmployee ? (
                            <th className="w-10 px-5 py-2.5">
                              <input
                                type="checkbox"
                                checked={allPageSelected}
                                ref={(el) => {
                                  if (el) el.indeterminate = !allPageSelected && somePageSelected;
                                }}
                                onChange={toggleSelectAllPage}
                                aria-label="Select all on page"
                                className="h-4 w-4 rounded border-base text-accent-600 focus:ring-accent-600"
                              />
                            </th>
                          ) : null}
                          <th className="text-left px-5 py-2.5">
                            <SortableHeader
                              label="Employee"
                              active={sortKey === 'name'}
                              direction={sortDirection}
                              onSort={() => handleSort('name')}
                            />
                          </th>
                          <th className="text-left px-5 py-2.5 hidden md:table-cell">
                            <SortableHeader
                              label="Department"
                              active={sortKey === 'department'}
                              direction={sortDirection}
                              onSort={() => handleSort('department')}
                            />
                          </th>
                          <th className="text-left px-5 py-2.5">
                            <SortableHeader
                              label="Designation"
                              active={sortKey === 'designation'}
                              direction={sortDirection}
                              onSort={() => handleSort('designation')}
                            />
                          </th>
                          <th className="text-left px-5 py-2.5">
                            <SortableHeader
                              label="Status"
                              active={sortKey === 'status'}
                              direction={sortDirection}
                              onSort={() => handleSort('status')}
                            />
                          </th>
                          <th className="w-12 px-5 py-2.5" />
                        </tr>
                      </DataTableHead>
                      <DataTableBody>
                        {pageItems.map((emp) => (
                          <tr
                            key={emp.id}
                            onClick={() => openEmployee(emp.id)}
                            className="hover:bg-[rgb(var(--bg-hover))] transition-colors cursor-pointer group"
                          >
                            {canEditEmployee ? (
                              <td
                                className="px-5 py-3"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(emp.id)}
                                  onChange={() => toggleSelectOne(emp.id)}
                                  aria-label={`Select ${emp.fullName}`}
                                  className="h-4 w-4 rounded border-base text-accent-600 focus:ring-accent-600"
                                />
                              </td>
                            ) : null}
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-3">
                                <Avatar name={emp.fullName} size="sm" />
                                <div>
                                  <div className="font-medium text-primary">{emp.fullName}</div>
                                  <div className="text-xs text-muted">{emp.employeeNumber}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-secondary hidden md:table-cell">
                              {emp.department?.name ?? '—'}
                            </td>
                            <td className="px-5 py-3 text-secondary">
                              {emp.designation?.name ?? '—'}
                            </td>
                            <td className="px-5 py-3">
                              <Badge tone={statusTone[emp.employmentStatus]} dot>
                                {statusLabel[emp.employmentStatus]}
                              </Badge>
                            </td>
                            <td
                              className="px-5 py-3"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Dropdown
                                trigger={
                                  <button
                                    type="button"
                                    className="text-muted hover:text-primary p-1 rounded hover:bg-[rgb(var(--bg-muted))]"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </button>
                                }
                              >
                                <DropdownItem onClick={() => openEmployee(emp.id)}>
                                  View Profile
                                </DropdownItem>
                                <PermissionGate module="employee" action="edit">
                                  <DropdownItem onClick={() => openEditWizard(emp.id)}>
                                    Edit Employee
                                  </DropdownItem>
                                </PermissionGate>
                                <PermissionGate module="employee" action="delete">
                                  <DropdownDivider />
                                  <DropdownItem onClick={() => void handleDelete(emp.id)}>
                                    Delete
                                  </DropdownItem>
                                </PermissionGate>
                              </Dropdown>
                            </td>
                          </tr>
                        ))}
                      </DataTableBody>
                    </DataTable>
                  </div>
                  <Pagination
                    page={safePage}
                    pageSize={pageSize}
                    totalItems={filteredSorted.length}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => {
                      setPageSize(size);
                      setPage(1);
                    }}
                  />
                </>
              )}
            </CardBody>
          </Card>
        </>
      )}

      <EmployeeFormWizard
        open={wizardOpen}
        onClose={() => {
          setWizardOpen(false);
          void reloadSubscription();
        }}
        companyId={companyId}
        employeeId={editEmployeeId}
        onSuccess={() => void load()}
      />

      {subscription?.nextPlanId ? (
        <UpgradeRequestModal
          open={limitDialogOpen}
          onClose={() => setLimitDialogOpen(false)}
          view={subscription}
          targetPlanId={subscription.nextPlanId}
          showLimitNotice
        />
      ) : null}
    </div>
  );
}

export function EmployeeDirectoryPage() {
  return (
    <OrgPageState>
      {(companyId) => <EmployeeListContent companyId={companyId} />}
    </OrgPageState>
  );
}
