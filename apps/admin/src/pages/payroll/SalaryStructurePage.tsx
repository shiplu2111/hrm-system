import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CalendarClock,
  CheckCircle2,
  Download,
  Layers,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  StopCircle,
  Trash2,
  TrendingUp,
  UserRound,
  Wallet,
} from 'lucide-react';
import type {
  EmployeeRecord,
  PayComponentRecord,
  PayrollCalculationPreview,
  PayrollSalaryStructureOverride,
  SalaryStructurePayrollLock,
  SalaryStructureRecord,
} from '@hrm/shared-types';
import { usePermissions } from '@hrm/portal-ui';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusPill, type StatusPillTone } from '@/components/ui/StatusPill';
import { Avatar } from '@/components/ui/Toggle';
import { DataTable, DataTableBody, DataTableHead } from '@/components/ui/DataTable';
import { Dropdown, DropdownDivider, DropdownItem } from '@/components/ui/Dropdown';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgErrorBanner, OrgTableSkeleton } from '@/components/org/OrgScreenParts';
import { PageErrorState, PageLoadingState } from '@/components/org/PageState';
import { PayrollReviewDialog, type PayrollImpactState } from '@/components/payroll/PayrollReviewDialog';
import { SalaryStructureChangeModal } from '@/components/payroll/SalaryStructureChangeModal';
import { PayBreakdownTables } from '@/components/payroll/PayBreakdownTables';
import {
  formatPeriodList,
  lockedPeriodsIn,
  rangeFullyLocked,
  structurePayload,
  uniquePeriods,
  type StructureChange,
  type StructureFormMode,
  type StructureValue,
} from '@/lib/salary-structure-change';
import { useCompany } from '@/context/CompanyContext';
import { listEmployees } from '@/lib/employees-api';
import {
  createSalaryStructure,
  deleteSalaryStructure,
  getSalaryStructurePayrollLock,
  listPayComponents,
  listSalaryStructures,
  previewPayroll,
  reviseSalaryStructure,
  simulatePayroll,
  updateSalaryStructure,
} from '@/lib/payroll-api';
import {
  addDaysIso,
  componentTypeLabel,
  describeStructureValue,
  formatDate,
  formatMoney,
  payrollCopy,
  todayIso,
} from '@/lib/payroll-copy';
import { downloadCsvFile } from '@/lib/csv';
import { ApiError } from '@/lib/tenant-api-client';

const copy = payrollCopy.structures;
const reviewCopy = payrollCopy.structureReview;

type RowStatus = 'active' | 'scheduled' | 'ended';

const STATUS_TONE: Record<RowStatus, StatusPillTone> = {
  active: 'success',
  scheduled: 'accent',
  ended: 'neutral',
};

function rowStatus(row: SalaryStructureRecord, today: string): RowStatus {
  if (row.effectiveFrom > today) return 'scheduled';
  if (row.effectiveTo && row.effectiveTo < today) return 'ended';
  return 'active';
}

function clampDate(date: string, from: string, to: string | null): string {
  if (date < from) return from;
  if (to && date > to) return to;
  return date;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError || err instanceof Error ? err.message : fallback;
}

function valueOverride(
  value: StructureValue,
): Pick<PayrollSalaryStructureOverride, 'amount' | 'percentage' | 'payBasis'> {
  return {
    ...(value.amount !== undefined ? { amount: value.amount } : {}),
    ...(value.percentage !== undefined ? { percentage: value.percentage } : {}),
    ...(value.payBasis !== undefined ? { payBasis: value.payBasis } : {}),
  };
}

/** Where to measure the change and which hypothetical overrides represent it. */
function simulationFor(change: StructureChange, today: string): { asOf: string; overrides: PayrollSalaryStructureOverride[] } {
  switch (change.kind) {
    case 'add':
      return { asOf: change.effectiveFrom, overrides: [{ componentId: change.component.id, ...valueOverride(change.value) }] };
    case 'revise':
      return { asOf: change.effectiveFrom, overrides: [{ salaryStructureId: change.row.id, ...valueOverride(change.value) }] };
    case 'correct':
      return {
        asOf: clampDate(today, change.effectiveFrom, change.effectiveTo),
        overrides: [{ salaryStructureId: change.row.id, ...valueOverride(change.value) }],
      };
    case 'end':
      return { asOf: addDaysIso(change.endDate, 1), overrides: [{ salaryStructureId: change.row.id, remove: true }] };
    case 'delete':
      return {
        asOf: clampDate(today, change.row.effectiveFrom, change.row.effectiveTo),
        overrides: [{ salaryStructureId: change.row.id, remove: true }],
      };
  }
}

