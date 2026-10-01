import { useEffect, useState } from 'react';
import { AlertCircle, FileText, Info, Lock } from 'lucide-react';
import type { PayrollRunBreakdown, PayrollRunRecord } from '@hrm/shared-types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { PayBreakdownTables } from '@/components/payroll/PayBreakdownTables';
import { RunStatusPill } from '@/components/payroll/PayrollRunStatus';
import { getPayrollRunBreakdown, getPayslipForRun, openPayslipPdf } from '@/lib/payroll-runs-api';
import { isLockedRun } from '@/lib/payroll-run-flow';
import { payrollRunsCopy } from '@/lib/payroll-runs-copy';
import { formatDate, formatMoney, payrollCopy } from '@/lib/payroll-copy';
import { ApiError } from '@/lib/tenant-api-client';

const copy = payrollRunsCopy.breakdown;

interface PayrollRunBreakdownModalProps {
  companyId: string;
  run: PayrollRunRecord | null;
  periodLabel: string;
  onClose: () => void;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; breakdown: PayrollRunBreakdown }
  | { status: 'error'; message: string };

const errorText = (err: unknown, fallback: string) =>
  err instanceof ApiError || err instanceof Error ? err.message : fallback;

export function PayrollRunBreakdownModal({ companyId, run, periodLabel, onClose }: PayrollRunBreakdownModalProps) {
  if (!run) return null;
  return <BreakdownBody key={run.id} companyId={companyId} run={run} periodLabel={periodLabel} onClose={onClose} />;
}

function BreakdownBody({
  companyId,
  run,
  periodLabel,
  onClose,
}: PayrollRunBreakdownModalProps & { run: PayrollRunRecord }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [payslipBusy, setPayslipBusy] = useState(false);
  const [payslipError, setPayslipError] = useState<string | null>(null);
  const locked = isLockedRun(run);
  const name = run.employeeName ?? run.employeeNumber ?? run.employeeId;

  useEffect(() => {
    let cancelled = false;
    getPayrollRunBreakdown(companyId, run.id)
      .then((breakdown) => !cancelled && setState({ status: 'ready', breakdown }))
      .catch((err: unknown) => !cancelled && setState({ status: 'error', message: errorText(err, copy.error) }));
    return () => {
      cancelled = true;
    };
  }, [companyId, run.id]);

  const openPayslip = async () => {
    setPayslipBusy(true);
    setPayslipError(null);
    try {
      const payslip = await getPayslipForRun(companyId, run.id);
      await openPayslipPdf(payslip.employeeId, payslip.id);
    } catch (err) {
      setPayslipError(errorText(err, copy.error));
    } finally {
      setPayslipBusy(false);
    }
  };

  const breakdown = state.status === 'ready' ? state.breakdown : null;
  const calculation = breakdown?.calculation ?? null;
  const currency = calculation?.currency;
  const liveDiffers =
    breakdown?.source === 'live' &&
    calculation &&
    run.status !== 'draft' &&
    calculation.netPay !== run.netPay;

  return (
    <Modal
      open
      onClose={onClose}
      title={copy.title(name)}
      description={copy.description(run.employeeNumber ?? '', periodLabel)}
      size="xl"
      footer={
        <>
          {locked ? (
            <Button variant="secondary" onClick={() => void openPayslip()} disabled={payslipBusy} className="mr-auto">
              <FileText className="h-4 w-4" /> {payrollRunsCopy.actions.openPayslip}
            </Button>
          ) : null}
          <Button variant="primary" onClick={onClose}>
            {copy.close}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <RunStatusPill status={run.status} locked={locked} />
          {run.finalizedAt ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <Lock className="h-3 w-3" /> {copy.finalizedAt(formatDate(run.finalizedAt))}
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: payrollRunsCopy.table.colGross, value: calculation?.grossPay ?? run.grossPay },
            { label: payrollRunsCopy.table.colDeductions, value: calculation?.totalDeductions ?? run.totalDeductions },
            { label: payrollRunsCopy.table.colNet, value: calculation?.netPay ?? run.netPay, strong: true },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-base px-4 py-3">
              <div className="text-xs text-secondary">{item.label}</div>
              <div className={`mt-0.5 tabular-nums ${item.strong ? 'text-lg font-bold text-primary' : 'text-base font-semibold text-primary'}`}>
                {state.status === 'loading' ? <Skeleton className="h-6 w-24" /> : formatMoney(item.value)}
                {state.status !== 'loading' && run.payCurrency ? (
                  <span className="ml-1 text-xs font-normal text-muted">{run.payCurrency}</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {state.status === 'loading' ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : state.status === 'error' || breakdown?.error ? (
          <div
            role="alert"
            className="flex items-start gap-2 text-sm text-error-700 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-3 py-2"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{state.status === 'error' ? state.message : breakdown?.error}</span>
          </div>
        ) : calculation ? (
          <>
            <p className="flex items-start gap-2 text-xs text-secondary">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted" />
              <span>
                {breakdown?.source === 'snapshot'
                  ? copy.snapshot
                  : run.status === 'draft'
                    ? copy.liveDraft
                    : copy.liveLegacy}
                {liveDiffers ? ` ${copy.mismatch(formatMoney(run.netPay), formatMoney(calculation.netPay))}` : ''}
              </span>
            </p>
            <PayBreakdownTables preview={calculation} />
            {calculation.superannuation && Number(calculation.superannuation.employerContribution) > 0 ? (
              <p className="text-xs text-secondary">
                {copy.employerSuper(
                  formatMoney(calculation.superannuation.employerContribution),
                  calculation.superannuation.schemeName,
                )}
              </p>
            ) : null}
            {currency && currency.payCurrency !== currency.baseCurrency ? (
              <p className="text-xs text-secondary">
                {copy.currency(
                  currency.payCurrency,
                  currency.baseCurrency,
                  currency.exchangeRate,
                  formatDate(currency.exchangeRateDate),
                )}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted">{payrollCopy.structures.breakdownEmpty}</p>
        )}

        {payslipError ? (
          <div
            role="alert"
            className="flex items-start gap-2 text-sm text-error-700 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-3 py-2"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{payslipError}</span>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
