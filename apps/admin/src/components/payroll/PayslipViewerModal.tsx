import { useEffect, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Download, ExternalLink } from 'lucide-react';
import type { PayslipListItem } from '@hrm/shared-types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { RunStatusPill } from '@/components/payroll/PayrollRunStatus';
import { fetchPayslipPdf } from '@/lib/payroll-runs-api';
import { saveBlob } from '@/lib/download';
import { periodLabel } from '@/lib/payroll-run-flow';
import { payslipCopy } from '@/lib/payslip-copy';
import { formatDate, formatMoney } from '@/lib/payroll-copy';
import { ApiError } from '@/lib/tenant-api-client';

const copy = payslipCopy.viewer;

type PdfState =
  | { status: 'loading' }
  | { status: 'ready'; blob: Blob; url: string; filename: string }
  | { status: 'error'; message: string };

interface PayslipViewerModalProps {
  item: PayslipListItem | null;
  /** Issued payslips in the current list, for previous/next. */
  sequence: PayslipListItem[];
  onNavigate: (item: PayslipListItem) => void;
  onClose: () => void;
}

export function PayslipViewerModal({ item, sequence, onNavigate, onClose }: PayslipViewerModalProps) {
  if (!item?.payslip) return null;
  return <Viewer key={item.payslip.id} item={item} sequence={sequence} onNavigate={onNavigate} onClose={onClose} />;
}

function Viewer({ item, sequence, onNavigate, onClose }: PayslipViewerModalProps & { item: PayslipListItem }) {
  const [pdf, setPdf] = useState<PdfState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const payslipId = item.payslip?.id ?? '';
  const index = sequence.findIndex((entry) => entry.payrollRunId === item.payrollRunId);
  const previous = index > 0 ? sequence[index - 1] : null;
  const next = index >= 0 && index < sequence.length - 1 ? sequence[index + 1] : null;
  const period = periodLabel({ startDate: item.periodStartDate, endDate: item.periodEndDate });

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    fetchPayslipPdf(item.employeeId, payslipId)
      .then(({ blob, filename }) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setPdf({ status: 'ready', blob, url, filename });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setPdf({ status: 'error', message: err instanceof ApiError || err instanceof Error ? err.message : copy.error });
        }
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [item.employeeId, payslipId, attempt]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === 'ArrowLeft' && previous) onNavigate(previous);
      if (event.key === 'ArrowRight' && next) onNavigate(next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previous, next, onNavigate]);

  const retry = () => {
    setPdf({ status: 'loading' });
    setAttempt((n) => n + 1);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={item.employeeName}
      description={copy.description(item.employeeNumber, period)}
      size="xl"
      footer={
        <>
          <div className="mr-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={copy.previous}
              title={copy.previous}
              onClick={() => previous && onNavigate(previous)}
              disabled={!previous}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {index >= 0 ? (
              <span className="text-xs text-muted tabular-nums px-1">{copy.position(index + 1, sequence.length)}</span>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              aria-label={copy.next}
              title={copy.next}
              onClick={() => next && onNavigate(next)}
              disabled={!next}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="secondary"
            onClick={() => pdf.status === 'ready' && window.open(pdf.url, '_blank', 'noopener')}
            disabled={pdf.status !== 'ready'}
          >
            <ExternalLink className="h-4 w-4" /> {copy.openTab}
          </Button>
          <Button
            variant="primary"
            onClick={() => pdf.status === 'ready' && saveBlob(pdf.blob, pdf.filename)}
            disabled={pdf.status !== 'ready'}
          >
            <Download className="h-4 w-4" /> {payslipCopy.download}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <RunStatusPill status={item.runStatus} locked />
          <span className="text-secondary">
            {payslipCopy.colPayment}: <span className="text-primary">{formatDate(item.paymentDate)}</span>
          </span>
          {item.departmentName ? <span className="text-secondary">{item.departmentName}</span> : null}
          {item.payslip?.generatedAt ? (
            <span className="text-muted text-xs">{payslipCopy.issuedOn(formatDate(item.payslip.generatedAt))}</span>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: copy.gross, value: item.grossPay },
            { label: copy.deductions, value: item.totalDeductions },
            { label: copy.net, value: item.netPay, strong: true },
          ].map((entry) => (
            <div key={entry.label} className="rounded-lg border border-base px-4 py-3">
              <div className="text-xs text-secondary">{entry.label}</div>
              <div className={`mt-0.5 tabular-nums text-primary ${entry.strong ? 'text-lg font-bold' : 'font-semibold'}`}>
                {formatMoney(entry.value)} <span className="text-xs font-normal text-muted">{item.payCurrency}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-base overflow-hidden bg-[rgb(var(--bg-muted))]">
          {pdf.status === 'loading' ? (
            <div className="h-[60vh] p-6 space-y-3" aria-busy="true" aria-label={copy.loading}>
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : pdf.status === 'error' ? (
            <div className="h-[30vh] flex flex-col items-center justify-center gap-3 p-6 text-center">
              <AlertCircle className="h-6 w-6 text-error-600" />
              <p className="text-sm text-secondary max-w-md">{pdf.message}</p>
              <Button variant="secondary" size="sm" onClick={retry}>
                {copy.retry}
              </Button>
            </div>
          ) : (
            <iframe title={copy.frameTitle(item.employeeName)} src={pdf.url} className="w-full h-[60vh] bg-white" />
          )}
        </div>
      </div>
    </Modal>
  );
}
