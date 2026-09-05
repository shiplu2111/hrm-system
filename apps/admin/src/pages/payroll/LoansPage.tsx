import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  HandCoins,
  Plus,
  Search,
  TrendingDown,
  Check,
  X,
  CreditCard,
  Loader2,
} from 'lucide-react';
import type { EmployeeLoanKind, EmployeeLoanRecord } from '@hrm/shared-types';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select } from '@/components/ui/Form';
import { Progress } from '@/components/ui/Progress';
import { Avatar } from '@/components/ui/Toggle';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgPageState } from '@/components/org/OrgPageState';
import { listEmployees } from '@/lib/employees-api';
import {
  LOAN_KIND_LABELS,
  LOAN_STATUS_LABELS,
  approveEmployeeLoan,
  createEmployeeLoan,
  listEmployeeLoans,
  rejectEmployeeLoan,
  type CreateEmployeeLoanInput,
} from '@/lib/loans-api';
import { ApiError } from '@/lib/tenant-api-client';

const PURPOSE_OPTIONS: { label: string; kind: EmployeeLoanKind }[] = [
  { label: 'Emergency Advance', kind: 'salary_advance' },
  { label: 'Home / Relocation', kind: 'loan' },
  { label: 'Education Assistance', kind: 'loan' },
  { label: 'Device Purchase', kind: 'loan' },
];

function calculateEmi(
  amount: number,
  interest: number,
  tenor: number,
): number {
  if (tenor <= 0) return 0;
  const total = interest > 0 ? amount * (1 + interest / 100) : amount;
  return Math.round((total / tenor) * 100) / 100;
}

function statusTone(
  status: EmployeeLoanRecord['status'],
): 'success' | 'warning' | 'error' | 'neutral' | 'accent' {
  switch (status) {
    case 'active':
      return 'success';
    case 'pending_approval':
      return 'warning';
    case 'fully_paid':
      return 'accent';
    case 'rejected':
    case 'cancelled':
      return 'neutral';
    default:
      return 'neutral';
  }
}

