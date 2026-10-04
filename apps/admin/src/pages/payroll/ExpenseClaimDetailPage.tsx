import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Info,
  Loader2,
  Send,
  ThumbsDown,
  ThumbsUp,
  Wallet,
  XCircle,
} from 'lucide-react';
import { usePermissions } from '@hrm/portal-ui';
import type { ExpenseClaimDetailRecord } from '@hrm/shared-types';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Label, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Progress } from '@/components/ui/Progress';
import { StatusPill } from '@/components/ui/StatusPill';
import { Avatar } from '@/components/ui/Toggle';
import { ExpenseReceiptViewer } from '@/components/payroll/ExpenseReceiptViewer';
import { WorkflowApprovalTimeline } from '@/components/workflow/WorkflowApprovalTimeline';
import { useNav } from '@/context/NavContext';
import { pathForPage } from '@/config/routes';
import {
  approveExpenseClaim,
  cancelExpenseClaim,
  getExpenseClaim,
  reimburseExpenseClaim,
  rejectExpenseClaim,
  submitExpenseClaim,
} from '@/lib/expenses-api';
import {
  EXPENSE_STATUS_LABELS,
  EXPENSE_STATUS_TONE,
  daysWaiting,
  expenseStepLabel,
  formatClaimAmount,
} from '@/lib/expense-display';
import { formatDate, formatMoney } from '@/lib/payroll-copy';
import { ApiError } from '@/lib/tenant-api-client';

type ConfirmAction = 'submit' | 'cancel' | 'reimburse';

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

