import { useState } from 'react';
import {
  CheckCircle2,
  CreditCard,
  FileText,
  Loader2,
  Send,
  XCircle,
} from 'lucide-react';
import type { ContractorInvoiceRecord } from '@hrm/shared-types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Label, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import {
  approveContractorInvoice,
  INVOICE_STATUS_LABELS,
  markContractorInvoicePaid,
  rejectContractorInvoice,
  submitContractorInvoice,
} from '@/lib/contractors-api';
import { ApiError } from '@/lib/tenant-api-client';
import {
  AP_PRIMARY_BUTTON_CLASS,
  formatContractorDate,
  formatContractorMoney,
  INVOICE_STATUS_TONE,
  isInvoiceOverdue,
} from './contractor-ui.utils';

interface ContractorInvoiceActionsHookProps {
  onSuccess: () => Promise<void> | void;
  onError: (message: string) => void;
}

export function useContractorInvoiceActions({
  onSuccess,
  onError,
}: ContractorInvoiceActionsHookProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<ContractorInvoiceRecord | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ContractorInvoiceRecord | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [payTarget, setPayTarget] = useState<ContractorInvoiceRecord | null>(null);
  const [paymentReference, setPaymentReference] = useState('');

  const runAction = async (invoiceId: string, fn: () => Promise<unknown>) => {
    setBusyId(invoiceId);
    try {
      await fn();
      await onSuccess();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Invoice workflow action failed');
    } finally {
      setBusyId(null);
    }
  };

  const submitInvoice = (invoice: ContractorInvoiceRecord) =>
    void runAction(invoice.id, () => submitContractorInvoice(invoice.id));

  const approveInvoice = (invoice: ContractorInvoiceRecord) =>
    void runAction(invoice.id, () => approveContractorInvoice(invoice.id));

  const openRejectModal = (invoice: ContractorInvoiceRecord) => {
    setRejectTarget(invoice);
    setRejectReason('');
  };

  const openPayModal = (invoice: ContractorInvoiceRecord) => {
    setPayTarget(invoice);
    setPaymentReference('');
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    await runAction(rejectTarget.id, () =>
      rejectContractorInvoice(rejectTarget.id, rejectReason.trim() || undefined),
    );
    setRejectTarget(null);
    setRejectReason('');
    setDetailInvoice(null);
  };

  const confirmMarkPaid = async () => {
    if (!payTarget) return;
    await runAction(payTarget.id, () =>
      markContractorInvoicePaid(payTarget.id, paymentReference.trim() || undefined),
    );
    setPayTarget(null);
    setPaymentReference('');
    setDetailInvoice(null);
  };

  return {
    busyId,
    detailInvoice,
    setDetailInvoice,
    rejectTarget,
    setRejectTarget,
    rejectReason,
    setRejectReason,
    payTarget,
    setPayTarget,
    paymentReference,
    setPaymentReference,
    submitInvoice,
    approveInvoice,
    openRejectModal,
    openPayModal,
    confirmReject,
    confirmMarkPaid,
  };
}

interface ContractorInvoiceModalsProps {
  state: ReturnType<typeof useContractorInvoiceActions>;
  canEdit: boolean;
  canApprove: boolean;
  canFinalize: boolean;
}

