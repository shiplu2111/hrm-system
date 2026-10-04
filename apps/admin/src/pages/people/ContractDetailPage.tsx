import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  History,
  Loader2,
  Lock,
  Pencil,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { EmploymentContractDocumentRecord, EmploymentContractRecord } from '@hrm/shared-types';
import { usePermissions } from '@hrm/portal-ui';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input, Label, Textarea } from '@/components/ui/Form';
import { FieldError } from '@/components/ui/FieldError';
import { ContractStatusBadge, ContractTypeBadge } from '@/components/contracts/ContractBadges';
import { ContractTermsFields } from '@/components/contracts/ContractTermsFields';
import { useNav } from '@/context/NavContext';
import {
  CONTRACT_TYPE_LABELS,
  PAY_FREQUENCY_LABELS,
  activateEmploymentContract,
  approveContractRenewal,
  deleteContractDocument,
  getContractDocumentFileUrl,
  getEmploymentContract,
  listEmploymentContracts,
  rejectContractRenewal,
  renewEmploymentContract,
  submitContractRenewal,
  terminateEmploymentContract,
  updateEmploymentContract,
  uploadContractDocument,
} from '@/lib/contracts-api';
import {
  addDays,
  canRenew,
  daysUntil,
  formatBytes,
  formatContractDate,
  formatContractPay,
  formatOvertimeRule,
  openRenewalOf,
  relativeDays,
  termsFormFromRecord,
  termsFormToUpdateInput,
  validateTermsForm,
  type ContractTermsForm,
} from '@/lib/contract-form';
import { ApiError } from '@/lib/tenant-api-client';

const errorMessage = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

function Term({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm text-primary">{children}</dd>
    </div>
  );
}

