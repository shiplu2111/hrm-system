import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, Download, FlaskConical, RotateCcw, Trash2, Undo2, UserRound, X } from 'lucide-react';
import type {
  EmployeeRecord,
  PayComponentRecord,
  PayrollCalculationLine,
  PayrollSimulationResult,
  SalaryPayBasis,
} from '@hrm/shared-types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Form';
import { FieldError } from '@/components/ui/FieldError';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusPill } from '@/components/ui/StatusPill';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgErrorBanner } from '@/components/org/OrgScreenParts';
import { PageErrorState, PageLoadingState } from '@/components/org/PageState';
import { SimulationBanner } from '@/components/payroll/SimulationBanner';
import { SimulationResults } from '@/components/payroll/SimulationResults';
import { useCompany } from '@/context/CompanyContext';
import { listEmployees } from '@/lib/employees-api';
import { listPayComponents, simulatePayroll } from '@/lib/payroll-api';
import {
  addedKey,
  attendanceKey,
  buildRequest,
  changeCount,
  compareLines,
  componentKind,
  currentValue,
  editKey,
  emptyDraft,
  lineKind,
  nextAddedKey,
  validateDraft,
  type AttendanceDraft,
  type DraftErrors,
  type SimulationDraft,
  type ValueKind,
} from '@/lib/payroll-simulation';
import { simulationCopy as copy } from '@/lib/payroll-simulation-copy';
import { fromCents, monthName } from '@/lib/payroll-run-flow';
import { componentTypeLabel, formatMoney, formatRate, todayIso } from '@/lib/payroll-copy';
import { downloadCsvFile } from '@/lib/csv';
import { ApiError } from '@/lib/tenant-api-client';

const SIMULATE_DELAY_MS = 350;

interface SimState {
  result: PayrollSimulationResult | null;
  loading: boolean;
  error: string | null;
}

const editedField = 'border-dashed border-warning-400 bg-warning-50/50 dark:bg-warning-950/20';

function errorMessage(error: DraftErrors[string] | undefined): string | undefined {
  switch (error) {
    case 'money':
      return copy.lines.errors.money;
    case 'percentage':
      return copy.lines.errors.percentage;
    case 'required':
      return copy.lines.errors.required;
    case 'days':
      return copy.attendance.errors.days;
    case 'hours':
      return copy.attendance.errors.hours;
    default:
      return undefined;
  }
}

function valueLabel(kind: ValueKind): string {
  switch (kind) {
    case 'percentage':
      return copy.lines.percentage;
    case 'rate_day':
      return copy.lines.ratePerDay;
    case 'rate_hour':
      return copy.lines.ratePerHour;
    default:
      return copy.lines.amount;
  }
}

function formatValue(kind: ValueKind, value: string | null): string {
  if (value === null) return '—';
  return kind === 'percentage' ? `${formatRate(Number(value))}%` : formatMoney(value);
}

