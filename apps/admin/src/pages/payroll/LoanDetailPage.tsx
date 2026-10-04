import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  ExternalLink,
  Info,
  Loader2,
  XCircle,
} from 'lucide-react';
import { usePermissions } from '@hrm/portal-ui';
import type { EmployeeLoanDetailRecord, LoanPayPeriodRef, LoanScheduleRow } from '@hrm/shared-types';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import { StatusPill } from '@/components/ui/StatusPill';
import { Avatar } from '@/components/ui/Toggle';
import { RunStatusPill } from '@/components/payroll/PayrollRunStatus';
import { LoanDecisionModal, type LoanDecision } from '@/components/payroll/LoanDecisionModal';
import { useNav } from '@/context/NavContext';
import { pathForPage } from '@/config/routes';
import { getEmployeeLoan, LOAN_KIND_LABELS, LOAN_STATUS_LABELS } from '@/lib/loans-api';
import {
  LOAN_STATUS_TONE,
  PERIOD_STATE_LABEL,
  PERIOD_STATE_TONE,
  RECOVERY_HINT,
  RECOVERY_LABEL,
  RECOVERY_TONE,
  loanTitle,
  repaidPercent,
} from '@/lib/loan-display';
import { formatDate, formatMoney } from '@/lib/payroll-copy';
import { periodLabel } from '@/lib/payroll-run-flow';
import { ApiError } from '@/lib/tenant-api-client';

const thClass = 'text-left px-4 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider';
const numThClass = 'text-right px-4 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider';