function Banner({
  tone,
  icon: Icon,
  title,
  children,
  action,
}: {
  tone: 'warning' | 'info' | 'error';
  icon: typeof AlertTriangle;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const styles = {
    warning: 'bg-warning-50 dark:bg-warning-950/30 border-warning-200 dark:border-warning-800/60 text-warning-800 dark:text-warning-300',
    info: 'bg-accent-50 dark:bg-accent-950/30 border-accent-200 dark:border-accent-800/60 text-primary',
    error: 'bg-error-50 dark:bg-error-950/30 border-error-200 dark:border-error-800/60 text-error-800 dark:text-error-300',
  }[tone];
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border ${styles}`}>
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{title}</div>
        {children ? <div className="text-xs mt-0.5 opacity-90">{children}</div> : null}
      </div>
      {action}
    </div>
  );
}

/** Suggested end for a renewal: same length as the contract it replaces. */
function suggestedRenewalEnd(contract: EmploymentContractRecord, startDate: string): string {
  if (!contract.endDate || !startDate) return '';
  const lengthDays = Math.round(
    (Date.parse(`${contract.endDate}T00:00:00Z`) - Date.parse(`${contract.startDate}T00:00:00Z`)) / 86_400_000,
  );
  return lengthDays > 0 ? addDays(startDate, lengthDays) : '';
}

function renewDefaults(contract: EmploymentContractRecord) {
  const startDate = contract.endDate ? addDays(contract.endDate, 1) : '';
  return { startDate, endDate: suggestedRenewalEnd(contract, startDate), probationEndDate: '', submit: true };
}

export function ContractDetailPage() {
  const { navigate, selectedContractId, openContract, openEmployee } = useNav();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, can } = usePermissions();
  const canEdit = can('employee', 'edit');
  const canCreate = can('employee', 'create');
  const canDeleteDocs = can('employee', 'delete');
  const canDecideRenewal = can('employee', 'approve') || user?.dataScope === 'team';

  const [contract, setContract] = useState<EmploymentContractRecord | null>(null);
  const [history, setHistory] = useState<EmploymentContractRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState(false);
  const [terms, setTerms] = useState<ContractTermsForm | null>(null);
  const [termsSubmitted, setTermsSubmitted] = useState(false);

  const [renewOpen, setRenewOpen] = useState(false);
  const [renewForm, setRenewForm] = useState({ startDate: '', endDate: '', probationEndDate: '', submit: true });
  const [renewSubmitted, setRenewSubmitted] = useState(false);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({ label: 'Signed contract', file: null as File | null });

  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [decisionComment, setDecisionComment] = useState('');
  const [terminateOpen, setTerminateOpen] = useState(false);
  const [deleteDoc, setDeleteDoc] = useState<EmploymentContractDocumentRecord | null>(null);

  const loadHistory = useCallback(async (record: EmploymentContractRecord) => {
    try {
      const rows = await listEmploymentContracts(record.companyId, { employeeId: record.employeeId });
      setHistory(rows.sort((a, b) => b.startDate.localeCompare(a.startDate)));
    } catch {
      setHistory([]);
    }
  }, []);

  const load = useCallback(async () => {
    if (!selectedContractId) return;
    setLoading(true);
    setError(null);
    setEditing(false);
    try {
      const record = await getEmploymentContract(selectedContractId);
      setContract(record);
      void loadHistory(record);
    } catch (err) {
      setContract(null);
      setError(errorMessage(err, 'Could not load the contract'));
    } finally {
      setLoading(false);
    }
  }, [selectedContractId, loadHistory]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Applies a server update and refreshes the history so renewal links stay accurate. */
  const applyUpdate = (record: EmploymentContractRecord, message?: string) => {
    setContract(record);
    setNotice(message ?? null);
    void loadHistory(record);
  };

  const run = async (action: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  const openRenewal = useMemo(
    () => (contract ? openRenewalOf(contract, history) : undefined),
    [contract, history],
  );
  const renewedFrom = useMemo(
    () => (contract?.renewedFromId ? history.find((c) => c.id === contract.renewedFromId) : undefined),
    [contract, history],
  );

  const requestedAction = searchParams.get('action');
  useEffect(() => {
    if (requestedAction !== 'renew' || !contract || !history.some((c) => c.id === contract.id)) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('action');
        return next;
      },
      { replace: true },
    );
    if (canCreate && canRenew(contract, history)) {
      setRenewForm(renewDefaults(contract));
      setRenewSubmitted(false);
      setRenewOpen(true);
    }
  }, [requestedAction, contract, history, canCreate, setSearchParams]);

  if (!selectedContractId) {
    return (
      <div className="p-8 text-center text-secondary text-sm">
        No contract selected.
        <div className="mt-4">
          <Button variant="secondary" onClick={() => navigate('emp-contracts')}>
            Back to contracts
          </Button>
        </div>
      </div>
    );
  }

  if (loading && !contract) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-3">
        <AlertCircle className="h-8 w-8 text-error-500 mx-auto" />
        <p className="text-sm text-secondary">{error ?? 'Contract not found.'}</p>
        <div className="flex justify-center gap-2">
          <Button variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
          <Button variant="secondary" onClick={() => navigate('emp-contracts')}>
            Back to contracts
          </Button>
        </div>
      </div>
    );
  }

  const pendingApproval = contract.renewalWorkflow?.status === 'pending';
  const isRenewalDraft = contract.status === 'draft' && !!contract.renewedFromId;
  const lockedReason =
    contract.status === 'terminated'
      ? 'Terminated contracts can’t be edited.'
      : pendingApproval
        ? 'Terms are locked while the renewal is awaiting approval.'
        : null;
  const remaining = daysUntil(contract.endDate);
  const renewable = canCreate && canRenew(contract, history);

  const startEdit = () => {
    setTerms(termsFormFromRecord(contract));
    setTermsSubmitted(false);
    setNotice(null);
    setEditing(true);
  };

  const termsErrors = terms ? validateTermsForm(terms) : {};
  const patch = terms ? termsFormToUpdateInput(contract, terms) : {};
  const changedCount = Object.keys(patch).length;

  const saveTerms = () => {
    setTermsSubmitted(true);
    if (!terms || Object.keys(termsErrors).length > 0) return;
    if (changedCount === 0) {
      setEditing(false);
      return;
    }
    void run(async () => {
      applyUpdate(await updateEmploymentContract(contract.id, patch), 'Contract terms saved.');
      setEditing(false);
    }, 'Could not save the contract');
  };

  const openRenew = () => {
    setRenewForm(renewDefaults(contract));
    setRenewSubmitted(false);
    setRenewOpen(true);
  };

  const renewErrors: { startDate?: string; endDate?: string } = {};
  if (!renewForm.startDate) renewErrors.startDate = 'Enter the new start date.';
  if (renewForm.endDate && renewForm.startDate && renewForm.endDate < renewForm.startDate) {
    renewErrors.endDate = 'End date must be on or after the start date.';
  }
  if (contract.contractType === 'fixed_term' && !renewForm.endDate) {
    renewErrors.endDate = 'Fixed-term contracts need an end date.';
  }

  const submitRenew = () => {
    setRenewSubmitted(true);
    if (Object.keys(renewErrors).length > 0) return;
    void run(async () => {
      const renewed = await renewEmploymentContract(contract.id, {
        startDate: renewForm.startDate,
        endDate: renewForm.endDate || undefined,
        probationEndDate: renewForm.probationEndDate || undefined,
        submit: renewForm.submit,
      });
      setRenewOpen(false);
      openContract(renewed.id);
    }, 'Could not create the renewal');
  };

  const submitUpload = () => {
    if (!uploadForm.file) return;
    const file = uploadForm.file;
    void run(async () => {
      await uploadContractDocument(contract.id, uploadForm.label.trim() || 'Contract document', file);
      setUploadOpen(false);
      setUploadForm({ label: 'Signed contract', file: null });
      applyUpdate(await getEmploymentContract(contract.id), 'Document uploaded.');
    }, 'Upload failed');
  };

  const download = (documentId: string) =>
    void run(async () => {
      const { url } = await getContractDocumentFileUrl(contract.id, documentId);
      window.open(url, '_blank', 'noopener,noreferrer');
    }, 'Could not open the document');

  const submitDecision = () => {
    if (!decision) return;
    const comment = decisionComment.trim() || undefined;
    void run(async () => {
      const record =
        decision === 'approve'
          ? await approveContractRenewal(contract.id, comment)
          : await rejectContractRenewal(contract.id, comment);
      setDecision(null);
      setDecisionComment('');
      applyUpdate(
        record,
        decision === 'reject'
          ? 'Renewal rejected.'
          : record.status === 'active'
            ? 'Renewal approved — the new contract is now active.'
            : 'Approved. The renewal moves to the next approver.',
      );
    }, decision === 'approve' ? 'Approval failed' : 'Rejection failed');
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1200px] mx-auto">
      <button
        type="button"
        onClick={() => navigate('emp-contracts')}
        className="flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to contracts
      </button>

      {error ? (
        <div role="alert" className="flex items-start gap-2 text-sm text-error-700 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}
      {notice ? (
        <div role="status" className="flex items-start gap-2 text-sm text-success-700 bg-success-50 dark:bg-success-950/30 border border-success-200 dark:border-success-800 rounded-lg px-4 py-3">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="flex-1">{notice}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <Card>
        <CardBody className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-accent-50 dark:bg-accent-950/40 flex items-center justify-center shrink-0">
            <FileText className="h-6 w-6 text-accent-600 dark:text-accent-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-lg font-bold text-primary">
                <button type="button" className="hover:underline" onClick={() => openEmployee(contract.employeeId)}>
                  {contract.employeeName ?? 'Employee'}
                </button>
              </h1>
              <ContractTypeBadge type={contract.contractType} />
              <ContractStatusBadge status={contract.displayStatus} />
            </div>
            <div className="text-sm text-secondary mt-0.5">
              {contract.employeeNumber ?? contract.employeeId} · Contract #{contract.id.slice(0, 8).toUpperCase()} ·{' '}
              {formatContractDate(contract.startDate)} – {formatContractDate(contract.endDate, 'open-ended')}
            </div>
          </div>
          {!editing ? (
            <div className="flex items-center gap-2 flex-wrap">
              {pendingApproval && canDecideRenewal ? (
                <>
                  <Button variant="primary" disabled={busy} onClick={() => setDecision('approve')}>
                    Approve renewal
                  </Button>
                  <Button variant="secondary" disabled={busy} onClick={() => setDecision('reject')}>
                    Reject
                  </Button>
                </>
              ) : null}
              {canEdit && isRenewalDraft && !pendingApproval ? (
                <Button
                  variant="primary"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      applyUpdate(await submitContractRenewal(contract.id), 'Renewal submitted for approval.');
                    }, 'Could not submit the renewal')
                  }
                >
                  Submit for approval
                </Button>
              ) : null}
              {canEdit && contract.status === 'draft' && !contract.renewedFromId ? (
                <Button
                  variant="primary"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      applyUpdate(await activateEmploymentContract(contract.id), 'Contract activated.');
                    }, 'Activation failed')
                  }
                >
                  Activate
                </Button>
              ) : null}
              {renewable ? (
                <Button variant="secondary" disabled={busy} onClick={openRenew}>
                  <RefreshCw className="h-4 w-4" /> Renew
                </Button>
              ) : null}
              {canEdit ? (
                <Button
                  variant="secondary"
                  disabled={busy || !!lockedReason}
                  title={lockedReason ?? undefined}
                  onClick={startEdit}
                >
                  {lockedReason ? <Lock className="h-4 w-4" /> : <Pencil className="h-4 w-4" />} Edit
                </Button>
              ) : null}
              {canEdit && contract.status === 'active' ? (
                <Button variant="ghost" disabled={busy} onClick={() => setTerminateOpen(true)}>
                  Terminate
                </Button>
              ) : null}
            </div>
          ) : null}
        </CardBody>
      </Card>

      {pendingApproval ? (
        <Banner tone="info" icon={History} title="Renewal awaiting approval">
          Current step: {contract.renewalWorkflow?.currentStep?.roleName ?? '—'}
          {renewedFrom ? ` · Replaces the contract ending ${formatContractDate(renewedFrom.endDate)}` : ''}
        </Banner>
      ) : null}
      {isRenewalDraft && contract.renewalWorkflow?.status === 'rejected' ? (
        <Banner tone="error" icon={AlertCircle} title="Renewal was rejected">
          Adjust the terms and submit it again, or leave it as a draft.
        </Banner>
      ) : null}
      {openRenewal && openRenewal.id !== contract.id ? (
        <Banner
          tone="info"
          icon={RefreshCw}
          title={openRenewal.status === 'active' ? 'This contract has been renewed' : 'A renewal is in progress'}
          action={
            <Button variant="secondary" size="sm" onClick={() => openContract(openRenewal.id)}>
              View renewal
            </Button>
          }
        >
          New term from {formatContractDate(openRenewal.startDate)} ·{' '}
          {openRenewal.displayStatus === 'pending_approval' ? 'awaiting approval' : openRenewal.displayStatus.replace('_', ' ')}
        </Banner>
      ) : null}
      {!openRenewal &&
      remaining !== null &&
      (contract.displayStatus === 'expiring_soon' || contract.displayStatus === 'expired') ? (
        <Banner
          tone={remaining < 0 ? 'error' : 'warning'}
          icon={AlertTriangle}
          title={remaining < 0 ? 'This contract has ended' : 'This contract is expiring soon'}
          action={
            renewable ? (
              <Button variant="primary" size="sm" onClick={openRenew}>
                Renew contract
              </Button>
            ) : undefined
          }
        >
          {remaining < 0 ? 'Ended' : 'Ends'} {relativeDays(remaining)} ({formatContractDate(contract.endDate)}).
          {renewable ? ' Start a renewal so the employee stays covered.' : ''}
        </Banner>
      ) : null}

      {editing && terms ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit contract terms</CardTitle>
          </CardHeader>
          <CardBody className="space-y-6">
            {contract.status === 'active' ? (
              <p className="flex items-start gap-2 text-sm text-secondary">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-warning-500" />
                This contract is active — changes apply immediately and are recorded in the audit log. For a new term,
                use Renew instead.
              </p>
            ) : null}
            <ContractTermsFields
              value={terms}
              onChange={setTerms}
              errors={termsSubmitted ? termsErrors : {}}
              disabled={busy}
            />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-base pt-4">
              <span className="text-sm text-secondary">
                {changedCount === 0 ? 'No changes yet' : `${changedCount} ${changedCount === 1 ? 'field' : 'fields'} changed`}
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={busy} onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button variant="primary" disabled={busy || changedCount === 0} onClick={saveTerms}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save changes
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Dates & hours</CardTitle>
            </CardHeader>
            <CardBody>
              <dl className="divide-y divide-[rgb(var(--border-base))]">
                <Term label="Contract type">{CONTRACT_TYPE_LABELS[contract.contractType]}</Term>
                <Term label="Start date">{formatContractDate(contract.startDate)}</Term>
                <Term label="End date">
                  {formatContractDate(contract.endDate, 'Open-ended')}
                  {contract.status === 'active' && remaining !== null ? (
                    <span className="text-xs text-muted"> · {remaining < 0 ? 'ended' : 'ends'} {relativeDays(remaining)}</span>
                  ) : null}
                </Term>
                <Term label="Probation ends">{formatContractDate(contract.probationEndDate)}</Term>
                <Term label="Working hours">
                  {contract.workingHoursPerWeek != null ? `${contract.workingHoursPerWeek} hrs/week` : '—'}
                </Term>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pay</CardTitle>
            </CardHeader>
            <CardBody>
              <dl className="divide-y divide-[rgb(var(--border-base))]">
                <Term label="Pay rate">{formatContractPay(contract)}</Term>
                <Term label="Pay frequency">
                  {contract.payFrequency ? PAY_FREQUENCY_LABELS[contract.payFrequency] : '—'}
                </Term>
                <Term label="Currency">{contract.currency}</Term>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Leave & overtime</CardTitle>
            </CardHeader>
            <CardBody>
              <dl className="divide-y divide-[rgb(var(--border-base))]">
                <Term label="Annual leave">
                  {contract.leaveEntitlementDays != null ? `${contract.leaveEntitlementDays} days/year` : '—'}
                </Term>
                <Term label="Overtime">{formatOvertimeRule(contract.overtimeRule)}</Term>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notice & termination</CardTitle>
            </CardHeader>
            <CardBody>
              <dl className="divide-y divide-[rgb(var(--border-base))]">
                <Term label="Notice from employee">
                  {contract.noticePeriodDays != null ? `${contract.noticePeriodDays} days` : '—'}
                </Term>
                <Term label="Notice from employer">
                  {contract.employerNoticeDays != null ? `${contract.employerNoticeDays} days` : '—'}
                </Term>
                <Term label="Termination conditions">
                  <span className="whitespace-pre-line">{contract.terminationConditions?.trim() || '—'}</span>
                </Term>
              </dl>
            </CardBody>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Documents</CardTitle>
            {canEdit ? (
              <Button variant="secondary" size="sm" disabled={busy} onClick={() => setUploadOpen(true)}>
                <Upload className="h-4 w-4" /> Upload
              </Button>
            ) : null}
          </CardHeader>
          <CardBody className="space-y-2">
            {contract.documents.length === 0 ? (
              <p className="text-sm text-secondary">
                No documents yet.{canEdit ? ' Upload the signed contract so it’s on file.' : ''}
              </p>
            ) : (
              contract.documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg bg-[rgb(var(--bg-muted))]">
                  <FileText className="h-5 w-5 text-accent-600 dark:text-accent-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-primary truncate">{doc.label}</div>
                    <div className="text-xs text-muted truncate">
                      {doc.originalName} · {formatBytes(doc.sizeBytes)} · {formatContractDate(doc.uploadedAt)}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" aria-label={`Download ${doc.label}`} onClick={() => download(doc.id)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  {canDeleteDocs ? (
                    <Button variant="ghost" size="sm" aria-label={`Delete ${doc.label}`} onClick={() => setDeleteDoc(doc)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contract history</CardTitle>
          </CardHeader>
          <CardBody className="space-y-1">
            {history.length <= 1 ? (
              <p className="text-sm text-secondary">This is the employee’s only contract.</p>
            ) : (
              history.map((c) => {
                const current = c.id === contract.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={current}
                    onClick={() => openContract(c.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      current ? 'bg-accent-50 dark:bg-accent-950/30' : 'hover:bg-[rgb(var(--bg-hover))]'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-primary">
                        {formatContractDate(c.startDate)} – {formatContractDate(c.endDate, 'open-ended')}
                      </div>
                      <div className="text-xs text-muted">
                        {CONTRACT_TYPE_LABELS[c.contractType]} · {formatContractPay(c)}
                        {current ? ' · viewing' : c.id === contract.renewedFromId ? ' · previous term' : ''}
                      </div>
                    </div>
                    <ContractStatusBadge status={c.displayStatus} />
                  </button>
                );
              })
            )}
          </CardBody>
        </Card>
      </div>

      <Modal
        open={renewOpen}
        onClose={() => !busy && setRenewOpen(false)}
        title="Renew contract"
        description="Creates the next contract with the same pay and rules. You can edit the terms of the draft before it's approved."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenewOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" disabled={busy} onClick={submitRenew}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {renewForm.submit ? 'Create & submit for approval' : 'Create draft'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="renew-start">New start date</Label>
              <Input
                id="renew-start"
                type="date"
                value={renewForm.startDate}
                onChange={(e) => {
                  const startDate = e.target.value;
                  setRenewForm((f) => ({
                    ...f,
                    startDate,
                    endDate: f.endDate ? f.endDate : suggestedRenewalEnd(contract, startDate),
                  }));
                }}
              />
              {renewSubmitted ? <FieldError message={renewErrors.startDate} /> : null}
            </div>
            <div>
              <Label htmlFor="renew-end">
                New end date{contract.contractType === 'fixed_term' ? '' : ' (optional)'}
              </Label>
              <Input
                id="renew-end"
                type="date"
                min={renewForm.startDate || undefined}
                value={renewForm.endDate}
                onChange={(e) => setRenewForm((f) => ({ ...f, endDate: e.target.value }))}
              />
              {renewSubmitted ? <FieldError message={renewErrors.endDate} /> : null}
            </div>
            <div>
              <Label htmlFor="renew-probation">Probation ends (optional)</Label>
              <Input
                id="renew-probation"
                type="date"
                min={renewForm.startDate || undefined}
                value={renewForm.probationEndDate}
                onChange={(e) => setRenewForm((f) => ({ ...f, probationEndDate: e.target.value }))}
              />
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm text-secondary">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={renewForm.submit}
              onChange={(e) => setRenewForm((f) => ({ ...f, submit: e.target.checked }))}
            />
            <span>
              Submit for approval now
              <span className="block text-xs text-muted">
                Untick to save a draft first — for example to change the pay rate before it goes to approvers.
              </span>
            </span>
          </label>
        </div>
      </Modal>

      <Modal
        open={uploadOpen}
        onClose={() => !busy && setUploadOpen(false)}
        title="Upload contract document"
        footer={
          <>
            <Button variant="secondary" onClick={() => setUploadOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" disabled={busy || !uploadForm.file} onClick={submitUpload}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Upload'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="upload-label">Label</Label>
            <Input
              id="upload-label"
              value={uploadForm.label}
              onChange={(e) => setUploadForm((f) => ({ ...f, label: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="upload-file">File (PDF or image)</Label>
            <Input
              id="upload-file"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => setUploadForm((f) => ({ ...f, file: e.target.files?.[0] ?? null }))}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={decision !== null}
        onClose={() => !busy && setDecision(null)}
        title={decision === 'approve' ? 'Approve renewal' : 'Reject renewal'}
        description={
          decision === 'approve'
            ? 'If this is the final approval step, the renewed contract becomes active.'
            : 'The renewal stays as a draft that can be changed and resubmitted.'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setDecision(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant={decision === 'approve' ? 'primary' : 'danger'} disabled={busy} onClick={submitDecision}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : decision === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </>
        }
      >
        <div>
          <Label htmlFor="decision-comment">Comment (optional)</Label>
          <Textarea
            id="decision-comment"
            rows={3}
            value={decisionComment}
            onChange={(e) => setDecisionComment(e.target.value)}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={terminateOpen}
        title="Terminate this contract?"
        description="The contract stops being active. This doesn't offboard the employee — use their lifecycle actions for that."
        confirmLabel="Terminate contract"
        onConfirm={async () => {
          applyUpdate(await terminateEmploymentContract(contract.id), 'Contract terminated.');
        }}
        onClose={() => setTerminateOpen(false)}
      />

      <ConfirmDialog
        open={deleteDoc !== null}
        title={`Delete ${deleteDoc?.label ?? 'document'}?`}
        description="The file is removed from storage. This can't be undone."
        confirmLabel="Delete document"
        onConfirm={async () => {
          if (!deleteDoc) return;
          await deleteContractDocument(contract.id, deleteDoc.id);
          applyUpdate(await getEmploymentContract(contract.id), 'Document deleted.');
        }}
        onClose={() => setDeleteDoc(null)}
      />
    </div>
  );
}