export function ContractorInvoiceModals({
  state,
  canEdit,
  canApprove,
  canFinalize,
}: ContractorInvoiceModalsProps) {
  const {
    busyId,
    detailInvoice,
    setDetailInvoice,
    rejectTarget,
    setRejectTarget,
    rejectReason,
    setRejectReason,
    payTarget,
    setPayTarget,
    paymentReference,
    setPaymentReference,
    submitInvoice,
    approveInvoice,
    openRejectModal,
    openPayModal,
    confirmReject,
    confirmMarkPaid,
  } = state;

  return (
    <>
      <Modal
        open={Boolean(detailInvoice)}
        onClose={() => setDetailInvoice(null)}
        title={detailInvoice ? `Invoice ${detailInvoice.invoiceNumber}` : 'Invoice details'}
        description={
          detailInvoice
            ? `${detailInvoice.contractorName} · Contract ${detailInvoice.contractNumber}`
            : undefined
        }
        size="lg"
        footer={
          detailInvoice ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {canEdit && detailInvoice.status === 'draft' && (
                <Button
                  size="sm"
                  className={AP_PRIMARY_BUTTON_CLASS}
                  disabled={busyId === detailInvoice.id}
                  onClick={() => {
                    submitInvoice(detailInvoice);
                    setDetailInvoice(null);
                  }}
                >
                  <Send className="h-3.5 w-3.5" /> Submit for approval
                </Button>
              )}
              {canApprove && detailInvoice.status === 'submitted' && (
                <>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busyId === detailInvoice.id}
                    onClick={() => openRejectModal(detailInvoice)}
                  >
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </Button>
                  <Button
                    size="sm"
                    className={AP_PRIMARY_BUTTON_CLASS}
                    disabled={busyId === detailInvoice.id}
                    onClick={() => {
                      approveInvoice(detailInvoice);
                      setDetailInvoice(null);
                    }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve invoice
                  </Button>
                </>
              )}
              {canFinalize &&
                (detailInvoice.status === 'approved' ||
                  detailInvoice.status === 'scheduled') && (
                  <Button
                    size="sm"
                    className={AP_PRIMARY_BUTTON_CLASS}
                    disabled={busyId === detailInvoice.id}
                    onClick={() => openPayModal(detailInvoice)}
                  >
                    <CreditCard className="h-3.5 w-3.5" /> Mark paid
                  </Button>
                )}
              <Button variant="secondary" size="sm" onClick={() => setDetailInvoice(null)}>
                Close
              </Button>
            </div>
          ) : undefined
        }
      >
        {detailInvoice && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg border border-teal-200 dark:border-teal-900/70 bg-teal-50/40 dark:bg-teal-950/25 p-3">
              <div>
                <p className="text-[11px] text-muted uppercase">Status</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <Badge tone={INVOICE_STATUS_TONE[detailInvoice.status]} dot>
                    {INVOICE_STATUS_LABELS[detailInvoice.status]}
                  </Badge>
                  {isInvoiceOverdue(detailInvoice) && <Badge tone="error">Overdue</Badge>}
                </div>
              </div>
              <div>
                <p className="text-[11px] text-muted uppercase">Amount</p>
                <p className="text-base font-bold font-mono text-primary mt-0.5">
                  {formatContractorMoney(detailInvoice.amount, detailInvoice.currency)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted uppercase">Issued</p>
                <p className="text-xs font-medium text-primary mt-1">
                  {formatContractorDate(detailInvoice.issuedAt)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted uppercase">Due date</p>
                <p className="text-xs font-medium text-primary mt-1">
                  {formatContractorDate(detailInvoice.dueAt)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-muted">Billing period / label</p>
                <p className="text-primary font-medium mt-0.5">
                  {detailInvoice.periodLabel ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-muted">Payment reference</p>
                <p className="text-primary font-mono font-medium mt-0.5">
                  {detailInvoice.paymentReference ?? '—'}
                </p>
              </div>
              {detailInvoice.hoursWorked && (
                <div>
                  <p className="text-muted">Billed hours × hourly rate</p>
                  <p className="text-primary font-mono font-medium mt-0.5">
                    {detailInvoice.hoursWorked} hrs ×{' '}
                    {detailInvoice.hourlyRate
                      ? formatContractorMoney(detailInvoice.hourlyRate, detailInvoice.currency)
                      : '—'}
                  </p>
                </div>
              )}
              {detailInvoice.paidAt && (
                <div>
                  <p className="text-muted">Settled on</p>
                  <p className="text-primary font-medium mt-0.5">
                    {formatContractorDate(detailInvoice.paidAt)}
                  </p>
                </div>
              )}
            </div>

            {detailInvoice.description && (
              <div>
                <p className="text-xs text-muted mb-1">Description / commercial memo</p>
                <p className="text-sm text-secondary rounded-lg border border-base p-3 bg-[rgb(var(--bg-muted))]">
                  {detailInvoice.description}
                </p>
              </div>
            )}

            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-primary mb-2">
                <FileText className="h-3.5 w-3.5 text-teal-600" />
                Line items ({detailInvoice.lineItems.length})
              </div>
              {detailInvoice.lineItems.length === 0 ? (
                <p className="text-xs text-muted rounded-lg border border-dashed border-base p-3 text-center">
                  No itemized lines attached to this invoice.
                </p>
              ) : (
                <div className="rounded-lg border border-base overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[rgb(var(--bg-muted))] text-[11px] uppercase text-muted">
                      <tr>
                        <th className="px-3 py-2 font-medium">Description</th>
                        <th className="px-3 py-2 font-medium text-right">Qty</th>
                        <th className="px-3 py-2 font-medium text-right">Unit</th>
                        <th className="px-3 py-2 font-medium text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgb(var(--border-base))]">
                      {detailInvoice.lineItems.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2 text-primary">{item.description}</td>
                          <td className="px-3 py-2 text-right font-mono text-secondary">
                            {item.quantity ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-secondary">
                            {item.unitAmount
                              ? formatContractorMoney(item.unitAmount, detailInvoice.currency)
                              : '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-medium text-primary">
                            {formatContractorMoney(item.amount, detailInvoice.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        title={`Reject invoice ${rejectTarget?.invoiceNumber ?? ''}`}
        description="Returns the invoice to rejected status and releases any linked contract milestone back to pending."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busyId === rejectTarget?.id}
              onClick={() => void confirmReject()}
            >
              {busyId === rejectTarget?.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Confirm reject'
              )}
            </Button>
          </>
        }
      >
        <div>
          <Label>Rejection reason (audit logged)</Label>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            placeholder="e.g. Discrepancy in billed hours or missing SOW sign-off"
          />
        </div>
      </Modal>

      <Modal
        open={Boolean(payTarget)}
        onClose={() => setPayTarget(null)}
        title={`Mark invoice ${payTarget?.invoiceNumber ?? ''} paid`}
        description={
          payTarget
            ? `Record direct B2B AP settlement of ${formatContractorMoney(payTarget.amount, payTarget.currency)} to ${payTarget.contractorName}.`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPayTarget(null)}>
              Cancel
            </Button>
            <Button
              className={AP_PRIMARY_BUTTON_CLASS}
              disabled={busyId === payTarget?.id}
              onClick={() => void confirmMarkPaid()}
            >
              {busyId === payTarget?.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Record payment'
              )}
            </Button>
          </>
        }
      >
        <div>
          <Label>Bank / wire / EFT reference</Label>
          <Input
            value={paymentReference}
            onChange={(e) => setPaymentReference(e.target.value)}
            placeholder="e.g. EFT-20261110-AP01"
            className="font-mono"
          />
        </div>
      </Modal>
    </>
  );
}

