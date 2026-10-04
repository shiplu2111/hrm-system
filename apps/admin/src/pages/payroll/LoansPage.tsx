import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarClock,
  HandCoins,
  Hourglass,
  Loader2,
  Plus,
  Search,
  TrendingDown,
} from 'lucide-react';
import { PermissionGate, usePermissions } from '@hrm/portal-ui';
import type { EmployeeLoanKind, EmployeeLoanRecord, EmployeeLoanStatus } from '@hrm/shared-types';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Progress } from '@/components/ui/Progress';
import { StatusPill } from '@/components/ui/StatusPill';
import { SummaryTile } from '@/components/ui/SummaryTile';
import { Avatar } from '@/components/ui/Toggle';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgPageState } from '@/components/org/OrgPageState';
import { pathForPage } from '@/config/routes';
import { listEmployees } from '@/lib/employees-api';
import {
  LOAN_KIND_LABELS,
  LOAN_STATUS_LABELS,
  createEmployeeLoan,
  listEmployeeLoans,
} from '@/lib/loans-api';
import {
  LOAN_STATUS_FILTERS,
  LOAN_STATUS_TONE,
  estimateInstallment,
  loanTitle,
  repaidPercent,
} from '@/lib/loan-display';
import { formatDate, formatMoney } from '@/lib/payroll-copy';
import { ApiError } from '@/lib/tenant-api-client';

const PURPOSE_SUGGESTIONS: Record<EmployeeLoanKind, string[]> = {
  salary_advance: ['Emergency Advance', 'Medical Advance', 'Festival Advance'],
  loan: ['Home / Relocation', 'Education Assistance', 'Device Purchase', 'Vehicle Loan'],
};

const thClass = 'text-left px-3 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider';

type EmployeeOption = { id: string; fullName: string; employeeNumber: string };

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