function formatValue(value: StructureValue, component: PayComponentRecord): string {
  const { amountOrFormula, payBasis } = structurePayload(value);
  return describeStructureValue(
    { amountOrFormula, payBasis, componentCalculationType: component.calculationType },
    component,
  );
}

export function SalaryStructurePage() {
  const { companyId, loading: companyLoading, error: companyError, refresh: refreshCompanies } = useCompany();
  const { can } = usePermissions();
  const canCreate = can('payroll', 'create');
  const canEdit = can('payroll', 'edit');
  const canDelete = can('payroll', 'delete');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('employee');
  const today = todayIso();

  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [components, setComponents] = useState<PayComponentRecord[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState('');

  const [rows, setRows] = useState<SalaryStructureRecord[]>([]);
  const [lock, setLock] = useState<SalaryStructurePayrollLock>({ lockedThrough: null, periods: [] });
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [asOf, setAsOf] = useState(today);
  const [preview, setPreview] = useState<PayrollCalculationPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [showEnded, setShowEnded] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const [formMode, setFormMode] = useState<StructureFormMode | null>(null);
  const [pendingChange, setPendingChange] = useState<StructureChange | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [impact, setImpact] = useState<PayrollImpactState | null>(null);

  const loadLists = useCallback(async () => {
    if (!companyId) return;
    setListLoading(true);
    setListError(null);
    try {
      const [employeeList, componentList] = await Promise.all([listEmployees(companyId), listPayComponents(companyId)]);
      setEmployees([...employeeList].sort((a, b) => a.fullName.localeCompare(b.fullName)));
      setComponents(componentList);
    } catch (err) {
      setListError(errorMessage(err, copy.loadError));
    } finally {
      setListLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  const loadDetail = useCallback(async () => {
    if (!selectedId) return;
    setDetailLoading(true);
    setDetailError(null);
    try {
      const [structureRows, lockInfo] = await Promise.all([
        listSalaryStructures(selectedId),
        getSalaryStructurePayrollLock(selectedId),
      ]);
      setRows(structureRows);
      setLock(lockInfo);
    } catch (err) {
      setDetailError(errorMessage(err, copy.loadError));
    } finally {
      setDetailLoading(false);
    }
  }, [selectedId]);

  const loadPreview = useCallback(async () => {
    if (!selectedId || !asOf) return;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      setPreview(await previewPayroll(selectedId, asOf));
    } catch (err) {
      setPreview(null);
      setPreviewError(errorMessage(err, copy.previewError));
    } finally {
      setPreviewLoading(false);
    }
  }, [selectedId, asOf]);

  useEffect(() => {
    setRows([]);
    setPreview(null);
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const componentsById = useMemo(() => new Map(components.map((c) => [c.id, c])), [components]);
  const selectedEmployee = employees.find((e) => e.id === selectedId) ?? null;

  const filteredEmployees = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) => e.fullName.toLowerCase().includes(q) || e.employeeNumber.toLowerCase().includes(q),
    );
  }, [employees, employeeSearch]);

  const visibleRows = useMemo(() => {
    const list = showEnded ? rows : rows.filter((r) => rowStatus(r, today) !== 'ended');
    const order: Record<RowStatus, number> = { active: 0, scheduled: 1, ended: 2 };
    return [...list].sort((a, b) => {
      const typeCmp = a.componentType.localeCompare(b.componentType);
      if (typeCmp) return typeCmp;
      const statusCmp = order[rowStatus(a, today)] - order[rowStatus(b, today)];
      if (statusCmp) return statusCmp;
      return b.effectiveFrom.localeCompare(a.effectiveFrom);
    });
  }, [rows, showEnded, today]);

  const selectEmployee = (id: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('employee', id);
      return next;
    });
    setAsOf(todayIso());
  };

  const touchesLock = (row: SalaryStructureRecord) =>
    lockedPeriodsIn(lock.periods, row.effectiveFrom, row.effectiveTo).length > 0;
  const fullyLocked = (row: SalaryStructureRecord) =>
    rangeFullyLocked(lock.periods, row.effectiveFrom, row.effectiveTo);

  const openForm = (mode: StructureFormMode) => {
    setPendingChange(null);
    setFormMode(mode);
  };

  const startReview = async (change: StructureChange) => {
    if (!selectedId) return;
    setPendingChange(change);
    setFormMode(null);
    setReviewOpen(true);
    const { asOf: impactDate, overrides } = simulationFor(change, today);
    setImpact({ status: 'loading', asOf: impactDate });
    try {
      const result = await simulatePayroll(selectedId, { asOf: impactDate, structureOverrides: overrides });
      setImpact({ status: 'ready', asOf: impactDate, result });
    } catch (err) {
      setImpact({ status: 'error', asOf: impactDate, message: errorMessage(err, copy.previewError) });
    }
  };

  const backToForm = () => {
    if (!pendingChange || pendingChange.kind === 'delete') return;
    setReviewOpen(false);
    setFormMode(pendingChange.kind === 'add' ? { kind: 'add' } : { kind: pendingChange.kind, row: pendingChange.row });
  };

  const closeReview = () => {
    setReviewOpen(false);
    setPendingChange(null);
    setImpact(null);
  };

  const commitChange = async () => {
    if (!selectedId || !pendingChange) return;
    const change = pendingChange;
    switch (change.kind) {
      case 'add':
        await createSalaryStructure(selectedId, {
          componentId: change.component.id,
          componentType: change.component.type,
          ...structurePayload(change.value),
          effectiveFrom: change.effectiveFrom,
          effectiveTo: change.effectiveTo,
        });
        break;
      case 'revise':
        await reviseSalaryStructure(selectedId, change.row.id, {
          ...structurePayload(change.value),
          effectiveFrom: change.effectiveFrom,
        });
        break;
      case 'correct':
        await updateSalaryStructure(selectedId, change.row.id, {
          ...structurePayload(change.value),
          effectiveFrom: change.effectiveFrom,
          effectiveTo: change.effectiveTo,
        });
        break;
      case 'end':
        await updateSalaryStructure(selectedId, change.row.id, { effectiveTo: change.endDate });
        break;
      case 'delete':
        await deleteSalaryStructure(selectedId, change.row.id);
        break;
    }
    closeReview();
    setNotice(copy.saved);
    await Promise.all([loadDetail(), loadPreview(), loadLists()]);
  };

  const retroPeriods = useMemo(() => {
    if (!pendingChange) return [];
    if (pendingChange.kind === 'add') {
      return uniquePeriods(lockedPeriodsIn(lock.periods, pendingChange.effectiveFrom, pendingChange.effectiveTo));
    }
    if (pendingChange.kind === 'revise') {
      return uniquePeriods(lockedPeriodsIn(lock.periods, pendingChange.effectiveFrom, pendingChange.row.effectiveTo));
    }
    return [];
  }, [pendingChange, lock.periods]);

  const exportCsv = () => {
    if (!selectedEmployee) return;
    downloadCsvFile(
      `salary-structure-${selectedEmployee.employeeNumber}.csv`,
      ['Employee ID', 'Employee', copy.colComponent, 'Type', 'Calculation', copy.colValue, 'Amount', 'Paid', 'Rate (%)', copy.colFrom, copy.colTo, copy.colStatus],
      visibleRows.map((row) => {
        const component = componentsById.get(row.componentId);
        return [
          selectedEmployee.employeeNumber,
          selectedEmployee.fullName,
          row.componentName ?? component?.name ?? '',
          componentTypeLabel(row.componentType),
          row.componentCalculationType ? payrollCopy.calcType[row.componentCalculationType] : '',
          describeStructureValue(row, component),
          row.amountOrFormula.amount ?? '',
          row.componentCalculationType === 'fixed' ? payrollCopy.payBasis[row.payBasis] : '',
          row.amountOrFormula.percentage ?? '',
          row.effectiveFrom,
          row.effectiveTo ?? '',
          rowStatusLabel(rowStatus(row, today)),
        ];
      }),
    );
  };

  if (companyLoading) return <PageLoadingState />;
  if (companyError) return <PageErrorState error={companyError} onRetry={() => void refreshCompanies()} />;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted uppercase tracking-wide">{payrollCopy.common.eyebrow}</p>
          <h1 className="text-xl font-bold text-primary">{copy.title}</h1>
          <p className="text-sm text-secondary mt-0.5 max-w-3xl">{copy.description}</p>
        </div>
        <CompanySelector />
      </div>

      {notice ? (
        <div
          role="status"
          className="flex items-center gap-2 text-sm text-success-700 dark:text-success-300 bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-lg px-4 py-2.5"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {notice}
        </div>
      ) : null}

      {listError ? <OrgErrorBanner message={listError} onRetry={() => void loadLists()} /> : null}

      <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-6 items-start">
        <Card className="overflow-hidden lg:sticky lg:top-4">
          <div className="px-4 py-3 border-b border-base space-y-2">
            <div className="text-sm font-semibold text-primary">
              {copy.employees}
              {!listLoading ? <span className="text-muted font-normal"> ({employees.length})</span> : null}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <Input
                type="search"
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                placeholder={copy.searchEmployees}
                aria-label={copy.searchEmployees}
                className="pl-9 h-9"
              />
            </div>
          </div>
          <div className="max-h-[60vh] lg:max-h-[calc(100vh-240px)] overflow-y-auto scrollbar-thin">
            {listLoading ? (
              <div className="p-3 space-y-3" aria-busy="true">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : employees.length === 0 ? (
              <EmptyState compact icon={UserRound} title={copy.noEmployeesTitle} description={copy.noEmployeesDescription} />
            ) : filteredEmployees.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted text-center">{copy.noEmployeeMatch}</p>
            ) : (
              <ul role="listbox" aria-label={copy.employees}>
                {filteredEmployees.map((employee) => {
                  const selected = employee.id === selectedId;
                  return (
                    <li key={employee.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => selectEmployee(employee.id)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors border-l-2 ${
                          selected
                            ? 'bg-accent-50 dark:bg-accent-950/40 border-accent-600'
                            : 'border-transparent hover:bg-[rgb(var(--bg-hover))]'
                        }`}
                      >
                        <Avatar name={employee.fullName} size="sm" />
                        <div className="min-w-0">
                          <div className={`text-sm truncate ${selected ? 'font-semibold text-primary' : 'text-primary'}`}>
                            {employee.fullName}
                          </div>
                          <div className="text-xs text-muted truncate">
                            {employee.employeeNumber}
                            {employee.designation?.name ? ` · ${employee.designation.name}` : ''}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        <div className="space-y-6 min-w-0">
          {!selectedId ? (
            <Card>
              <EmptyState icon={Wallet} title={copy.selectTitle} description={copy.selectDescription} />
            </Card>
          ) : (
            <>
              <Card className="p-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={selectedEmployee?.fullName ?? '?'} size="lg" />
                    <div className="min-w-0">
                      <div className="text-lg font-semibold text-primary truncate">
                        {selectedEmployee?.fullName ?? <Skeleton className="h-5 w-40" />}
                      </div>
                      <div className="text-sm text-secondary truncate">
                        {[selectedEmployee?.employeeNumber, selectedEmployee?.designation?.name, selectedEmployee?.department?.name]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-secondary">
                    <CalendarClock className="h-4 w-4" />
                    {copy.asOf}
                    <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="h-9 w-auto" />
                  </label>
                </div>

                {lock.periods.length > 0 ? (
                  <div className="mt-4 flex items-start gap-2 rounded-lg bg-[rgb(var(--bg-muted))] px-3 py-2.5 text-sm text-secondary">
                    <Lock className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{copy.lockBanner(formatPeriodList(lock.periods))}</span>
                  </div>
                ) : null}

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <SummaryTile label={copy.gross} value={preview?.grossPay} loading={previewLoading} />
                  <SummaryTile label={copy.totalDeductions} value={preview?.totalDeductions} loading={previewLoading} />
                  <SummaryTile label={copy.net} value={preview?.netPay} loading={previewLoading} emphasis />
                </div>

                {previewError ? (
                  <div className="mt-4">
                    <OrgErrorBanner message={`${copy.previewError} ${previewError}`} onRetry={() => void loadPreview()} />
                  </div>
                ) : preview && !previewLoading ? (
                  <Breakdown preview={preview} />
                ) : null}
              </Card>

              <Card className="overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-5 py-4 border-b border-base">
                  <div>
                    <h2 className="text-sm font-semibold text-primary">{copy.assignments}</h2>
                    <p className="text-xs text-secondary mt-0.5">{copy.assignmentsHint}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-xs text-secondary cursor-pointer select-none mr-1">
                      <input
                        type="checkbox"
                        checked={showEnded}
                        onChange={(e) => setShowEnded(e.target.checked)}
                        className="h-4 w-4 rounded border-base accent-accent-600"
                      />
                      {copy.showEnded}
                    </label>
                    <Button variant="secondary" size="sm" onClick={exportCsv} disabled={visibleRows.length === 0}>
                      <Download className="h-4 w-4" /> {payrollCopy.common.exportCsv}
                    </Button>
                    {canCreate ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => openForm({ kind: 'add' })}
                        disabled={components.length === 0 || detailLoading}
                      >
                        <Plus className="h-4 w-4" /> {copy.addComponent}
                      </Button>
                    ) : null}
                  </div>
                </div>

                {detailError ? (
                  <div className="p-5">
                    <OrgErrorBanner message={detailError} onRetry={() => void loadDetail()} />
                  </div>
                ) : detailLoading ? (
                  <OrgTableSkeleton columns={5} rows={4} />
                ) : components.length === 0 && rows.length === 0 ? (
                  <EmptyState
                    compact
                    icon={Layers}
                    title={copy.noComponentsTitle}
                    description={copy.noComponentsDescription}
                    action={{ label: copy.goToComponents, onClick: () => navigate('/payroll/salary-components') }}
                  />
                ) : rows.length === 0 ? (
                  <EmptyState
                    compact
                    icon={TrendingUp}
                    title={copy.emptyTitle}
                    description={copy.emptyDescription}
                    action={canCreate ? { label: copy.addComponent, onClick: () => openForm({ kind: 'add' }), icon: Plus } : undefined}
                  />
                ) : (
                  <DataTable className="max-h-[60vh] overflow-y-auto">
                    <DataTableHead>
                      <tr className="text-xs font-semibold text-secondary uppercase tracking-wide">
                        <th className="text-left px-5 py-3">{copy.colComponent}</th>
                        <th className="text-right px-5 py-3">{copy.colValue}</th>
                        <th className="text-left px-5 py-3">{copy.colFrom}</th>
                        <th className="text-left px-5 py-3">{copy.colTo}</th>
                        <th className="text-left px-5 py-3">{copy.colStatus}</th>
                        <th className="px-5 py-3 w-12">
                          <span className="sr-only">{payrollCopy.common.actions}</span>
                        </th>
                      </tr>
                    </DataTableHead>
                    <DataTableBody>
                      {visibleRows.map((row) => {
                        const component = componentsById.get(row.componentId);
                        const status = rowStatus(row, today);
                        const locked = touchesLock(row);
                        const readOnly = fullyLocked(row);
                        return (
                          <tr
                            key={row.id}
                            className={
                              readOnly
                                ? 'bg-[rgb(var(--bg-muted))]/60 text-muted'
                                : 'hover:bg-[rgb(var(--bg-hover))] transition-colors'
                            }
                          >
                            <td className="px-5 py-3">
                              <div className={`font-medium flex items-center gap-1.5 ${readOnly ? 'text-secondary' : 'text-primary'}`}>
                                {row.componentName ?? component?.name}
                                {locked ? (
                                  <span title={copy.lockedRowHint} className="inline-flex">
                                    <Lock className="h-3.5 w-3.5 text-muted" aria-label={copy.locked} />
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-xs text-muted">
                                {componentTypeLabel(row.componentType)}
                                {row.componentCalculationType ? ` · ${payrollCopy.calcType[row.componentCalculationType]}` : ''}
                              </div>
                            </td>
                            <td className={`px-5 py-3 text-right tabular-nums ${readOnly ? '' : 'text-primary font-medium'}`}>
                              {describeStructureValue(row, component)}
                            </td>
                            <td className="px-5 py-3 whitespace-nowrap">{formatDate(row.effectiveFrom)}</td>
                            <td className="px-5 py-3 whitespace-nowrap">
                              {row.effectiveTo ? formatDate(row.effectiveTo) : <span className="text-muted">{copy.openEnded}</span>}
                            </td>
                            <td className="px-5 py-3">
                              <StatusPill tone={STATUS_TONE[status]}>{rowStatusLabel(status)}</StatusPill>
                            </td>
                            <td className="px-5 py-3 text-right">
                              {component ? (
                                <RowActions
                                  row={row}
                                  status={status}
                                  locked={locked}
                                  calculationType={component.calculationType}
                                  canEdit={canEdit}
                                  canDelete={canDelete}
                                  onRevise={() => openForm({ kind: 'revise', row })}
                                  onCorrect={() => openForm({ kind: 'correct', row })}
                                  onEnd={() => openForm({ kind: 'end', row })}
                                  onDelete={() => void startReview({ kind: 'delete', row, component })}
                                />
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </DataTableBody>
                  </DataTable>
                )}
              </Card>
            </>
          )}
        </div>
      </div>

      {formMode ? (
        <SalaryStructureChangeModal
          open
          mode={formMode}
          employeeName={selectedEmployee?.fullName ?? ''}
          components={components}
          rows={rows}
          lockedPeriods={lock.periods}
          previous={pendingChange}
          onClose={() => {
            setFormMode(null);
            setPendingChange(null);
          }}
          onReview={(change) => void startReview(change)}
        />
      ) : null}

      <PayrollReviewDialog
        open={reviewOpen && pendingChange !== null}
        title={reviewCopy.title}
        intro={reviewCopy.intro}
        impact={impact}
        retroPeriods={retroPeriods}
        tone={pendingChange?.kind === 'delete' ? 'danger' : 'primary'}
        confirmLabel={pendingChange?.kind === 'delete' ? reviewCopy.confirmDelete : reviewCopy.confirm}
        onBack={pendingChange && pendingChange.kind !== 'delete' ? backToForm : undefined}
        onClose={closeReview}
        onConfirm={commitChange}
      >
        {pendingChange ? <ChangeSummary change={pendingChange} employee={selectedEmployee} /> : null}
      </PayrollReviewDialog>
    </div>
  );
}

function rowStatusLabel(status: RowStatus): string {
  return status === 'active' ? copy.statusActive : status === 'scheduled' ? copy.statusScheduled : copy.statusEnded;
}

function RowActions({
  row,
  status,
  locked,
  calculationType,
  canEdit,
  canDelete,
  onRevise,
  onCorrect,
  onEnd,
  onDelete,
}: {
  row: SalaryStructureRecord;
  status: RowStatus;
  locked: boolean;
  calculationType: PayComponentRecord['calculationType'];
  canEdit: boolean;
  canDelete: boolean;
  onRevise: () => void;
  onCorrect: () => void;
  onEnd: () => void;
  onDelete: () => void;
}) {
  const ended = status === 'ended';
  const canRevise = canEdit && !ended && calculationType !== 'formula';
  const canEnd = canEdit && !ended;
  if (!canEdit && !canDelete) return null;

  return (
    <Dropdown
      width="w-72"
      trigger={
        <button
          type="button"
          aria-label={`${payrollCopy.common.actions}: ${row.componentName ?? ''}`}
          className="text-muted hover:text-primary p-1 rounded hover:bg-[rgb(var(--bg-muted))] transition-colors"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      }
    >
      {canRevise ? (
        <DropdownItem icon={<TrendingUp className="h-4 w-4" />} onClick={onRevise} description={copy.actionReviseHint}>
          {copy.actionRevise}
        </DropdownItem>
      ) : null}
      {canEdit ? (
        <DropdownItem
          icon={<Pencil className="h-4 w-4" />}
          onClick={onCorrect}
          disabled={locked}
          description={locked ? copy.correctLockedReason : copy.actionCorrectHint}
        >
          {copy.actionCorrect}
        </DropdownItem>
      ) : null}
      {canEnd ? (
        <DropdownItem icon={<StopCircle className="h-4 w-4" />} onClick={onEnd}>
          {copy.actionEnd}
        </DropdownItem>
      ) : null}
      {canDelete ? (
        <>
          {canEdit ? <DropdownDivider /> : null}
          <DropdownItem
            icon={<Trash2 className="h-4 w-4" />}
            onClick={onDelete}
            disabled={locked}
            description={locked ? copy.deleteLockedReason : undefined}
          >
            {copy.actionDelete}
          </DropdownItem>
        </>
      ) : null}
    </Dropdown>
  );
}

function SummaryTile({
  label,
  value,
  loading,
  emphasis = false,
}: {
  label: string;
  value: string | undefined;
  loading: boolean;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        emphasis ? 'border-accent-200 dark:border-accent-800 bg-accent-50/60 dark:bg-accent-950/30' : 'border-base'
      }`}
    >
      <div className="text-xs text-secondary">{label}</div>
      {loading ? (
        <Skeleton className="h-7 w-28 mt-1" />
      ) : (
        <div className={`mt-0.5 tabular-nums font-bold ${emphasis ? 'text-2xl text-accent-700 dark:text-accent-300' : 'text-xl text-primary'}`}>
          {formatMoney(value ?? null)}
        </div>
      )}
    </div>
  );
}

function Breakdown({ preview }: { preview: PayrollCalculationPreview }) {
  if (preview.earnings.length === 0 && preview.deductions.length === 0) {
    return <p className="mt-5 text-sm text-muted">{copy.breakdownEmpty}</p>;
  }

  return (
    <div className="mt-5">
      <h3 className="text-xs font-semibold text-secondary uppercase tracking-wide mb-2">
        {copy.breakdown(formatDate(preview.asOfDate))}
      </h3>
      <PayBreakdownTables preview={preview} />
    </div>
  );
}

function ChangeSummary({ change, employee }: { change: StructureChange; employee: EmployeeRecord | null }) {
  const name = change.component.name;
  let headline: string;
  const details: string[] = [];
  let effective: string;

  switch (change.kind) {
    case 'add':
      headline = reviewCopy.describeAdd(name, formatValue(change.value, change.component));
      effective = `${formatDate(change.effectiveFrom)} – ${change.effectiveTo ? formatDate(change.effectiveTo) : copy.openEnded}`;
      break;
    case 'revise':
      headline = reviewCopy.describeRevise(
        name,
        describeStructureValue(change.row, change.component),
        formatValue(change.value, change.component),
      );
      effective = formatDate(change.effectiveFrom);
      break;
    case 'correct': {
      headline = reviewCopy.describeCorrect(name);
      const before = describeStructureValue(change.row, change.component);
      const after = formatValue(change.value, change.component);
      if (before !== after) details.push(reviewCopy.detailValue(before, after));
      const oldRange = `${formatDate(change.row.effectiveFrom)} – ${change.row.effectiveTo ? formatDate(change.row.effectiveTo) : copy.openEnded}`;
      const newRange = `${formatDate(change.effectiveFrom)} – ${change.effectiveTo ? formatDate(change.effectiveTo) : copy.openEnded}`;
      if (oldRange !== newRange) details.push(reviewCopy.detailDates(oldRange, newRange));
      effective = newRange;
      break;
    }
    case 'end':
      headline = reviewCopy.describeEnd(name, formatDate(change.endDate));
      effective = formatDate(addDaysIso(change.endDate, 1));
      break;
    case 'delete':
      headline = reviewCopy.describeDelete(name);
      effective = `${formatDate(change.row.effectiveFrom)} – ${change.row.effectiveTo ? formatDate(change.row.effectiveTo) : copy.openEnded}`;
      break;
  }

  return (
    <dl className="rounded-lg border border-base divide-y divide-[rgb(var(--border-base))] text-sm">
      <div className="flex gap-4 px-4 py-2.5">
        <dt className="w-28 shrink-0 text-secondary">{reviewCopy.employee}</dt>
        <dd className="text-primary font-medium">
          {employee ? `${employee.fullName} (${employee.employeeNumber})` : payrollCopy.common.none}
        </dd>
      </div>
      <div className="flex gap-4 px-4 py-2.5">
        <dt className="w-28 shrink-0 text-secondary">{reviewCopy.change}</dt>
        <dd className="min-w-0">
          <div className="text-primary font-semibold break-words">{headline}</div>
          {details.map((detail) => (
            <div key={detail} className="text-secondary text-xs mt-0.5">
              {detail}
            </div>
          ))}
        </dd>
      </div>
      <div className="flex gap-4 px-4 py-2.5">
        <dt className="w-28 shrink-0 text-secondary">{reviewCopy.effective}</dt>
        <dd className="text-primary">{effective}</dd>
      </div>
    </dl>
  );
}
