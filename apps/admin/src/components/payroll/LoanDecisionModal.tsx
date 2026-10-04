import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { EmployeeLoanRecord } from '@hrm/shared-types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Label, Textarea } from '@/components/ui/Form';
import { approveEmployeeLoan, rejectEmployeeLoan } from '@/lib/loans-api';
import { loanTitle, nextMonthIso, todayIso } from '@/lib/loan-display';
import { formatMoney } from '@/lib/payroll-copy';
import { ApiError } from '@/lib/tenant-api-client';

export type LoanDecision = 'approve' | 'reject';

export function LoanDecisionModal({
  loan,
  decision,
  onClose,
  onDecided,
}: {
  loan: EmployeeLoanRecord | null;
  decision: LoanDecision | null;
  onClose: () => void;
  onDecided: (record: EmployeeLoanRecord, message: string) => void;
}) {
  const [firstDueDate, setFirstDueDate] = useState(nextMonthIso());
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loan) return;
    setFirstDueDate(nextMonthIso());
    setReason('');
    setSubmitted(false);
    setError(null);
  }, [loan, decision]);

  if (!loan || !decision) return null;

  const isReject = decision === 'reject';
  const dateError = !firstDueDate
    ? 'Choose the first deduction date.'
    : firstDueDate < todayIso()
      ? 'The first deduction cannot be in the past.'
      : null;
  const reasonError = reason.trim() ? null : 'Add a reason so the employee knows why.';
  const invalid = isReject ? !!reasonError : !!dateError;

  const submit = async () => {
    setSubmitted(true);
    if (invalid) return;
    setSaving(true);
    setError(null);
    try {
      const record = isReject
        ? await rejectEmployeeLoan(loan.id, reason.trim())
        : await approveEmployeeLoan(loan.id, { firstDueDate });
      onDecided(
        record,
        isReject
          ? `${loan.referenceNumber} was rejected.`
          : `${loan.referenceNumber} was approved — ${record.installmentsTotal} installments scheduled.`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The decision could not be saved');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={saving ? () => undefined : onClose}
      title={isReject ? 'Reject request' : 'Approve request'}
      description={`${loan.referenceNumber} · ${loan.employeeName ?? 'Employee'} · ${loanTitle(loan)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant={isReject ? 'danger' : 'primary'} onClick={() => void submit()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isReject ? 'Reject request' : 'Approve and schedule'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3 rounded-lg border border-base bg-[rgb(var(--bg-muted))] p-3 text-sm">
          <div>
            <div className="text-xs text-muted">Amount</div>
            <div className="font-semibold text-primary">{formatMoney(loan.principalAmount)}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Repayable</div>
            <div className="font-semibold text-primary">{formatMoney(loan.totalRepayable)}</div>
            {loan.interestRatePercent > 0 ? (
              <div className="text-xs text-muted">{loan.interestRatePercent}% flat interest</div>
            ) : null}
          </div>
          <div>
            <div className="text-xs text-muted">Installments</div>
            <div className="font-semibold text-primary">
              {loan.tenorMonths} × {formatMoney(loan.monthlyInstallment)}
            </div>
          </div>
        </div>

        {isReject ? (
          <div>
            <Label htmlFor="loan-reject-reason">Reason *</Label>
            <Textarea
              id="loan-reject-reason"
              rows={3}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Exceeds the advance limit for this grade"
            />
            {submitted && reasonError ? <p className="mt-1 text-xs text-error-600">{reasonError}</p> : null}
          </div>
        ) : (
          <div>
            <Label htmlFor="loan-first-due">First deduction date *</Label>
            <Input
              id="loan-first-due"
              type="date"
              min={todayIso()}
              value={firstDueDate}
              onChange={(e) => setFirstDueDate(e.target.value)}
            />
            {submitted && dateError ? (
              <p className="mt-1 text-xs text-error-600">{dateError}</p>
            ) : (
              <p className="mt-1 text-xs text-muted">
                {loan.deductFromPayroll
                  ? 'Installments fall due monthly from this date and are deducted by the payroll run of the pay period covering each date.'
                  : 'Installments fall due monthly from this date. This loan is repaid outside payroll.'}
              </p>
            )}
          </div>
        )}

        {error ? (
          <div className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-700 dark:bg-error-950/30 dark:text-error-300">
            {error}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
