import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Info,
  Loader2,
  Send,
  XCircle,
} from 'lucide-react';
import type { ExpenseClaimDetailRecord } from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { ExpenseReceiptViewer } from '@/components/payroll/ExpenseReceiptViewer';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Progress } from '@/components/ui/Progress';
import { StatusPill } from '@/components/ui/StatusPill';
import { WorkflowApprovalTimeline } from '@/components/workflow/WorkflowApprovalTimeline';
import {
  cancelExpenseClaim,
  getExpenseClaim,
  submitExpenseClaim,
} from '@/lib/expenses-api';
import {
  EXPENSE_STATUS_TONE,
  formatClaimAmount,
} from '@/lib/expense-display';
import { formatDate, formatMoney } from '@/lib/payroll-copy';
import { ApiError } from '@/lib/tenant-api-client';

interface ExpenseClaimDetailModalProps {
  claimId: string | null;
  onClose: () => void;
  onUpdated: (notice?: string) => void | Promise<void>;
}

export function ExpenseClaimDetailModal({
  claimId,
  onClose,
  onUpdated,
}: ExpenseClaimDetailModalProps) {
  const { t } = useAppTranslation();
  const [claim, setClaim] = useState<ExpenseClaimDetailRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const load = useCallback(async () => {
    if (!claimId) return;
    setLoading(true);
    setError(null);
    setConfirmCancel(false);
    try {
      setClaim(await getExpenseClaim(claimId));
    } catch (err) {
      setClaim(null);
      setError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : t('common.error'),
      );
    } finally {
      setLoading(false);
    }
  }, [claimId, t]);

  useEffect(() => {
    if (!claimId) {
      setClaim(null);
      setError(null);
      return;
    }
    void load();
  }, [claimId, load]);

  const handleSubmit = async () => {
    if (!claim) return;
    setActionLoading(true);
    setError(null);
    try {
      await submitExpenseClaim(claim.id);
      await load();
      await onUpdated(
        t('myExpenses.submittedSuccess', { ref: claim.referenceNumber }),
      );
    } catch (err) {
      setError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : t('common.error'),
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!claim) return;
    setActionLoading(true);
    setError(null);
    try {
      await cancelExpenseClaim(claim.id);
      await load();
      await onUpdated(
        t('myExpenses.cancelledSuccess', { ref: claim.referenceNumber }),
      );
    } catch (err) {
      setError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : t('common.error'),
      );
    } finally {
      setActionLoading(false);
      setConfirmCancel(false);
    }
  };

  const isDraft = claim?.status === 'draft';
  const isPending = claim?.status === 'pending_approval';
  const missingReceipt =
    !!claim && claim.categoryReceiptRequired && claim.receipts.length === 0;
  const overLimit =
    !!claim &&
    (isDraft || isPending) &&
    (claim.limitCheck.exceedsPerClaim || claim.limitCheck.exceedsPerMonth);

  const limit = claim?.limitCheck;
  const totalWithThisClaim = claim && limit ? limit.otherClaimsThisMonth + claim.amount : 0;

  return (
    <Modal
      open={!!claimId}
      onClose={onClose}
      size="lg"
      title={
        claim
          ? t('myExpenses.detailTitle', { ref: claim.referenceNumber })
          : t('myExpenses.newClaim')
      }
      footer={
        <>
          {claim && (isDraft || isPending) ? (
            confirmCancel ? (
              <div className="flex items-center gap-2 mr-auto">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => void handleCancel()}
                  disabled={actionLoading}
                >
                  {t('myExpenses.confirmCancel')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmCancel(false)}
                  disabled={actionLoading}
                >
                  {t('myExpenses.keepClaim')}
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                className="mr-auto"
                onClick={() => setConfirmCancel(true)}
                disabled={actionLoading}
              >
                <Ban className="h-4 w-4" />
                {t('myExpenses.cancel')}
              </Button>
            )
          ) : null}

          {claim && isDraft ? (
            <Button
              variant="primary"
              onClick={() => void handleSubmit()}
              disabled={actionLoading || missingReceipt}
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {t('myExpenses.submitClaim')}
            </Button>
          ) : null}

          <Button variant="secondary" onClick={onClose}>
            {t('myExpenses.close')}
          </Button>
        </>
      }
    >
      {loading && !claim ? (
        <div className="flex items-center justify-center py-10 text-secondary">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          {t('common.loading')}
        </div>
      ) : error && !claim ? (
        <div className="rounded-lg border border-error-200 bg-error-50 dark:bg-error-950/30 px-4 py-3 text-sm text-error-700 dark:text-error-300">
          {error}
        </div>
      ) : claim ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-base">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold text-primary">
                  {claim.description || claim.categoryName}
                </span>
                <StatusPill tone={EXPENSE_STATUS_TONE[claim.status]}>
                  {t(`myExpenses.status.${claim.status}`)}
                </StatusPill>
              </div>
              <div className="text-xs text-muted mt-1">
                {claim.categoryName} · {formatDate(claim.expenseDate)}
              </div>
            </div>
            <div className="text-xl font-bold text-primary">
              {formatClaimAmount(claim)}
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-error-200 bg-error-50 dark:bg-error-950/30 px-3 py-2 text-sm text-error-700 dark:text-error-300">
              {error}
            </div>
          ) : null}

          {claim.status === 'rejected' ? (
            <div className="rounded-lg border border-error-200 bg-error-50 dark:bg-error-950/30 px-3 py-2.5 text-sm text-error-700 dark:text-error-300 flex items-start gap-2">
              <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                {t('myExpenses.rejectionNote', {
                  date: formatDate(claim.rejectedAt),
                  reason: claim.rejectionReason ?? '—',
                })}
              </span>
            </div>
          ) : null}

          {claim.status === 'approved' ? (
            <div className="rounded-lg border border-accent-200 bg-accent-50 dark:bg-accent-950/30 px-3 py-2.5 text-sm text-accent-700 dark:text-accent-300 flex items-start gap-2">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                {t('myExpenses.approvedReimburseNote', {
                  date: formatDate(claim.approvedAt),
                })}
              </span>
            </div>
          ) : null}

          {claim.status === 'reimbursed' ? (
            <div className="rounded-lg border border-success-200 bg-success-50 dark:bg-success-950/30 px-3 py-2.5 text-sm text-success-700 dark:text-success-300 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                {t('myExpenses.reimbursedNote', {
                  date: formatDate(claim.reimbursedAt),
                })}
              </span>
            </div>
          ) : null}

          {overLimit ? (
            <div className="rounded-lg border border-warning-200 bg-warning-50 dark:bg-warning-950/30 px-3 py-2.5 text-sm text-warning-800 dark:text-warning-300 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{t('myExpenses.overLimitBanner')}</span>
            </div>
          ) : null}

          {isDraft && missingReceipt ? (
            <div className="rounded-lg border border-warning-200 bg-warning-50 dark:bg-warning-950/30 px-3 py-2.5 text-sm text-warning-800 dark:text-warning-300 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                {t('myExpenses.missingRequiredReceipt', {
                  category: claim.categoryName ?? '',
                })}
              </span>
            </div>
          ) : null}

          {limit ? (
            <div className="rounded-lg border border-base p-3 space-y-2">
              <div className="text-xs font-semibold text-secondary uppercase tracking-wider">
                {t('myExpenses.detailLimitSection', { month: limit.month })}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex justify-between text-secondary">
                    <span>{t('myExpenses.detailThisClaim')}</span>
                    <span className="font-medium text-primary">
                      {formatMoney(claim.amount)} {claim.currency}
                    </span>
                  </div>
                  {limit.maxAmountPerClaim != null ? (
                    <Progress
                      value={claim.amount}
                      max={limit.maxAmountPerClaim}
                      tone={limit.exceedsPerClaim ? 'error' : 'accent'}
                    />
                  ) : null}
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-secondary">
                    <span>{t('myExpenses.detailOtherMonth')}</span>
                    <span className="font-medium text-primary">
                      {formatMoney(limit.otherClaimsThisMonth)} {claim.currency}
                    </span>
                  </div>
                  {limit.maxAmountPerMonth != null ? (
                    <Progress
                      value={totalWithThisClaim}
                      max={limit.maxAmountPerMonth}
                      tone={limit.exceedsPerMonth ? 'error' : 'success'}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {claim.approvalRoute ? (
            <div className="rounded-lg border border-base p-3 space-y-2">
              <div className="text-xs font-semibold text-secondary uppercase tracking-wider">
                {t('myExpenses.detailApprovalChain')}
              </div>
              <WorkflowApprovalTimeline
                route={claim.approvalRoute}
                workflow={claim.workflow}
                entityLabel="expense claim"
                actorNames={claim.stepActors}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="text-xs font-semibold text-secondary uppercase tracking-wider">
              {t('myExpenses.detailReceipts')} ({claim.receipts.length})
            </div>
            <ExpenseReceiptViewer
              claimId={claim.id}
              receipts={claim.receipts}
              canUpload={isDraft || isPending}
              receiptRequired={claim.categoryReceiptRequired}
              onUploaded={async () => {
                await load();
                await onUpdated();
              }}
            />
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