function LoansContent({ companyId }: { companyId: string }) {
  const routerNavigate = useNavigate();
  const { user, can } = usePermissions();
  const canApprove = can('payroll', 'approve');
  const [params, setParams] = useSearchParams();

  const statusParam = params.get('status');
  const statusFilter = (LOAN_STATUS_FILTERS.some((f) => f.value === statusParam) ? statusParam : 'all') as
    | EmployeeLoanStatus
    | 'all';
  const kindFilter = (params.get('kind') ?? '') as EmployeeLoanKind | '';
  const employeeFilter = params.get('employee') ?? '';

  const [loans, setLoans] = useState<EmployeeLoanRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const updateParams = useCallback(
    (changes: Record<string, string | null>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(changes)) {
            if (value) next.set(key, value);
            else next.delete(key);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [loanRows, employeeRows] = await Promise.all([listEmployeeLoans(companyId), listEmployees(companyId)]);
      setLoans(loanRows);
      setEmployees(
        employeeRows
          .map((e) => ({
            id: e.id,
            fullName: `${e.firstName} ${e.lastName}`.trim(),
            employeeNumber: e.employeeNumber,
          }))
          .sort((a, b) => a.fullName.localeCompare(b.fullName)),
      );
    } catch (err) {
      setError(errorText(err, 'Failed to load loans'));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const scoped = useMemo(
    () =>
      loans.filter(
        (l) => (!kindFilter || l.loanKind === kindFilter) && (!employeeFilter || l.employeeId === employeeFilter),
      ),
    [loans, kindFilter, employeeFilter],
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: scoped.length };
    for (const loan of scoped) counts[loan.status] = (counts[loan.status] ?? 0) + 1;
    return counts;
  }, [scoped]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scoped.filter(
      (l) =>
        (statusFilter === 'all' || l.status === statusFilter) &&
        (!q ||
          (l.employeeName ?? '').toLowerCase().includes(q) ||
          (l.employeeNumber ?? '').toLowerCase().includes(q) ||
          (l.purposeLabel ?? '').toLowerCase().includes(q) ||
          l.referenceNumber.toLowerCase().includes(q)),
    );
  }, [scoped, statusFilter, search]);

  const totals = useMemo(() => {
    const active = scoped.filter((l) => l.status === 'active');
    const pending = scoped.filter((l) => l.status === 'pending_approval');
    return {
      outstanding: active.reduce((s, l) => s + l.remainingBalance, 0),
      activeCount: active.length,
      monthly: active.filter((l) => l.deductFromPayroll).reduce((s, l) => s + l.monthlyInstallment, 0),
      pendingCount: pending.length,
      pendingAmount: pending.reduce((s, l) => s + l.principalAmount, 0),
      pastDueCount: active.reduce((s, l) => s + l.overdueInstallments, 0),
      pastDueAmount: active.reduce((s, l) => s + l.overdueAmount, 0),
    };
  }, [scoped]);

  const openLoan = (loanId: string) => routerNavigate(pathForPage('loan-detail', { loanId }));
  const isOwn = (loan: EmployeeLoanRecord) => !!user?.employeeId && user.employeeId === loan.employeeId;
  const hasFilters = !!kindFilter || !!employeeFilter;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-secondary">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading loans…
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Loans & Salary Advances</h1>
          <p className="text-sm text-secondary mt-0.5">
            Requests, repayment schedules and the payroll deductions that recover them.
          </p>
        </div>
        <PermissionGate module="payroll" action="create">
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New request
          </Button>
        </PermissionGate>
      </div>

      {error ? (
        <div className="rounded-lg border border-error-200 bg-error-50 dark:bg-error-950/30 px-3 py-3 text-sm text-error-700 dark:text-error-300">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-lg border border-success-200 bg-success-50 dark:bg-success-950/30 px-3 py-3 text-sm text-success-700 dark:text-success-300">
          {notice}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryTile
          icon={<HandCoins className="h-5 w-5" />}
          tone="accent"
          value={formatMoney(totals.outstanding)}
          label="Outstanding balance"
          hint={`${totals.activeCount} active ${totals.activeCount === 1 ? 'loan' : 'loans'}`}
        />
        <SummaryTile
          icon={<TrendingDown className="h-5 w-5" />}
          tone="success"
          value={formatMoney(totals.monthly)}
          label="Monthly payroll recovery"
          hint="Scheduled installments across active loans"
        />
        <SummaryTile
          icon={<Hourglass className="h-5 w-5" />}
          tone="warning"
          value={String(totals.pendingCount)}
          label="Pending requests"
          hint={totals.pendingCount ? `${formatMoney(totals.pendingAmount)} requested` : 'Nothing to review'}
          onClick={totals.pendingCount ? () => updateParams({ status: 'pending_approval' }) : undefined}
        />
        <SummaryTile
          icon={<AlertTriangle className="h-5 w-5" />}
          tone={totals.pastDueCount ? 'error' : 'neutral'}
          value={String(totals.pastDueCount)}
          label="Past-due installments"
          hint={
            totals.pastDueCount ? `${formatMoney(totals.pastDueAmount)} not yet recovered` : 'All installments on track'
          }
        />
      </div>

      <div className="space-y-3">
        <div className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-base">
          {LOAN_STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => updateParams({ status: f.value === 'all' ? null : f.value })}
                className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'border-accent-600 text-accent-700 dark:text-accent-300'
                    : 'border-transparent text-secondary hover:text-primary'
                }`}
              >
                {f.label}
                <span className="ml-1.5 rounded-full bg-[rgb(var(--bg-muted))] px-1.5 text-xs text-muted">
                  {statusCounts[f.value] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-44">
            <Select
              aria-label="Type"
              value={kindFilter}
              onChange={(e) => updateParams({ kind: e.target.value || null })}
              className="h-9 text-sm"
            >
              <option value="">All types</option>
              <option value="loan">{LOAN_KIND_LABELS.loan}</option>
              <option value="salary_advance">{LOAN_KIND_LABELS.salary_advance}</option>
            </Select>
          </div>
          <div className="w-52">
            <Select
              aria-label="Employee"
              value={employeeFilter}
              onChange={(e) => updateParams({ employee: e.target.value || null })}
              className="h-9 text-sm"
            >
              <option value="">All employees</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName}
                </option>
              ))}
            </Select>
          </div>
          <div className="relative w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reference, employee…"
              className="pl-8 h-9 text-sm"
            />
          </div>
          {hasFilters ? (
            <Button variant="ghost" size="sm" onClick={() => updateParams({ kind: null, employee: null })}>
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardBody className="p-0">
          {visible.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-medium text-primary">No requests match</p>
              <p className="mt-1 text-sm text-secondary">
                {loans.length === 0
                  ? 'Create a loan or salary advance request to get started.'
                  : 'Try another status tab or clear the filters.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                    <th className={thClass}>Request</th>
                    <th className={thClass}>Employee</th>
                    <th className={thClass}>Amount</th>
                    <th className={`${thClass} hidden 2xl:table-cell`}>Repayment</th>
                    <th className={thClass}>Next deduction</th>
                    <th className={thClass}>Status</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border-base))]">
                  {visible.map((loan) => {
                    const scheduled = loan.status === 'active' || loan.status === 'fully_paid';
                    return (
                      <tr
                        key={loan.id}
                        onClick={() => openLoan(loan.id)}
                        className="cursor-pointer hover:bg-[rgb(var(--bg-hover))] transition-colors"
                      >
                        <td className="px-3 py-3">
                          <div className="font-medium text-primary">{loanTitle(loan)}</div>
                          <div className="text-xs text-muted whitespace-nowrap">
                            <span className="font-mono">{loan.referenceNumber}</span> ·{' '}
                            {LOAN_KIND_LABELS[loan.loanKind]}
                          </div>
                          <div className="text-xs text-muted">Requested {formatDate(loan.createdAt)}</div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={loan.employeeName ?? 'Employee'} size="sm" />
                            <div className="min-w-0">
                              <div className="font-medium text-primary truncate">{loan.employeeName}</div>
                              <div className="text-xs text-muted">{loan.employeeNumber}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="font-semibold text-primary">{formatMoney(loan.principalAmount)}</div>
                          <div className="text-xs text-muted">
                            {loan.tenorMonths} × {formatMoney(loan.monthlyInstallment)}
                            {loan.interestRatePercent > 0 ? ` · ${loan.interestRatePercent}%` : ''}
                          </div>
                          {scheduled ? (
                            <div className="text-xs text-secondary 2xl:hidden">
                              {formatMoney(loan.remainingBalance)} left · {loan.installmentsPaid}/
                              {loan.installmentsTotal} paid
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 hidden 2xl:table-cell">
                          {scheduled ? (
                            <div className="min-w-[170px] space-y-1">
                              <div className="flex items-center justify-between gap-2 whitespace-nowrap text-xs">
                                <span className="text-muted">
                                  {loan.installmentsPaid}/{loan.installmentsTotal} paid
                                </span>
                                <span className="font-medium text-primary">
                                  {formatMoney(loan.remainingBalance)} left
                                </span>
                              </div>
                              <Progress
                                value={repaidPercent(loan)}
                                tone={loan.status === 'fully_paid' ? 'success' : 'accent'}
                              />
                            </div>
                          ) : (
                            <span className="text-xs text-muted">
                              {loan.status === 'pending_approval' ? 'Scheduled on approval' : '—'}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {loan.status === 'active' ? (
                            <>
                              {loan.nextDueDate ? (
                                <>
                                  <div className="text-primary">{formatDate(loan.nextDueDate)}</div>
                                  <div className="text-xs text-muted">
                                    {loan.deductFromPayroll ? formatMoney(loan.nextDueAmount) : 'Outside payroll'}
                                  </div>
                                </>
                              ) : (
                                <div className="text-xs text-muted">None scheduled</div>
                              )}
                              {loan.overdueInstallments > 0 ? (
                                <div className="mt-0.5 flex items-center gap-1 text-xs text-error-600">
                                  <AlertTriangle className="h-3 w-3" />
                                  {loan.overdueInstallments} past due · {formatMoney(loan.overdueAmount)}
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-xs text-muted">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <StatusPill tone={LOAN_STATUS_TONE[loan.status]}>
                            {LOAN_STATUS_LABELS[loan.status]}
                          </StatusPill>
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          {canApprove && loan.status === 'pending_approval' && !isOwn(loan) ? (
                            <Button size="sm" variant="primary">
                              Review
                            </Button>
                          ) : (
                            <span className="text-xs font-medium text-accent-600">View</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <CreateLoanModal
        open={createOpen}
        companyId={companyId}
        employees={employees}
        defaultEmployeeId={employeeFilter}
        onClose={() => setCreateOpen(false)}
        onCreated={(record) => {
          setCreateOpen(false);
          setNotice(`${record.referenceNumber} was submitted for approval.`);
          void loadData();
        }}
      />
    </div>
  );
}

function CreateLoanModal({
  open,
  companyId,
  employees,
  defaultEmployeeId,
  onClose,
  onCreated,
}: {
  open: boolean;
  companyId: string;
  employees: EmployeeOption[];
  defaultEmployeeId: string;
  onClose: () => void;
  onCreated: (record: EmployeeLoanRecord) => void;
}) {
  const [employeeId, setEmployeeId] = useState('');
  const [loanKind, setLoanKind] = useState<EmployeeLoanKind>('salary_advance');
  const [purpose, setPurpose] = useState('');
  const [amount, setAmount] = useState('');
  const [interest, setInterest] = useState('0');
  const [tenor, setTenor] = useState('6');
  const [deductFromPayroll, setDeductFromPayroll] = useState(true);
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEmployeeId(defaultEmployeeId);
    setLoanKind('salary_advance');
    setPurpose('');
    setAmount('');
    setInterest('0');
    setTenor('6');
    setDeductFromPayroll(true);
    setNotes('');
    setSubmitted(false);
    setError(null);
  }, [open, defaultEmployeeId]);

  const principal = Number(amount);
  const rate = Number(interest);
  const months = Number(tenor);
  const errors = {
    employee: employeeId ? null : 'Choose an employee.',
    amount: principal > 0 ? null : 'Enter an amount greater than zero.',
    interest: rate >= 0 && rate <= 100 ? null : 'Interest must be between 0 and 100%.',
    tenor: Number.isInteger(months) && months >= 1 && months <= 120 ? null : 'Use 1 to 120 monthly installments.',
  };
  const invalid = Object.values(errors).some(Boolean);
  const installment = estimateInstallment(principal, rate, months);
  const totalRepayable = principal > 0 ? principal + Math.round(principal * (rate / 100) * 100) / 100 : 0;

  const submit = async () => {
    setSubmitted(true);
    if (invalid) return;
    setSaving(true);
    setError(null);
    try {
      const record = await createEmployeeLoan(companyId, {
        employeeId,
        loanKind,
        purposeLabel: purpose.trim() || undefined,
        principalAmount: principal,
        interestRatePercent: rate,
        tenorMonths: months,
        deductFromPayroll,
        notes: notes.trim() || undefined,
      });
      onCreated(record);
    } catch (err) {
      setError(errorText(err, 'Failed to create the request'));
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (message: string | null) =>
    submitted && message ? <p className="mt-1 text-xs text-error-600">{message}</p> : null;

  return (
    <Modal
      open={open}
      onClose={saving ? () => undefined : onClose}
      title="New loan / salary advance request"
      description="The request is reviewed by a payroll approver; the repayment schedule is created on approval."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Submit request
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="loan-employee">Employee *</Label>
            <Select id="loan-employee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">Select an employee</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} ({emp.employeeNumber})
                </option>
              ))}
            </Select>
            {fieldError(errors.employee)}
          </div>
          <div>
            <Label htmlFor="loan-kind">Type *</Label>
            <Select
              id="loan-kind"
              value={loanKind}
              onChange={(e) => setLoanKind(e.target.value as EmployeeLoanKind)}
            >
              <option value="salary_advance">{LOAN_KIND_LABELS.salary_advance}</option>
              <option value="loan">{LOAN_KIND_LABELS.loan}</option>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="loan-purpose">Purpose</Label>
          <Input
            id="loan-purpose"
            list="loan-purpose-options"
            maxLength={120}
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder={PURPOSE_SUGGESTIONS[loanKind][0]}
          />
          <datalist id="loan-purpose-options">
            {PURPOSE_SUGGESTIONS[loanKind].map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="loan-amount">Amount *</Label>
            <Input
              id="loan-amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {fieldError(errors.amount)}
          </div>
          <div>
            <Label htmlFor="loan-interest">Flat interest (%)</Label>
            <Input
              id="loan-interest"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={interest}
              onChange={(e) => setInterest(e.target.value)}
            />
            {fieldError(errors.interest)}
          </div>
          <div>
            <Label htmlFor="loan-tenor">Installments (months) *</Label>
            <Input
              id="loan-tenor"
              type="number"
              min={1}
              max={120}
              value={tenor}
              onChange={(e) => setTenor(e.target.value)}
            />
            {fieldError(errors.tenor)}
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm text-primary">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-strong"
            checked={deductFromPayroll}
            onChange={(e) => setDeductFromPayroll(e.target.checked)}
          />
          <span>
            Deduct installments from payroll
            <span className="block text-xs text-muted">
              Each installment is recovered by the payroll run of the pay period covering its due date.
            </span>
          </span>
        </label>

        <div>
          <Label htmlFor="loan-notes">Notes</Label>
          <Textarea id="loan-notes" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-base bg-[rgb(var(--bg-muted))] p-4">
          <CalendarClock className="h-5 w-5 text-accent-600 shrink-0" />
          <div className="text-sm">
            {installment > 0 && !errors.tenor ? (
              <>
                <span className="font-semibold text-primary">
                  {months} × {formatMoney(installment)}
                </span>
                <span className="text-secondary"> per month · {formatMoney(totalRepayable)} repayable in total</span>
              </>
            ) : (
              <span className="text-secondary">Enter an amount and the number of installments to see the repayment.</span>
            )}
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-700 dark:bg-error-950/30 dark:text-error-300">
            {error}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

export function LoansPage() {
  return (
    <OrgPageState>
      {(companyId) => (
        <>
          <div className="px-4 lg:px-6 pt-4">
            <CompanySelector />
          </div>
          <LoansContent companyId={companyId} />
        </>
      )}
    </OrgPageState>
  );
}