export function ExpenseClaimDetailPage() {
  const { claimId = '' } = useParams();
  const routerNavigate = useNavigate();
  const location = useLocation();
  const { openEmployee, navigate } = useNav();
  const { user, can } = usePermissions();
  const canApprove = can('payroll', 'approve');
  const canCreate = can('payroll', 'create');

  const [claim, setClaim] = useState<ExpenseClaimDetailRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    (location.state as { notice?: string } | null)?.notice ?? null,
  );
  const [warning] = useState<string | null>((location.state as { warning?: string } | null)?.warning ?? null);
  const [comment, setComment] = useState('');
  const [deciding, setDeciding] = useState<'approve' | 'reject' | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setClaim(await getExpenseClaim(claimId));
    } catch (err) {
      setClaim(null);
      setError(errorText(err, 'Could not load this expense claim'));
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const goToList = () => routerNavigate(pathForPage('expenses'));

  const decide = async (action: 'approve' | 'reject') => {
    if (!claim) return;
    const text = comment.trim();
    if (action === 'reject' && !text) {
      setDecisionError('Add a reason so the employee knows why the claim was rejected.');
      return;
    }
    setDeciding(action);
    setDecisionError(null);
    try {
      const record =
        action === 'approve'
          ? await approveExpenseClaim(claim.id, text || undefined)
          : await rejectExpenseClaim(claim.id, text);
      setComment('');
      setNotice(
        action === 'reject'
          ? `Rejected ${claim.referenceNumber}. ${claim.employeeName} will be notified.`
          : record.status === 'approved'
            ? `Approved ${claim.referenceNumber}. It is now waiting to be reimbursed.`
            : `Approved your step — ${expenseStepLabel(record)?.split(' · ')[1] ?? 'the next approver'} is next.`,
      );
      await load();
    } catch (err) {
      setDecisionError(errorText(err, 'The decision could not be saved'));
    } finally {
      setDeciding(null);
    }
  };

  const runConfirmed = async () => {
    if (!claim || !confirm) return;
    setConfirming(true);
    setActionError(null);
    try {
      if (confirm === 'submit') {
        await submitExpenseClaim(claim.id);
        setNotice(`${claim.referenceNumber} submitted for approval.`);
      } else if (confirm === 'cancel') {
        await cancelExpenseClaim(claim.id);
        setNotice(`${claim.referenceNumber} cancelled.`);
      } else {
        await reimburseExpenseClaim(claim.id);
        setNotice(`${claim.referenceNumber} marked as reimbursed.`);
      }
      setConfirm(null);
      await load();
    } catch (err) {
      setConfirm(null);
      setActionError(errorText(err, 'The action could not be completed'));
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-secondary">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading expense claim…
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-4">
        <BackLink onClick={goToList} />
        <div className="rounded-lg border border-error-200 bg-error-50 dark:bg-error-950/30 px-4 py-3 text-sm text-error-700 dark:text-error-300">
          {error ?? 'This expense claim could not be found.'}
        </div>
      </div>
    );
  }

  const isOwn = !!user?.employeeId && user.employeeId === claim.employeeId;
  const pending = claim.status === 'pending_approval';
  const draft = claim.status === 'draft';
  const stepLabel = expenseStepLabel(claim);
  const waiting = daysWaiting(claim);
  const limit = claim.limitCheck;
  const missingReceipt = claim.categoryReceiptRequired && claim.receipts.length === 0;
  const overLimit = (pending || draft) && (limit.exceedsPerClaim || limit.exceedsPerMonth);
  const canReimburse = claim.status === 'approved' && canApprove && !isOwn;

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-[1400px] mx-auto">
      <BackLink onClick={goToList} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-primary">{claim.description || claim.categoryName}</h1>
            <StatusPill tone={EXPENSE_STATUS_TONE[claim.status]}>
              {pending ? claim.displayStatus : EXPENSE_STATUS_LABELS[claim.status]}
            </StatusPill>
          </div>
          <div className="mt-1 text-sm text-secondary">
            <span className="font-mono">{claim.referenceNumber}</span> · {claim.categoryName} · spent{' '}
            {formatDate(claim.expenseDate)}
          </div>
          <button
            type="button"
            onClick={() => openEmployee(claim.employeeId)}
            className="mt-3 inline-flex items-center gap-2.5 rounded-lg pr-2 hover:bg-[rgb(var(--bg-hover))]"
          >
            <Avatar name={claim.employeeName ?? 'Employee'} size="sm" />
            <span className="text-left">
              <span className="block text-sm font-medium text-primary">{claim.employeeName}</span>
              <span className="block text-xs text-muted">{claim.employeeNumber}</span>
            </span>
          </button>
        </div>
        <div className="flex flex-col items-start gap-2 lg:items-end">
          <div className="text-2xl font-bold text-primary">{formatClaimAmount(claim)}</div>
          <div className="flex flex-wrap gap-2">
            {(draft || pending) && canCreate ? (
              <Button variant="ghost" onClick={() => setConfirm('cancel')}>
                <Ban className="h-4 w-4" /> Cancel claim
              </Button>
            ) : null}
            {draft && canCreate ? (
              <Button variant="primary" onClick={() => setConfirm('submit')} disabled={missingReceipt}>
                <Send className="h-4 w-4" /> Submit for approval
              </Button>
            ) : null}
            {canReimburse ? (
              <Button variant="primary" onClick={() => setConfirm('reimburse')}>
                <Wallet className="h-4 w-4" /> Mark reimbursed
              </Button>
            ) : null}
          </div>
          {claim.status === 'approved' && canApprove && isOwn ? (
            <p className="text-xs text-muted">Another approver has to record the reimbursement of your own claim.</p>
          ) : null}
        </div>
      </div>

      {notice ? <Banner tone="success" icon={<CheckCircle2 className="h-4 w-4" />}>{notice}</Banner> : null}
      {warning ? <Banner tone="warning" icon={<AlertTriangle className="h-4 w-4" />}>{warning}</Banner> : null}
      {actionError ? <Banner tone="error" icon={<XCircle className="h-4 w-4" />}>{actionError}</Banner> : null}
      {claim.status === 'rejected' ? (
        <Banner tone="error" icon={<XCircle className="h-4 w-4" />}>
          <span className="font-medium">Rejected {formatDate(claim.rejectedAt)}.</span>{' '}
          {claim.rejectionReason ?? 'No reason was recorded.'}
        </Banner>
      ) : null}
      {claim.status === 'approved' ? (
        <Banner tone="info" icon={<Info className="h-4 w-4" />}>
          Approved {formatDate(claim.approvedAt)}. Pay the employee back, then mark the claim as reimbursed — payroll
          does not pick up expense claims automatically.
        </Banner>
      ) : null}
      {overLimit ? (
        <Banner tone="warning" icon={<AlertTriangle className="h-4 w-4" />}>
          {limit.exceedsPerClaim
            ? `This claim is above the ${formatMoney(limit.maxAmountPerClaim)} per-claim limit for ${claim.categoryName}.`
            : `With this claim, ${claim.employeeName}'s ${claim.categoryName} claims for the month would exceed the ${formatMoney(limit.maxAmountPerMonth)} monthly limit.`}{' '}
          The limit may have changed after the claim was created.
        </Banner>
      ) : null}
      {draft && missingReceipt ? (
        <Banner tone="warning" icon={<AlertTriangle className="h-4 w-4" />}>
          {claim.categoryName} claims need a receipt before they can be submitted.
        </Banner>
      ) : null}
      {draft && !claim.categoryIsActive ? (
        <Banner tone="warning" icon={<AlertTriangle className="h-4 w-4" />}>
          The {claim.categoryName} category has been deactivated, so this draft can no longer be submitted.
        </Banner>
      ) : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <CardTitle>
              Receipts{claim.receipts.length ? ` (${claim.receipts.length})` : ''}
            </CardTitle>
          </CardHeader>
          <CardBody>
            <ExpenseReceiptViewer
              claimId={claim.id}
              receipts={claim.receipts}
              canUpload={canCreate && (draft || pending)}
              receiptRequired={claim.categoryReceiptRequired}
              onUploaded={async () => {
                setNotice('Receipt added.');
                await load();
              }}
            />
          </CardBody>
        </Card>

        <div className="space-y-5">
          {claim.canAct ? (
            <Card className="border-accent-300 dark:border-accent-800">
              <CardHeader>
                <CardTitle>Your decision</CardTitle>
              </CardHeader>
              <CardBody className="space-y-3">
                <p className="text-sm text-secondary">
                  {stepLabel}. Check the receipt and amount before approving.
                </p>
                <div>
                  <Label htmlFor="expense-decision-comment">Comment (required to reject)</Label>
                  <Textarea
                    id="expense-decision-comment"
                    rows={3}
                    maxLength={1000}
                    value={comment}
                    onChange={(e) => {
                      setComment(e.target.value);
                      if (decisionError) setDecisionError(null);
                    }}
                    placeholder="e.g. Matches the receipt — approved"
                  />
                </div>
                {decisionError ? <p className="text-sm text-error-600">{decisionError}</p> : null}
                <div className="flex justify-end gap-2">
                  <Button variant="danger" onClick={() => void decide('reject')} disabled={deciding !== null}>
                    {deciding === 'reject' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ThumbsDown className="h-4 w-4" />
                    )}
                    Reject
                  </Button>
                  <Button variant="primary" onClick={() => void decide('approve')} disabled={deciding !== null}>
                    {deciding === 'approve' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ThumbsUp className="h-4 w-4" />
                    )}
                    Approve
                  </Button>
                </div>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Approval chain</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              {claim.approvalRoute ? (
                <>
                  {draft ? (
                    <p className="text-xs text-muted">Submitting now would route the claim through this chain.</p>
                  ) : null}
                  <WorkflowApprovalTimeline
                    route={claim.approvalRoute}
                    workflow={claim.workflow}
                    entityLabel="expense"
                    actorNames={claim.stepActors}
                    onConfigure={can('settings', 'view') ? () => navigate('settings-workflows') : undefined}
                  />
                </>
              ) : (
                <p className="text-sm text-secondary">No approval workflow was recorded for this claim.</p>
              )}
              {pending && !claim.canAct ? (
                <p className="rounded-md bg-[rgb(var(--bg-muted))] px-3 py-2 text-xs text-secondary">
                  {isOwn
                    ? 'This is your own claim — other approvers decide it.'
                    : canApprove
                      ? `Waiting on ${stepLabel?.split(' · ')[1] ?? 'the current approver'}. You can't act on this step.`
                      : `Waiting on ${stepLabel?.split(' · ')[1] ?? 'the current approver'}.`}
                  {waiting != null ? ` Submitted ${waiting === 0 ? 'today' : `${waiting} ${waiting === 1 ? 'day' : 'days'} ago`}.` : ''}
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Category limits</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4 text-sm">
              <LimitRow
                label="Per claim"
                limit={limit.maxAmountPerClaim}
                used={claim.amount}
                usedLabel={`This claim ${formatMoney(claim.amount)}`}
                exceeded={limit.exceedsPerClaim}
              />
              <LimitRow
                label={`Monthly (${monthLabel(limit.month)})`}
                limit={limit.maxAmountPerMonth}
                used={limit.otherClaimsThisMonth + claim.amount}
                usedLabel={`${formatMoney(limit.otherClaimsThisMonth)} other claims + ${formatMoney(claim.amount)} this claim`}
                exceeded={limit.exceedsPerMonth}
              />
              <p className="text-xs text-muted">
                Other claims counts {claim.employeeName}'s pending, approved and reimbursed {claim.categoryName}{' '}
                claims dated in the same month.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Claim details</CardTitle>
            </CardHeader>
            <CardBody>
              <dl className="space-y-3 text-sm">
                <Detail label="Category">{claim.categoryName}</Detail>
                <Detail label="Amount">{formatClaimAmount(claim)}</Detail>
                <Detail label="Expense date">{formatDate(claim.expenseDate)}</Detail>
                <Detail label="Receipt">
                  {claim.categoryReceiptRequired ? 'Required' : 'Optional'} · {claim.receipts.length} attached
                </Detail>
                <Detail label="Created">{formatDate(claim.createdAt)}</Detail>
                {claim.submittedAt ? <Detail label="Submitted">{formatDate(claim.submittedAt)}</Detail> : null}
                {claim.approvedAt ? <Detail label="Approved">{formatDate(claim.approvedAt)}</Detail> : null}
                {claim.rejectedAt ? <Detail label="Rejected">{formatDate(claim.rejectedAt)}</Detail> : null}
                {claim.reimbursedAt ? <Detail label="Reimbursed">{formatDate(claim.reimbursedAt)}</Detail> : null}
                {claim.description ? (
                  <div>
                    <dt className="text-muted">Description</dt>
                    <dd className="mt-0.5 whitespace-pre-line text-primary">{claim.description}</dd>
                  </div>
                ) : null}
              </dl>
            </CardBody>
          </Card>
        </div>
      </div>

      <Modal
        open={confirm !== null}
        onClose={() => !confirming && setConfirm(null)}
        title={
          confirm === 'submit'
            ? 'Submit for approval?'
            : confirm === 'cancel'
              ? 'Cancel this claim?'
              : 'Mark as reimbursed?'
        }
        description={`${claim.referenceNumber} · ${claim.employeeName} · ${formatClaimAmount(claim)}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)} disabled={confirming}>
              Back
            </Button>
            <Button
              variant={confirm === 'cancel' ? 'danger' : 'primary'}
              onClick={() => void runConfirmed()}
              disabled={confirming}
            >
              {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {confirm === 'submit' ? 'Submit' : confirm === 'cancel' ? 'Cancel claim' : 'Mark reimbursed'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-secondary">
          {confirm === 'submit'
            ? `The claim goes to ${claim.approvalRoute?.name ?? 'the expense approval workflow'} and can no longer be edited.`
            : confirm === 'cancel'
              ? 'The claim is closed and any pending approval steps are withdrawn. This cannot be undone.'
              : `Confirm that ${formatClaimAmount(claim)} has been paid back to ${claim.employeeName}. This closes the claim and cannot be undone.`}
        </p>
      </Modal>
    </div>
  );
}

function monthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return new Date(Date.UTC(year, m - 1, 1)).toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function LimitRow({
  label,
  limit,
  used,
  usedLabel,
  exceeded,
}: {
  label: string;
  limit: number | null;
  used: number;
  usedLabel: string;
  exceeded: boolean;
}) {
  return (
    <div>
      <div className="flex justify-between gap-3">
        <span className="text-secondary">{label}</span>
        <span className={exceeded ? 'font-medium text-error-600' : 'text-primary'}>
          {limit == null ? 'No limit' : `${formatMoney(used)} of ${formatMoney(limit)}`}
        </span>
      </div>
      {limit != null ? (
        <>
          <div className="mt-1.5">
            <Progress value={Math.min(100, (used / limit) * 100)} tone={exceeded ? 'error' : 'accent'} />
          </div>
          <p className="mt-1 text-xs text-muted">{usedLabel}</p>
        </>
      ) : null}
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-primary"
    >
      <ArrowLeft className="h-4 w-4" /> Expense Claims
    </button>
  );
}

const BANNER_TONES = {
  info: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200',
  success:
    'border-success-200 bg-success-50 text-success-700 dark:border-success-900 dark:bg-success-950/30 dark:text-success-300',
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

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted shrink-0">{label}</dt>
      <dd className="text-right text-primary">{children}</dd>
    </div>
  );
}