function LoansContent({ companyId }: { companyId: string }) {
  const [loans, setLoans] = useState<EmployeeLoanRecord[]>([]);
  const [employees, setEmployees] = useState<
    { id: string; fullName: string; employeeNumber: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const [employeeId, setEmployeeId] = useState('');
  const [purposeIndex, setPurposeIndex] = useState(0);
  const [amount, setAmount] = useState(3000);
  const [interest, setInterest] = useState(0);
  const [tenor, setTenor] = useState(6);

  const purpose = PURPOSE_OPTIONS[purposeIndex] ?? PURPOSE_OPTIONS[0];
  const calculatedEmi = calculateEmi(amount, interest, tenor);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [loanRows, employeeRows] = await Promise.all([
        listEmployeeLoans(companyId),
        listEmployees(companyId),
      ]);
      setLoans(loanRows);
      setEmployees(
        employeeRows.map((e) => ({
          id: e.id,
          fullName: `${e.firstName} ${e.lastName}`.trim(),
          employeeNumber: e.employeeNumber,
        })),
      );
      setEmployeeId((current) => current || employeeRows[0]?.id || '');
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to load loans',
      );
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredLoans = useMemo(() => {
    const q = search.toLowerCase();
    return loans.filter(
      (l) =>
        (l.employeeName ?? '').toLowerCase().includes(q) ||
        (l.employeeNumber ?? '').toLowerCase().includes(q) ||
        (l.purposeLabel ?? '').toLowerCase().includes(q) ||
        l.referenceNumber.toLowerCase().includes(q),
    );
  }, [loans, search]);

  const totalOutstanding = loans
    .filter((l) => l.status === 'active')
    .reduce((s, l) => s + l.remainingBalance, 0);

  const monthlyRecovered = loans
    .filter((l) => l.status === 'active')
    .reduce((s, l) => s + l.monthlyInstallment, 0);

  const pendingCount = loans.filter(
    (l) => l.status === 'pending_approval',
  ).length;

  const handleCreateLoan = async () => {
    if (!employeeId) return;
    setSaving(true);
    setError(null);
    try {
      const input: CreateEmployeeLoanInput = {
        employeeId,
        loanKind: purpose.kind,
        purposeLabel: purpose.label,
        principalAmount: amount,
        interestRatePercent: interest,
        tenorMonths: tenor,
        deductFromPayroll: true,
      };
      await createEmployeeLoan(companyId, input);
      setModalOpen(false);
      await loadData();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to create loan request',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (loanId: string) => {
    setActionId(loanId);
    setError(null);
    try {
      await approveEmployeeLoan(loanId);
      await loadData();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to approve loan',
      );
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (loanId: string) => {
    setActionId(loanId);
    setError(null);
    try {
      await rejectEmployeeLoan(loanId);
      await loadData();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to reject loan',
      );
    } finally {
      setActionId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-secondary">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading loans…
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">
            Loans & Salary Advances
          </h1>
          <p className="text-sm text-secondary mt-0.5">
            Manage company loans, salary advance requests, and automatic monthly
            EMI payroll recoveries.
          </p>
        </div>
        <Button variant="primary" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> Grant Loan / Advance
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-error-200 bg-error-50 dark:bg-error-950/30 px-4 py-3 text-sm text-error-700 dark:text-error-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-primary">
              ${totalOutstanding.toLocaleString()}
            </div>
            <div className="text-xs text-secondary mt-0.5">
              Total Outstanding Loan Balance
            </div>
          </div>
          <div className="h-10 w-10 rounded-lg bg-accent-50 dark:bg-accent-950/40 text-accent-600 dark:text-accent-400 flex items-center justify-center">
            <HandCoins className="h-5 w-5" />
          </div>
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-success-600 dark:text-success-400">
              ${monthlyRecovered.toLocaleString()} / mo
            </div>
            <div className="text-xs text-secondary mt-0.5">
              Scheduled Monthly Payroll Recovery
            </div>
          </div>
          <div className="h-10 w-10 rounded-lg bg-success-50 dark:bg-success-950/40 text-success-600 dark:text-success-400 flex items-center justify-center">
            <TrendingDown className="h-5 w-5" />
          </div>
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-warning-600">
              {pendingCount}
            </div>
            <div className="text-xs text-secondary mt-0.5">
              Pending Advance Requests
            </div>
          </div>
          <div className="h-10 w-10 rounded-lg bg-warning-50 dark:bg-warning-950/40 text-warning-600 dark:text-warning-400 flex items-center justify-center">
            <CreditCard className="h-5 w-5" />
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle>Active Loans & Installment Schedules</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search loans by employee, ID..."
              className="pl-8 text-xs h-8"
            />
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Loan ID / Staff
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Principal & Interest
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Monthly EMI
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Repayment Progress
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {filteredLoans.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-8 text-center text-secondary text-sm"
                    >
                      No loans found. Create a loan or advance request to get
                      started.
                    </td>
                  </tr>
                ) : (
                  filteredLoans.map((loan) => {
                    const progressPct =
                      loan.installmentsTotal > 0
                        ? Math.round(
                            (loan.installmentsPaid / loan.installmentsTotal) *
                              100,
                          )
                        : 0;
                    const displayName =
                      loan.employeeName ?? 'Unknown employee';
                    const isBusy = actionId === loan.id;

                    return (
                      <tr
                        key={loan.id}
                        className="hover:bg-[rgb(var(--bg-hover))] transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar name={displayName} size="sm" />
                            <div>
                              <div className="font-semibold text-primary text-sm">
                                {displayName}
                              </div>
                              <div className="text-xs text-muted font-mono">
                                {loan.referenceNumber} ·{' '}
                                {loan.employeeNumber ?? loan.employeeId}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-3.5 text-xs text-primary font-medium">
                          {loan.purposeLabel ??
                            LOAN_KIND_LABELS[loan.loanKind]}
                        </td>

                        <td className="px-5 py-3.5 text-xs">
                          <div className="font-bold text-primary">
                            ${loan.principalAmount.toLocaleString()}
                          </div>
                          <div className="text-[11px] text-muted">
                            {loan.interestRatePercent}% interest ·{' '}
                            {loan.tenorMonths} mo
                          </div>
                        </td>

                        <td className="px-5 py-3.5 text-xs">
                          {loan.status === 'active' ||
                          loan.status === 'fully_paid' ? (
                            <>
                              <span className="font-semibold text-error-600">
                                -${loan.monthlyInstallment} / mo
                              </span>
                              {loan.deductFromPayroll && (
                                <div className="text-[10px] text-success-600 font-medium">
                                  Auto-deducted
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>

                        <td className="px-5 py-3.5 w-48">
                          {loan.status === 'active' ||
                          loan.status === 'fully_paid' ? (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-muted">
                                  {loan.installmentsPaid} of{' '}
                                  {loan.installmentsTotal} paid
                                </span>
                                <span className="font-semibold text-primary">
                                  ${loan.remainingBalance.toLocaleString()} left
                                </span>
                              </div>
                              <Progress value={progressPct} />
                            </div>
                          ) : (
                            <span className="text-xs text-muted">
                              Schedule pending approval
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-3.5">
                          <Badge tone={statusTone(loan.status)} dot>
                            {LOAN_STATUS_LABELS[loan.status]}
                          </Badge>
                        </td>

                        <td className="px-5 py-3.5 text-right">
                          {loan.status === 'pending_approval' ? (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="primary"
                                size="sm"
                                disabled={isBusy}
                                onClick={() => void handleApprove(loan.id)}
                              >
                                {isBusy ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="h-3.5 w-3.5" />
                                )}{' '}
                                Approve
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                disabled={isBusy}
                                onClick={() => void handleReject(loan.id)}
                              >
                                <X className="h-3.5 w-3.5" /> Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted font-mono">
                              {loan.disbursedAt?.slice(0, 10) ?? '—'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Grant Loan / Salary Advance"
        description="Configure principal amount, repayment tenor, and automatic payroll EMI recovery."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={saving || !employeeId}
              onClick={() => void handleCreateLoan()}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
                </>
              ) : (
                'Submit Request'
              )}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Employee</Label>
              <Select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} ({emp.employeeNumber})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Loan / Advance Type</Label>
              <Select
                value={String(purposeIndex)}
                onChange={(e) => setPurposeIndex(Number(e.target.value))}
              >
                {PURPOSE_OPTIONS.map((opt, idx) => (
                  <option key={opt.label} value={idx}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Principal ($)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) =>
                  setAmount(parseFloat(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <Label>Flat Interest (%)</Label>
              <Input
                type="number"
                value={interest}
                onChange={(e) =>
                  setInterest(parseFloat(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <Label>Tenor (Months)</Label>
              <Input
                type="number"
                value={tenor}
                onChange={(e) => setTenor(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          <div className="surface border border-base rounded-xl p-4 bg-accent-50/20 dark:bg-accent-950/20 text-center space-y-1">
            <div className="text-xs text-secondary">
              Calculated Monthly Payroll Deduction (EMI)
            </div>
            <div className="text-2xl font-bold text-primary">
              ${calculatedEmi} / month
            </div>
            <div className="text-[11px] text-muted">
              After approval, EMI is auto-linked to payroll via the Loan &
              Advance Recovery deduction component.
            </div>
          </div>
        </div>
      </Modal>
    </div>
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