export function PayrollSimulationPage() {
  const { companyId, loading: companyLoading, error: companyError, refresh: refreshCompanies } = useCompany();
  const [searchParams, setSearchParams] = useSearchParams();
  const employeeId = searchParams.get('employee') ?? '';

  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [components, setComponents] = useState<PayComponentRecord[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [asOf, setAsOf] = useState(todayIso);
  const [draft, setDraft] = useState<SimulationDraft>(emptyDraft);
  const [sim, setSim] = useState<SimState>({ result: null, loading: false, error: null });
  const requestSeq = useRef(0);

  useEffect(() => {
    if (!companyId) return undefined;
    let cancelled = false;
    setListLoading(true);
    setListError(null);
    Promise.all([listEmployees(companyId), listPayComponents(companyId)])
      .then(([nextEmployees, nextComponents]) => {
        if (cancelled) return;
        setEmployees([...nextEmployees].sort((a, b) => a.fullName.localeCompare(b.fullName)));
        setComponents(nextComponents);
      })
      .catch((err: unknown) => !cancelled && setListError(err instanceof ApiError ? err.message : copy.setup.loadError))
      .finally(() => !cancelled && setListLoading(false));
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const baselineLines = useMemo<PayrollCalculationLine[]>(
    () => (sim.result ? [...sim.result.baseline.earnings, ...sim.result.baseline.deductions] : []),
    [sim.result],
  );
  const errors = useMemo(() => validateDraft(draft, baselineLines, components), [draft, baselineLines, components]);
  const valid = Object.keys(errors).length === 0;
  const request = useMemo(
    () => buildRequest(draft, baselineLines, components, asOf),
    [draft, baselineLines, components, asOf],
  );
  const requestKey = JSON.stringify(request);
  const changes = changeCount(draft, baselineLines);
  const selectedEmployee = employees.find((employee) => employee.id === employeeId) ?? null;

  useEffect(() => {
    if (!employeeId || !valid || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
      requestSeq.current += 1;
      setSim((prev) => (prev.loading ? { ...prev, loading: false } : prev));
      return undefined;
    }
    const seq = ++requestSeq.current;
    setSim((prev) => ({ ...prev, loading: true, error: null }));
    const timer = window.setTimeout(() => {
      simulatePayroll(employeeId, JSON.parse(requestKey) as typeof request)
        .then((result) => seq === requestSeq.current && setSim({ result, loading: false, error: null }))
        .catch(
          (err: unknown) =>
            seq === requestSeq.current &&
            setSim((prev) => ({
              ...prev,
              loading: false,
              error: err instanceof ApiError || err instanceof Error ? err.message : copy.results.error,
            })),
        );
    }, SIMULATE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [employeeId, requestKey, valid, asOf]);

  const selectEmployee = (id: string) => {
    requestSeq.current += 1;
    setDraft(emptyDraft());
    setSim({ result: null, loading: false, error: null });
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('employee', id);
        else next.delete('employee');
        return next;
      },
      { replace: true },
    );
  };

  const setEdit = (id: string, patch: Partial<{ value: string; remove: boolean }>) =>
    setDraft((prev) => {
      const current = prev.edits[id] ?? { value: '', remove: false };
      return { ...prev, edits: { ...prev.edits, [id]: { ...current, ...patch } } };
    });

  const setAttendance = (field: keyof AttendanceDraft, value: string) =>
    setDraft((prev) => ({ ...prev, attendance: { ...prev.attendance, [field]: value } }));

  const addComponent = (componentId: string) => {
    if (!componentId) return;
    setDraft((prev) => ({
      ...prev,
      added: [...prev.added, { key: nextAddedKey(), componentId, value: '', payBasis: 'monthly' }],
    }));
  };

  const updateAdded = (key: string, patch: Partial<{ value: string; payBasis: SalaryPayBasis }>) =>
    setDraft((prev) => ({
      ...prev,
      added: prev.added.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    }));

  const removeAdded = (key: string) =>
    setDraft((prev) => ({ ...prev, added: prev.added.filter((line) => line.key !== key) }));

  const addable = components.filter(
    (component) =>
      !baselineLines.some((line) => line.componentId === component.id) &&
      !draft.added.some((line) => line.componentId === component.id),
  );

  const exportCsv = () => {
    if (!sim.result || !selectedEmployee) return;
    const { baseline, simulated } = sim.result;
    const rows = compareLines(baseline, simulated).map((line) => [
      line.name,
      componentTypeLabel(line.type),
      line.current ?? '',
      line.projected ?? '',
      fromCents(line.diffCents),
    ]);
    downloadCsvFile(
      `simulation-${selectedEmployee.employeeNumber}-${sim.result.asOfDate}.csv`,
      ['Component', 'Type', copy.results.current, copy.results.projected, copy.results.difference],
      [
        [copy.results.exportBanner, `${selectedEmployee.fullName} (${selectedEmployee.employeeNumber})`, sim.result.asOfDate, '', ''],
        ...rows,
        [copy.results.gross, '', baseline.grossPay, simulated.grossPay, ''],
        [copy.results.deductions, '', baseline.totalDeductions, simulated.totalDeductions, ''],
        [copy.results.net, '', baseline.netPay, simulated.netPay, ''],
      ],
    );
  };

  if (companyLoading) return <PageLoadingState />;
  if (companyError) return <PageErrorState error={companyError} onRetry={() => void refreshCompanies()} />;

  const recorded = sim.result?.attendance.baseline ?? null;
  const attendanceMonth = recorded ? monthName(recorded.periodStart) : /^\d{4}-\d{2}/.test(asOf) ? monthName(asOf) : '';
  const usesAttendance = baselineLines.some((line) => lineKind(line) !== 'amount' && lineKind(line) !== 'percentage');

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-[1400px] mx-auto">
      <SimulationBanner />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-warning-700 dark:text-warning-300 uppercase tracking-wide inline-flex items-center gap-1.5">
            <FlaskConical className="h-3.5 w-3.5" aria-hidden /> {copy.eyebrow}
          </p>
          <h1 className="text-xl font-bold text-primary">{copy.title}</h1>
          <p className="text-sm text-secondary mt-0.5 max-w-2xl">{copy.description}</p>
        </div>
        <CompanySelector />
      </div>

      {listError ? <OrgErrorBanner message={listError} /> : null}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-5 items-start">
        <div className="space-y-5 min-w-0">
          <Card className="p-5 border-dashed">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sim-employee">{copy.setup.employee}</Label>
                {listLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select id="sim-employee" value={employeeId} onChange={(e) => selectEmployee(e.target.value)}>
                    <option value="">{copy.setup.chooseEmployee}</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.fullName} ({employee.employeeNumber})
                      </option>
                    ))}
                  </Select>
                )}
              </div>
              <div>
                <Label htmlFor="sim-asof">{copy.setup.asOf}</Label>
                <Input id="sim-asof" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
              </div>
            </div>
            {attendanceMonth ? <p className="mt-2 text-xs text-muted">{copy.setup.asOfHint(attendanceMonth)}</p> : null}
            {employeeId ? (
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-xs text-secondary">{copy.setup.changes(changes)}</span>
                <Button variant="ghost" size="sm" onClick={() => setDraft(emptyDraft())} disabled={changes === 0}>
                  <RotateCcw className="h-3.5 w-3.5" /> {copy.setup.reset}
                </Button>
              </div>
            ) : null}
          </Card>

          {!listLoading && employees.length === 0 ? (
            <Card className="border-dashed">
              <EmptyState icon={UserRound} title={copy.setup.noEmployeesTitle} description={copy.setup.noEmployeesDescription} />
            </Card>
          ) : employeeId ? (
            <>
              <Card className="p-5 border-dashed">
                <h2 className="text-sm font-semibold text-primary">{copy.lines.title}</h2>
                <p className="text-xs text-secondary mt-0.5 mb-4">{copy.lines.hint}</p>

                {!sim.result ? (
                  <div className="space-y-3" aria-busy="true">
                    {[0, 1, 2].map((i) => (
                      <Skeleton key={i} className="h-14 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {baselineLines.length === 0 ? <p className="text-sm text-muted">{copy.lines.empty}</p> : null}
                    {baselineLines.map((line) => {
                      const kind = lineKind(line);
                      const edit = draft.edits[line.salaryStructureId];
                      const removed = edit?.remove ?? false;
                      const value = edit?.value ?? '';
                      const fieldError = errorMessage(errors[editKey(line.salaryStructureId)]);
                      const inputId = `sim-line-${line.salaryStructureId}`;
                      return (
                        <div
                          key={line.salaryStructureId}
                          className={`rounded-lg border px-3 py-2.5 ${
                            removed ? 'border-dashed border-base opacity-60' : value ? 'border-warning-300 dark:border-warning-700' : 'border-base'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <div className={`text-sm font-medium text-primary ${removed ? 'line-through' : ''}`}>{line.componentName}</div>
                              <div className="text-xs text-muted">
                                {componentTypeLabel(line.componentType)} · {copy.lines.current(formatValue(kind, currentValue(line)))}
                              </div>
                            </div>
                            {kind !== 'formula' ? (
                              <div className="w-36 shrink-0">
                                <label htmlFor={inputId} className="sr-only">
                                  {`${line.componentName}: ${valueLabel(kind)}`}
                                </label>
                                <Input
                                  id={inputId}
                                  inputMode="decimal"
                                  placeholder={currentValue(line) ?? ''}
                                  value={value}
                                  disabled={removed}
                                  onChange={(e) => setEdit(line.salaryStructureId, { value: e.target.value })}
                                  aria-invalid={Boolean(fieldError)}
                                  className={`h-9 text-right tabular-nums ${value ? editedField : ''}`}
                                />
                                <div className="text-2xs text-muted text-right mt-0.5">{valueLabel(kind)}</div>
                              </div>
                            ) : null}
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={removed ? copy.lines.restore(line.componentName) : copy.lines.remove(line.componentName)}
                              title={removed ? copy.lines.restore(line.componentName) : copy.lines.remove(line.componentName)}
                              onClick={() => setEdit(line.salaryStructureId, { remove: !removed })}
                            >
                              {removed ? <Undo2 className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </div>
                          {kind === 'formula' && !removed ? (
                            <p className="text-xs text-muted mt-1">{line.formulaDescription ?? copy.lines.formula}</p>
                          ) : null}
                          {removed ? <p className="text-xs text-muted mt-1">{copy.lines.removed}</p> : null}
                          <FieldError message={fieldError} />
                        </div>
                      );
                    })}

                    {draft.added.map((added) => {
                      const component = components.find((c) => c.id === added.componentId);
                      if (!component) return null;
                      const kind = componentKind(component, added.payBasis);
                      const fieldError = errorMessage(errors[addedKey(added.key)]);
                      const inputId = `sim-added-${added.key}`;
                      return (
                        <div
                          key={added.key}
                          className="rounded-lg border-2 border-dashed border-warning-300 dark:border-warning-700 px-3 py-2.5 simulation-hatch"
                        >
                          <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-primary truncate">{component.name}</span>
                                <StatusPill tone="warning">{copy.lines.added}</StatusPill>
                              </div>
                              <div className="text-xs text-muted">{componentTypeLabel(component.type)}</div>
                              {component.calculationType === 'fixed' ? (
                                <div className="mt-2 w-44">
                                  <label htmlFor={`${inputId}-basis`} className="sr-only">
                                    {copy.lines.basis}
                                  </label>
                                  <Select
                                    id={`${inputId}-basis`}
                                    value={added.payBasis}
                                    onChange={(e) => updateAdded(added.key, { payBasis: e.target.value as SalaryPayBasis })}
                                    className="h-8 py-1 text-xs"
                                  >
                                    {(['monthly', 'daily', 'hourly'] as const).map((basis) => (
                                      <option key={basis} value={basis}>
                                        {copy.lines.basisOptions[basis]}
                                      </option>
                                    ))}
                                  </Select>
                                </div>
                              ) : null}
                            </div>
                            {kind !== 'formula' ? (
                              <div className="w-36 shrink-0">
                                <label htmlFor={inputId} className="sr-only">
                                  {`${component.name}: ${valueLabel(kind)}`}
                                </label>
                                <Input
                                  id={inputId}
                                  inputMode="decimal"
                                  value={added.value}
                                  onChange={(e) => updateAdded(added.key, { value: e.target.value })}
                                  aria-invalid={Boolean(fieldError)}
                                  className={`h-9 text-right tabular-nums ${editedField}`}
                                />
                                <div className="text-2xs text-muted text-right mt-0.5">{valueLabel(kind)}</div>
                              </div>
                            ) : null}
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={copy.lines.removeAdded(component.name)}
                              title={copy.lines.removeAdded(component.name)}
                              onClick={() => removeAdded(added.key)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          {kind === 'formula' ? <p className="text-xs text-muted mt-1">{copy.lines.formula}</p> : null}
                          <FieldError message={fieldError} />
                        </div>
                      );
                    })}

                    {addable.length > 0 ? (
                      <div>
                        <label htmlFor="sim-add" className="sr-only">
                          {copy.lines.addTitle}
                        </label>
                        <Select id="sim-add" value="" onChange={(e) => addComponent(e.target.value)} className="h-9 py-1">
                          <option value="">{copy.lines.addPlaceholder}</option>
                          {addable.map((component) => (
                            <option key={component.id} value={component.id}>
                              {component.name} ({componentTypeLabel(component.type)})
                            </option>
                          ))}
                        </Select>
                      </div>
                    ) : null}
                  </div>
                )}
              </Card>

              <Card className="p-5 border-dashed">
                <h2 className="text-sm font-semibold text-primary">{copy.attendance.title}</h2>
                {attendanceMonth ? <p className="text-xs text-secondary mt-0.5">{copy.attendance.hint(attendanceMonth)}</p> : null}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                  {(
                    [
                      { field: 'daysWorked', label: copy.attendance.daysWorked, recorded: recorded?.daysWorked },
                      { field: 'workedHours', label: copy.attendance.workedHours, recorded: recorded?.workedHours },
                      { field: 'unpaidDays', label: copy.attendance.unpaidDays, recorded: recorded?.unpaidDays },
                    ] as const
                  ).map((entry) => {
                    const value = draft.attendance[entry.field];
                    const fieldError = errorMessage(errors[attendanceKey(entry.field)]);
                    return (
                      <div key={entry.field}>
                        <Label htmlFor={`sim-att-${entry.field}`}>{entry.label}</Label>
                        <Input
                          id={`sim-att-${entry.field}`}
                          inputMode="decimal"
                          placeholder={entry.recorded ?? ''}
                          value={value}
                          onChange={(e) => setAttendance(entry.field, e.target.value)}
                          aria-invalid={Boolean(fieldError)}
                          className={`tabular-nums ${value ? editedField : ''}`}
                        />
                        {fieldError ? (
                          <FieldError message={fieldError} />
                        ) : entry.recorded ? (
                          <p className="mt-1 text-xs text-muted">{copy.attendance.recorded(entry.recorded)}</p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                {recorded ? (
                  <p className="mt-3 text-xs text-muted">
                    {copy.attendance.workingDays(recorded.workingDaysInPeriod, recorded.standardHours)}
                  </p>
                ) : null}
                {sim.result && !usesAttendance ? <p className="mt-1 text-xs text-muted">{copy.attendance.unused}</p> : null}
              </Card>
            </>
          ) : (
            <Card className="border-dashed">
              <EmptyState icon={FlaskConical} title={copy.setup.selectTitle} description={copy.setup.selectDescription} />
            </Card>
          )}
        </div>

        <div className="space-y-3 min-w-0 lg:sticky lg:top-24">
          {!valid && employeeId ? (
            <div className="flex items-start gap-2 text-sm text-warning-800 dark:text-warning-200 rounded-lg border border-warning-200 dark:border-warning-800 bg-warning-50 dark:bg-warning-900/20 px-3 py-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {copy.results.invalid}
            </div>
          ) : null}
          {sim.error ? (
            <div
              role="alert"
              className="flex items-start gap-2 text-sm text-error-700 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-3 py-2"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{sim.error}</span>
            </div>
          ) : null}
          {sim.result ? (
            <>
              <SimulationResults result={sim.result} updating={sim.loading} />
              <div className="flex justify-end">
                <Button variant="secondary" size="sm" onClick={exportCsv}>
                  <Download className="h-3.5 w-3.5" /> {copy.results.export}
                </Button>
              </div>
            </>
          ) : employeeId && !sim.error ? (
            <Skeleton className="h-80 w-full rounded-xl" />
          ) : null}
        </div>
      </div>
    </div>
  );
}