export function LoanDetailPage() {
  const { loanId = '' } = useParams();
  const routerNavigate = useNavigate();
  const { openEmployee } = useNav();
  const { user, can } = usePermissions();
  const canApprove = can('payroll', 'approve');

  const [loan, setLoan] = useState<EmployeeLoanDetailRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [decision, setDecision] = useState<LoanDecision | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setLoan(await getEmployeeLoan(loanId));
    } catch (err) {
      setLoan(null);
      setError(err instanceof ApiError ? err.message : 'Could not load this loan');
    } finally {
      setLoading(false);
    }
  }, [loanId]);

  useEffect(() => {
    void load();
  }, [load]);

  const missed = useMemo(() => loan?.schedule.filter((row) => row.recovery === 'missed') ?? [], [loan]);
  const nextRow = useMemo(
    () =>
      loan && !loan.scheduleIsProjected
        ? (loan.schedule.find((row) => row.status === 'scheduled' && row.recovery !== 'missed') ?? null)
        : null,
    [loan],
  );
  const deductionTotals = useMemo(() => {
    const rows = loan?.payrollDeductions ?? [];
    const sum = (state: string) => rows.filter((r) => r.state === state).reduce((s, r) => s + r.amount, 0);
    return { recovered: sum('recovered'), pending: sum('pending'), missed: sum('missed') };
  }, [loan]);

  const goToList = () => routerNavigate(pathForPage('loans'));
  const openPeriod = (period: LoanPayPeriodRef) => routerNavigate(`/payroll/runs/${period.id}`);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-secondary">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading loan…
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-4">
        <BackLink onClick={goToList} />
        <div className="rounded-lg border border-error-200 bg-error-50 dark:bg-error-950/30 px-4 py-3 text-sm text-error-700 dark:text-error-300">
          {error ?? 'This loan could not be found.'}
        </div>
      </div>
    );
  }

  const isOwn = !!user?.employeeId && user.employeeId === loan.employeeId;
  const pending = loan.status === 'pending_approval';
  const rejected = loan.status === 'rejected';
  const scheduleStarted = loan.status === 'active' || loan.status === 'fully_paid';

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-[1400px] mx-auto">
      <BackLink onClick={goToList} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-primary">{loanTitle(loan)}</h1>
            <StatusPill tone={LOAN_STATUS_TONE[loan.status]}>{LOAN_STATUS_LABELS[loan.status]}</StatusPill>
          </div>
          <div className="mt-1 text-sm text-secondary">
            <span className="font-mono">{loan.referenceNumber}</span> · {LOAN_KIND_LABELS[loan.loanKind]} · requested{' '}
            {formatDate(loan.createdAt)}
          </div>
          <button
            type="button"
            onClick={() => openEmployee(loan.employeeId)}
            className="mt-3 inline-flex items-center gap-2.5 rounded-lg pr-2 hover:bg-[rgb(var(--bg-hover))]"
          >
            <Avatar name={loan.employeeName ?? 'Employee'} size="sm" />
            <span className="text-left">
              <span className="block text-sm font-medium text-primary">{loan.employeeName}</span>
              <span className="block text-xs text-muted">{loan.employeeNumber}</span>
            </span>
          </button>
        </div>
        {pending && canApprove ? (
          isOwn ? (
            <p className="text-sm text-muted lg:max-w-xs lg:text-right">
              This is your own request — another payroll approver has to decide it.
            </p>
          ) : (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setDecision('reject')}>
                Reject
              </Button>
              <Button variant="primary" onClick={() => setDecision('approve')}>
                Approve
              </Button>
            </div>
          )
        ) : null}
      </div>

      {notice ? (
        <div className="rounded-lg border border-success-200 bg-success-50 dark:bg-success-950/30 px-4 py-3 text-sm text-success-700 dark:text-success-300">
          {notice}
        </div>
      ) : null}
      {rejected ? (
        <Banner tone="error" icon={<XCircle className="h-4 w-4" />}>
          <span className="font-medium">Rejected {formatDate(loan.rejectedAt)}.</span>{' '}
          {loan.rejectionReason ?? 'No reason was recorded.'}
        </Banner>
      ) : null}
      {pending ? (
        <Banner tone="info" icon={<Info className="h-4 w-4" />}>
          Awaiting approval. The schedule below is a projection starting next month; the approver chooses the actual
          first deduction date.
        </Banner>
      ) : null}
      {missed.length > 0 ? (
        <Banner tone="warning" icon={<AlertTriangle className="h-4 w-4" />}>
          <span className="font-medium">
            {missed.length} {missed.length === 1 ? 'installment' : 'installments'} ({formatMoney(
              missed.reduce((s, r) => s + r.totalDue, 0),
            )}) passed the due date without a payroll deduction.
          </span>{' '}
          Payroll only deducts installments due within the period being run, so these will not be recovered
          automatically.
        </Banner>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="surface rounded-xl border border-base shadow-card p-4 xl:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm text-secondary">Remaining balance</div>
              <div className="text-3xl font-bold text-primary mt-0.5">
                {formatMoney(rejected ? 0 : pending ? loan.totalRepayable : loan.remainingBalance)}
              </div>
            </div>
            <div className="text-right text-sm">
              <div className="text-secondary">Repaid</div>
              <div className="font-semibold text-primary">{formatMoney(loan.repaidAmount)}</div>
            </div>
          </div>
          {rejected ? (
            <p className="mt-3 text-xs text-muted">
              Nothing is owed — the {formatMoney(loan.principalAmount)} request was rejected.
            </p>
          ) : (
            <>
              <div className="mt-3">
                <Progress value={repaidPercent(loan)} tone={loan.status === 'fully_paid' ? 'success' : 'accent'} />
              </div>
              <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted">
                <span>
                  {loan.installmentsPaid} of {loan.installmentsTotal} installments recovered · {repaidPercent(loan)}%
                </span>
                <span>
                  Principal {formatMoney(loan.principalRepaid)} · interest {formatMoney(loan.interestRepaid)} repaid
                </span>
              </div>
            </>
          )}
        </div>
        <Stat
          label="Total repayable"
          value={formatMoney(loan.totalRepayable)}
          hint={
            loan.interestRatePercent > 0
              ? `${formatMoney(loan.principalAmount)} + ${loan.interestRatePercent}% flat interest`
              : `${formatMoney(loan.principalAmount)} · interest-free`
          }
        />
        <Stat
          label="Next deduction"
          icon={<CalendarClock className="h-4 w-4 text-accent-600" />}
          value={nextRow ? formatMoney(nextRow.totalDue) : '—'}
          hint={
            nextRow
              ? `${formatDate(nextRow.dueDate)}${nextRow.payPeriod ? ` · ${periodLabel(nextRow.payPeriod)} payroll` : ''}`
              : loan.status === 'fully_paid'
                ? 'Fully repaid'
                : pending
                  ? `${loan.tenorMonths} × ${formatMoney(loan.monthlyInstallment)} after approval`
                  : 'Nothing scheduled'
          }
        />
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-3 gap-5">
        <div className="2xl:col-span-2 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>{loan.scheduleIsProjected ? 'Projected installment schedule' : 'Installment schedule'}</CardTitle>
            </CardHeader>
            <CardBody className="p-0">
              {loan.schedule.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-secondary">
                  {loan.status === 'rejected' ? 'No schedule — the request was rejected.' : 'No installments.'}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                        <th className={thClass}>#</th>
                        <th className={thClass}>Due date</th>
                        <th className={`${numThClass} hidden md:table-cell`}>Principal</th>
                        <th className={`${numThClass} hidden md:table-cell`}>Interest</th>
                        <th className={numThClass}>Installment</th>
                        <th className={numThClass}>Balance after</th>
                        <th className={thClass}>Pay period</th>
                        <th className={thClass}>Recovery</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgb(var(--border-base))]">
                      {loan.schedule.map((row) => (
                        <ScheduleRow key={row.installmentNumber} row={row} onOpenPeriod={openPeriod} />
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-base bg-[rgb(var(--bg-muted))] text-sm font-semibold text-primary">
                        <td className="px-4 py-2.5" colSpan={2}>
                          Total
                        </td>
                        <td className="px-4 py-2.5 text-right hidden md:table-cell">
                          {formatMoney(loan.principalAmount)}
                        </td>
                        <td className="px-4 py-2.5 text-right hidden md:table-cell">
                          {formatMoney(loan.totalRepayable - loan.principalAmount)}
                        </td>
                        <td className="px-4 py-2.5 text-right">{formatMoney(loan.totalRepayable)}</td>
                        <td colSpan={3} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Payroll deductions by pay period</CardTitle>
              {loan.payrollDeductions.length > 0 ? (
                <span className="text-xs text-muted">
                  {formatMoney(deductionTotals.recovered)} deducted
                  {deductionTotals.pending > 0 ? ` · ${formatMoney(deductionTotals.pending)} pending` : ''}
                  {deductionTotals.missed > 0 ? ` · ${formatMoney(deductionTotals.missed)} not deducted` : ''}
                </span>
              ) : null}
            </CardHeader>
            <CardBody className="p-0">
              {loan.payrollDeductions.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-secondary">
                  {rejected
                    ? 'No payroll deductions — the request was rejected.'
                    : !loan.deductFromPayroll
                    ? 'This loan is repaid outside payroll.'
                    : !scheduleStarted
                      ? 'Deductions are linked to pay periods once the request is approved.'
                      : 'No pay period covers the installment dates yet. Deductions appear here as pay periods are created.'}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                        <th className={thClass}>Pay period</th>
                        <th className={`${thClass} hidden md:table-cell`}>Payment date</th>
                        <th className={thClass}>Payroll run</th>
                        <th className={thClass}>Installments</th>
                        <th className={numThClass}>Amount</th>
                        <th className={thClass}>Deduction</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgb(var(--border-base))]">
                      {loan.payrollDeductions.map((item) => (
                        <tr
                          key={item.payPeriod.id}
                          onClick={() => openPeriod(item.payPeriod)}
                          className="cursor-pointer hover:bg-[rgb(var(--bg-hover))] transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 font-medium text-primary">
                              {periodLabel(item.payPeriod)}
                              <ExternalLink className="h-3 w-3 text-muted" />
                            </div>
                            <div className="text-xs text-muted">
                              {formatDate(item.payPeriod.startDate)} – {formatDate(item.payPeriod.endDate)}
                              {item.payPeriod.status === 'closed' ? ' · closed' : ''}
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell text-secondary">
                            {formatDate(item.payPeriod.paymentDate)}
                          </td>
                          <td className="px-4 py-3">
                            {item.payrollRun ? (
                              <RunStatusPill status={item.payrollRun.status} />
                            ) : (
                              <span className="text-xs text-muted">No run for this employee</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-secondary">
                            {item.installmentNumbers.map((n) => `#${n}`).join(', ')}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-primary whitespace-nowrap">
                            {formatMoney(item.amount)}
                          </td>
                          <td className="px-4 py-3">
                            <StatusPill tone={PERIOD_STATE_TONE[item.state]}>{PERIOD_STATE_LABEL[item.state]}</StatusPill>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Request details</CardTitle>
          </CardHeader>
          <CardBody>
            <dl className="grid grid-cols-1 gap-x-10 gap-y-3 text-sm sm:grid-cols-2 2xl:grid-cols-1">
              <Detail label="Type">{LOAN_KIND_LABELS[loan.loanKind]}</Detail>
              <Detail label="Purpose">{loan.purposeLabel ?? '—'}</Detail>
              <Detail label="Amount">{formatMoney(loan.principalAmount)}</Detail>
              <Detail label="Interest">
                {loan.interestRatePercent > 0 ? `${loan.interestRatePercent}% flat` : 'Interest-free'}
              </Detail>
              <Detail label="Repayment">
                {loan.tenorMonths} monthly × {formatMoney(loan.monthlyInstallment)}
              </Detail>
              <Detail label="Recovery">
                {loan.deductFromPayroll ? 'Deducted from payroll (Loan & Advance Recovery)' : 'Outside payroll'}
              </Detail>
              <Detail label="Requested">{formatDate(loan.createdAt)}</Detail>
              {loan.approvedAt ? <Detail label="Approved">{formatDate(loan.approvedAt)}</Detail> : null}
              {loan.disbursedAt ? <Detail label="Disbursed">{formatDate(loan.disbursedAt)}</Detail> : null}
              {loan.firstDueDate ? <Detail label="First installment">{formatDate(loan.firstDueDate)}</Detail> : null}
              {loan.rejectedAt ? <Detail label="Rejected">{formatDate(loan.rejectedAt)}</Detail> : null}
              {loan.notes ? (
                <div className="sm:col-span-2 2xl:col-span-1">
                  <dt className="text-xs text-muted">Notes</dt>
                  <dd className="mt-0.5 whitespace-pre-line text-primary">{loan.notes}</dd>
                </div>
              ) : null}
            </dl>
          </CardBody>
        </Card>
      </div>

      <LoanDecisionModal
        loan={decision ? loan : null}
        decision={decision}
        onClose={() => setDecision(null)}
        onDecided={(_, message) => {
          setDecision(null);
          setNotice(message);
          void load();
        }}
      />
    </div>
  );
}

function ScheduleRow({ row, onOpenPeriod }: { row: LoanScheduleRow; onOpenPeriod: (p: LoanPayPeriodRef) => void }) {
  return (
    <tr className={row.recovery === 'missed' ? 'bg-error-50/40 dark:bg-error-950/20' : undefined}>
      <td className="px-4 py-3 text-muted">{row.installmentNumber}</td>
      <td className="px-4 py-3 whitespace-nowrap text-primary">{formatDate(row.dueDate)}</td>
      <td className="px-4 py-3 text-right hidden md:table-cell text-secondary">{formatMoney(row.principalPortion)}</td>
      <td className="px-4 py-3 text-right hidden md:table-cell text-secondary">{formatMoney(row.interestPortion)}</td>
      <td className="px-4 py-3 text-right font-medium text-primary whitespace-nowrap">{formatMoney(row.totalDue)}</td>
      <td className="px-4 py-3 text-right text-secondary whitespace-nowrap">{formatMoney(row.balanceAfter)}</td>
      <td className="px-4 py-3 whitespace-nowrap">
        {row.payPeriod ? (
          <button
            type="button"
            onClick={() => onOpenPeriod(row.payPeriod!)}
            className="text-accent-600 hover:underline"
          >
            {periodLabel(row.payPeriod)}
          </button>
        ) : (
          <span className="text-xs text-muted">No pay period</span>
        )}
        {row.payrollRun ? (
          <div className="mt-0.5">
            <RunStatusPill status={row.payrollRun.status} />
          </div>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <span title={RECOVERY_HINT[row.recovery]}>
          <StatusPill tone={RECOVERY_TONE[row.recovery]}>{RECOVERY_LABEL[row.recovery]}</StatusPill>
        </span>
        {row.paidAt ? <div className="mt-0.5 text-xs text-muted">{formatDate(row.paidAt)}</div> : null}
      </td>
    </tr>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-primary"
    >
      <ArrowLeft className="h-4 w-4" /> Loans & Advances
    </button>
  );
}

const BANNER_TONES = {
  info: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200',
  warning:
    'border-warning-200 bg-warning-50 text-warning-800 dark:border-warning-900 dark:bg-warning-950/30 dark:text-warning-200',
  error: 'border-error-200 bg-error-50 text-error-700 dark:border-error-900 dark:bg-error-950/30 dark:text-error-300',
} as const;

function Banner({ tone, icon, children }: { tone: keyof typeof BANNER_TONES; icon: ReactNode; children: ReactNode }) {
  return (
    <div className={`flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm ${BANNER_TONES[tone]}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>{children}</div>
    </div>
  );
}

function Stat({ label, value, hint, icon }: { label: string; value: string; hint: string; icon?: ReactNode }) {
  return (
    <div className="surface rounded-xl border border-base shadow-card p-4">
      <div className="flex items-center gap-1.5 text-sm text-secondary">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold text-primary mt-0.5">{value}</div>
      <div className="text-xs text-muted mt-1">{hint}</div>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted shrink-0">{label}</dt>
      <dd className="text-right text-primary">{children}</dd>
    </div>
  );
}
