import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  ThumbsDown,
  ThumbsUp,
  Undo2,
  UserPlus,
  XCircle,
} from 'lucide-react';
import {
  OFFER_LETTER_TEMPLATE_KEYS,
  OFFER_LETTER_TEMPLATES,
  type JobApplicationRecord,
  type OfferLetterRecord,
  type OfferLetterStatus,
  type OfferLetterTemplate,
  type RecruitmentLookups,
} from '@hrm/shared-types';
import { usePermissions } from '@hrm/portal-ui';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FieldError } from '@/components/ui/FieldError';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { OfferLetterPreview } from '@/components/recruitment/OfferLetterPreview';
import { canActOnWorkflowStep } from '@/components/recruitment/recruitment-ui';
import { WorkflowApprovalTimeline } from '@/components/workflow/WorkflowApprovalTimeline';
import { useNav } from '@/context/NavContext';
import {
  acceptOfferLetter,
  approveOfferLetter,
  declineOfferLetter,
  downloadOfferLetterPdf,
  fetchOfferLetterPdf,
  generateOfferLetterPdf,
  getJobApplication,
  getOfferLetter,
  getRecruitmentLookups,
  rejectOfferLetter,
  reviseOfferLetter,
  sendOfferLetter,
  submitOfferLetter,
  updateOfferLetter,
  type UpsertOfferLetterInput,
} from '@/lib/recruitment-api';
import { ApiError } from '@/lib/tenant-api-client';

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'error' | 'info';

const STATUS_TONE: Record<OfferLetterStatus, BadgeTone> = {
  draft: 'neutral',
  pending_approval: 'warning',
  approved: 'info',
  sent: 'accent',
  accepted: 'success',
  declined: 'error',
  cancelled: 'error',
};

const LIFECYCLE = ['Draft', 'Approval', 'Approved', 'Sent', 'Accepted'] as const;

const LIFECYCLE_INDEX: Record<OfferLetterStatus, number> = {
  draft: 0,
  pending_approval: 1,
  cancelled: 1,
  approved: 2,
  sent: 3,
  declined: 3,
  accepted: 4,
};

interface OfferForm {
  template: OfferLetterTemplate;
  jobTitle: string;
  departmentId: string;
  designationId: string;
  employmentTypeId: string;
  workLocationId: string;
  annualSalary: string;
  currency: string;
  startDate: string;
  reportingTo: string;
  signingBonus: string;
  equityNotes: string;
  probationMonths: string;
  expiryDate: string;
  additionalTerms: string;
}

type FormErrors = Partial<Record<keyof OfferForm, string>>;

function toForm(offer: OfferLetterRecord): OfferForm {
  return {
    template: offer.template,
    jobTitle: offer.jobTitle,
    departmentId: offer.departmentId ?? '',
    designationId: offer.designationId ?? '',
    employmentTypeId: offer.employmentTypeId ?? '',
    workLocationId: offer.workLocationId ?? '',
    annualSalary: offer.annualSalary != null ? String(offer.annualSalary) : '',
    currency: offer.currency,
    startDate: offer.startDate,
    reportingTo: offer.reportingTo ?? '',
    signingBonus: offer.signingBonus != null ? String(offer.signingBonus) : '',
    equityNotes: offer.equityNotes ?? '',
    probationMonths: offer.probationMonths != null ? String(offer.probationMonths) : '',
    expiryDate: offer.expiryDate ?? '',
    additionalTerms: offer.additionalTerms ?? '',
  };
}

const numberOrNull = (value: string) => (value.trim() === '' ? null : Number(value));

function toInput(form: OfferForm): UpsertOfferLetterInput {
  return {
    template: form.template,
    jobTitle: form.jobTitle.trim(),
    departmentId: form.departmentId || null,
    designationId: form.designationId || null,
    employmentTypeId: form.employmentTypeId || null,
    workLocationId: form.workLocationId || null,
    annualSalary: numberOrNull(form.annualSalary),
    currency: form.currency.trim().toUpperCase(),
    startDate: form.startDate,
    reportingTo: form.reportingTo.trim() || null,
    signingBonus: numberOrNull(form.signingBonus),
    equityNotes: form.equityNotes.trim() || null,
    probationMonths: numberOrNull(form.probationMonths),
    expiryDate: form.expiryDate || null,
    additionalTerms: form.additionalTerms.trim() || null,
  };
}

function validate(form: OfferForm, forSubmit: boolean): FormErrors {
  const errors: FormErrors = {};
  if (!form.jobTitle.trim()) errors.jobTitle = 'Job title is required';
  if (!form.startDate) errors.startDate = 'Start date is required';
  if (!/^[A-Za-z]{3}$/.test(form.currency.trim())) errors.currency = 'Use a 3-letter code, e.g. AUD';
  if (form.annualSalary.trim() === '') {
    if (forSubmit) errors.annualSalary = 'Salary is required before approval';
  } else if (!(Number(form.annualSalary) >= 0)) {
    errors.annualSalary = 'Enter a positive amount';
  }
  if (form.signingBonus.trim() !== '' && !(Number(form.signingBonus) >= 0)) {
    errors.signingBonus = 'Enter a positive amount';
  }
  if (
    form.probationMonths.trim() !== '' &&
    !(Number.isInteger(Number(form.probationMonths)) && Number(form.probationMonths) >= 0)
  ) {
    errors.probationMonths = 'Whole months only';
  }
  if (form.expiryDate && form.startDate && form.expiryDate > form.startDate) {
    errors.expiryDate = 'The offer should expire on or before the start date';
  }
  return errors;
}

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.message : fallback;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function Field({
  label,
  error,
  className = '',
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      {children}
      <FieldError message={error} />
    </div>
  );
}

function LifecycleStepper({ status }: { status: OfferLetterStatus }) {
  const current = LIFECYCLE_INDEX[status];
  const failedLabel = status === 'cancelled' ? 'Rejected' : status === 'declined' ? 'Declined' : null;
  return (
    <ol className="flex items-center gap-1 overflow-x-auto pb-1">
      {LIFECYCLE.map((label, index) => {
        const failed = failedLabel != null && index === current;
        const done = index < current || (status === 'accepted' && index === current);
        const active = index === current && !failed && !done;
        return (
          <li key={label} className="flex items-center gap-1 shrink-0">
            <span
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                failed
                  ? 'bg-error-50 text-error-700 dark:bg-error-950/40 dark:text-error-300'
                  : done
                    ? 'bg-success-50 text-success-700 dark:bg-success-950/40 dark:text-success-300'
                    : active
                      ? 'bg-accent-50 text-accent-700 ring-1 ring-accent-300 dark:bg-accent-950/40 dark:text-accent-300'
                      : 'bg-[rgb(var(--bg-muted))] text-muted'
              }`}
            >
              {failed ? (
                <XCircle className="h-3.5 w-3.5" />
              ) : done ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <span className="text-[10px] font-semibold">{index + 1}</span>
              )}
              {failed ? failedLabel : label}
            </span>
            {index < LIFECYCLE.length - 1 ? <span className="h-px w-4 bg-[rgb(var(--border-base))]" /> : null}
          </li>
        );
      })}
    </ol>
  );
}

type Dialog = 'submit' | 'approve' | 'reject' | 'send' | 'accept' | 'decline' | 'revise' | null;

export function OfferLetterPage() {
  const { applicationId: routeApplicationId } = useParams<{ applicationId: string }>();
  const { navigate, openApplication, openEmployee, selectedApplicationId } = useNav();
  const { user, can } = usePermissions();
  const canEditRecruitment = can('recruitment', 'edit');
  const canApproveRecruitment = can('recruitment', 'approve');
  const canCreateEmployees = can('employee', 'create');
  const canConfigureWorkflows = can('settings', 'view');
  const applicationId = routeApplicationId ?? selectedApplicationId;

  const [offer, setOffer] = useState<OfferLetterRecord | null>(null);
  const [application, setApplication] = useState<JobApplicationRecord | null>(null);
  const [form, setForm] = useState<OfferForm | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [lookups, setLookups] = useState<RecruitmentLookups | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [dialogText, setDialogText] = useState('');
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<'email' | 'manual'>('email');
  const [previewMode, setPreviewMode] = useState<'live' | 'pdf'>('live');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const load = useCallback(async () => {
    if (!applicationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const app = await getJobApplication(applicationId);
      const [offerRow, lookupRows] = await Promise.all([
        getOfferLetter(applicationId),
        getRecruitmentLookups(app.companyId),
      ]);
      setApplication(app);
      setOffer(offerRow);
      setForm(toForm(offerRow));
      setLookups(lookupRows);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load offer letter'));
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const offerId = offer?.id;
  const fileVersion = offer?.fileKey ? offer.generatedAt : null;
  useEffect(() => {
    if (previewMode !== 'pdf' || !fileVersion || !offerId) return;
    let cancelled = false;
    let url: string | null = null;
    setPdfLoading(true);
    fetchOfferLetterPdf(offerId)
      .then(({ blob }) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setPdfUrl(url);
      })
      .catch((err) => !cancelled && setError(errorMessage(err, 'Failed to load the PDF')))
      .finally(() => !cancelled && setPdfLoading(false));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
      setPdfUrl(null);
    };
  }, [previewMode, fileVersion, offerId]);

  const dirty = useMemo(
    () => (offer && form ? JSON.stringify(toInput(form)) !== JSON.stringify(toInput(toForm(offer))) : false),
    [offer, form],
  );

  const designationOptions = useMemo(() => {
    const all = lookups?.designations ?? [];
    if (!form?.departmentId) return all;
    return all.filter((d) => !d.departmentId || d.departmentId === form.departmentId || d.id === form.designationId);
  }, [lookups, form?.departmentId, form?.designationId]);

  if (!applicationId) {
    return <div className="p-6 text-secondary">Select a candidate from the recruitment pipeline first.</div>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-secondary">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading offer letter…
      </div>
    );
  }

  if (!offer || !form || !application) {
    return <div className="p-6 text-error-600">{error ?? 'Offer letter not found.'}</div>;
  }

  const isDraft = offer.status === 'draft';
  const canEdit = isDraft && canEditRecruitment;
  const hired = application.stage === 'hired' || application.hiredEmployeeId != null;
  const pendingStep = offer.workflow?.steps.find((s) => s.status === 'pending');
  const canActOnStep =
    offer.status === 'pending_approval' &&
    canApproveRecruitment &&
    canActOnWorkflowStep(offer.workflow, user?.roleName ?? '');
  const rejectedStep = offer.workflow?.steps.find((s) => s.status === 'rejected');

  const update = <K extends keyof OfferForm>(key: K, value: OfferForm[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const run = async (action: () => Promise<OfferLetterRecord>, success: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = await action();
      setOffer(next);
      setForm(toForm(next));
      setNotice(success);
    } catch (err) {
      setError(errorMessage(err, 'Action failed'));
    } finally {
      setBusy(false);
    }
  };

  /** Saves pending edits; returns false when validation fails. */
  const saveIfNeeded = async (forSubmit: boolean): Promise<boolean> => {
    const nextErrors = validate(form, forSubmit);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError('Fix the highlighted fields first.');
      return false;
    }
    if (dirty) {
      const saved = await updateOfferLetter(applicationId, toInput(form));
      setOffer(saved);
      setForm(toForm(saved));
    }
    return true;
  };

  const handleSave = () =>
    void run(async () => {
      const nextErrors = validate(form, false);
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) throw new ApiError('Fix the highlighted fields first.', 400);
      return updateOfferLetter(applicationId, toInput(form));
    }, 'Draft saved.');

  const handleGenerate = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (!(await saveIfNeeded(false))) return;
      const next = await generateOfferLetterPdf(offer.id);
      setOffer(next);
      setForm(toForm(next));
      setPreviewMode('pdf');
      setNotice(`PDF generated from the ${next.templateLabel} template.`);
    } catch (err) {
      setError(errorMessage(err, 'Failed to generate the PDF'));
    } finally {
      setBusy(false);
    }
  };

  const openDialog = (next: Exclude<Dialog, null>) => {
    setDialogText('');
    setDialogError(null);
    setDeliveryMethod(offer.candidateEmail ? 'email' : 'manual');
    if (next === 'submit') {
      const nextErrors = validate(form, true);
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) {
        setError('Fix the highlighted fields before submitting.');
        return;
      }
    }
    setDialog(next);
  };

  /** Runs a dialog action; keeps the dialog open with the error on failure. */
  const runDialog = async (action: () => Promise<OfferLetterRecord>, success: string) => {
    setBusy(true);
    setDialogError(null);
    setError(null);
    try {
      const next = await action();
      setOffer(next);
      setForm(toForm(next));
      setNotice(success);
      setDialog(null);
    } catch (err) {
      setDialogError(errorMessage(err, 'Action failed'));
    } finally {
      setBusy(false);
    }
  };

  const previewData = {
    template: form.template,
    companyName: offer.companyName ?? 'Company',
    candidateName: offer.candidateName ?? application.candidateName ?? 'Candidate',
    candidateEmail: offer.candidateEmail ?? null,
    jobTitle: form.jobTitle,
    departmentName: lookups?.departments.find((d) => d.id === form.departmentId)?.name,
    employmentTypeName: lookups?.employmentTypes.find((t) => t.id === form.employmentTypeId)?.name,
    workLocationName: lookups?.locations.find((l) => l.id === form.workLocationId)?.name,
    reportingTo: form.reportingTo || null,
    startDate: form.startDate,
    annualSalary: numberOrNull(form.annualSalary),
    signingBonus: numberOrNull(form.signingBonus),
    currency: form.currency.toUpperCase(),
    equityNotes: form.equityNotes || null,
    probationMonths: numberOrNull(form.probationMonths),
    expiryDate: form.expiryDate || null,
    additionalTerms: form.additionalTerms || null,
  };

  const template = OFFER_LETTER_TEMPLATES[form.template];

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <button
        type="button"
        onClick={() => openApplication(applicationId)}
        className="flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to candidate
      </button>

      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="space-y-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-primary">Offer Letter</h1>
              <Badge tone={STATUS_TONE[offer.status]} dot>
                {offer.displayStatus}
              </Badge>
            </div>
            <p className="text-sm text-secondary mt-0.5">
              {offer.candidateName} · {offer.jobTitle}
              {application.requisitionReference ? ` · ${application.requisitionReference}` : ''}
            </p>
          </div>
          <LifecycleStepper status={offer.status} />
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {offer.fileKey ? (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void downloadOfferLetterPdf(offer.id).catch((err) =>
                  setError(errorMessage(err, 'Download failed')),
                )
              }
            >
              <Download className="h-4 w-4" /> Download PDF
            </Button>
          ) : null}

          {canEdit ? (
            <>
              <Button variant="secondary" disabled={busy || !dirty} onClick={handleSave}>
                Save draft
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => void handleGenerate()}>
                <FileText className="h-4 w-4" /> {offer.fileKey ? 'Regenerate PDF' : 'Generate PDF'}
              </Button>
              <Button variant="primary" disabled={busy} onClick={() => openDialog('submit')}>
                <Send className="h-4 w-4" /> Submit for approval
              </Button>
            </>
          ) : null}

          {offer.status === 'pending_approval' && canApproveRecruitment ? (
            <>
              <Button
                variant="secondary"
                disabled={busy || !canActOnStep}
                title={canActOnStep ? undefined : `Waiting for ${pendingStep?.roleName ?? 'the assigned approver'}`}
                onClick={() => openDialog('reject')}
              >
                <ThumbsDown className="h-4 w-4" /> Reject
              </Button>
              <Button
                variant="primary"
                disabled={busy || !canActOnStep}
                title={canActOnStep ? undefined : `Waiting for ${pendingStep?.roleName ?? 'the assigned approver'}`}
                onClick={() => openDialog('approve')}
              >
                <ThumbsUp className="h-4 w-4" /> Approve
              </Button>
            </>
          ) : null}

          {(offer.status === 'approved' || offer.status === 'sent') && canEditRecruitment ? (
            <Button
              variant={offer.status === 'approved' ? 'primary' : 'secondary'}
              disabled={busy}
              onClick={() => openDialog('send')}
            >
              <Mail className="h-4 w-4" /> {offer.status === 'sent' ? 'Resend' : 'Send to candidate'}
            </Button>
          ) : null}

          {(offer.status === 'approved' || offer.status === 'sent') && canApproveRecruitment ? (
            <>
              <Button variant="secondary" disabled={busy} onClick={() => openDialog('decline')}>
                <XCircle className="h-4 w-4" /> Mark declined
              </Button>
              <Button
                variant={offer.status === 'sent' ? 'primary' : 'secondary'}
                disabled={busy}
                onClick={() => openDialog('accept')}
              >
                <Check className="h-4 w-4" /> Mark accepted
              </Button>
            </>
          ) : null}

          {(offer.status === 'cancelled' || offer.status === 'declined') && canEditRecruitment && !hired ? (
            <Button variant="primary" disabled={busy} onClick={() => openDialog('revise')}>
              <Undo2 className="h-4 w-4" /> Revise offer
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-error-200 bg-error-50 dark:bg-error-950/30 px-4 py-3 text-sm text-error-700 dark:text-error-300">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-lg border border-success-200 bg-success-50 dark:bg-success-950/30 px-4 py-3 text-sm text-success-700 dark:text-success-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> {notice}
        </div>
      ) : null}

      {offer.status === 'accepted' ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-success-200 dark:border-success-800/60 bg-success-50 dark:bg-success-950/30 p-4">
          <CheckCircle2 className="h-5 w-5 text-success-600 shrink-0" />
          <div className="flex-1 text-sm">
            <p className="font-medium text-primary">
              {hired ? 'Candidate hired' : 'Offer accepted'}
              {offer.acceptedAt ? ` on ${new Date(offer.acceptedAt).toLocaleDateString()}` : ''}
            </p>
            <p className="text-xs text-secondary mt-0.5">
              {hired
                ? 'The employee record was created from this offer.'
                : 'Convert the candidate to an employee — the Add Employee form opens pre-filled from this offer.'}
            </p>
          </div>
          {hired && application.hiredEmployeeId ? (
            <Button variant="secondary" onClick={() => openEmployee(application.hiredEmployeeId!)}>
              View employee
            </Button>
          ) : canApproveRecruitment && canCreateEmployees ? (
            <Button variant="primary" onClick={() => openApplication(applicationId, { convert: true })}>
              <UserPlus className="h-4 w-4" /> Convert to employee
            </Button>
          ) : null}
        </div>
      ) : null}

      {offer.status === 'cancelled' ? (
        <div className="rounded-xl border border-error-200 dark:border-error-800/60 bg-error-50 dark:bg-error-950/30 p-4 text-sm">
          <p className="font-medium text-error-800 dark:text-error-300">
            Rejected{rejectedStep ? ` by ${rejectedStep.roleName}` : ''}
            {rejectedStep?.actedAt ? ` on ${new Date(rejectedStep.actedAt).toLocaleDateString()}` : ''}
          </p>
          <p className="text-xs text-error-700 dark:text-error-300/90 mt-0.5">
            {rejectedStep?.comment ? `“${rejectedStep.comment}” — ` : ''}
            Revise the offer to change the terms and resubmit it for approval.
          </p>
        </div>
      ) : null}

      {offer.status === 'declined' ? (
        <div className="rounded-xl border border-error-200 dark:border-error-800/60 bg-error-50 dark:bg-error-950/30 p-4 text-sm">
          <p className="font-medium text-error-800 dark:text-error-300">
            Candidate declined
            {offer.declinedAt ? ` on ${new Date(offer.declinedAt).toLocaleDateString()}` : ''}
          </p>
          <p className="text-xs text-error-700 dark:text-error-300/90 mt-0.5">
            {offer.declineReason ? `“${offer.declineReason}” — ` : ''}
            Revise the offer to negotiate new terms, or move the candidate out of the pipeline.
          </p>
        </div>
      ) : null}

      {isDraft && offer.workflow?.status === 'rejected' ? (
        <div className="rounded-xl border border-warning-200 dark:border-warning-800/60 bg-warning-50 dark:bg-warning-950/30 p-4 text-sm text-warning-800 dark:text-warning-300">
          Revising a rejected offer. The previous decision is shown under Approval workflow; submitting starts a new
          approval run.
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Template</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Offer template">
                {OFFER_LETTER_TEMPLATE_KEYS.map((key) => {
                  const t = OFFER_LETTER_TEMPLATES[key];
                  const selected = form.template === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={!canEdit}
                      onClick={() => {
                        update('template', key);
                        setPreviewMode('live');
                      }}
                      className={`text-left rounded-xl border p-3 transition-colors disabled:cursor-default ${
                        selected
                          ? 'border-accent-500 bg-accent-50/60 dark:bg-accent-950/30 ring-1 ring-accent-500'
                          : 'border-base hover:border-accent-300 disabled:hover:border-base'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-primary">{t.label}</span>
                        {selected ? <Check className="h-4 w-4 text-accent-600" /> : null}
                      </span>
                      <span className="block text-xs text-muted mt-1">{t.description}</span>
                    </button>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Offer terms</CardTitle>
              {canEdit && dirty ? <Badge tone="warning">Unsaved changes</Badge> : null}
              {!canEdit ? <span className="text-xs text-muted">Locked — terms can only change on a draft</span> : null}
            </CardHeader>
            <CardBody className="space-y-6">
              <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-4" disabled={!canEdit}>
                <legend className="sm:col-span-2 text-xs font-semibold uppercase tracking-wide text-muted mb-1">
                  Position
                </legend>
                <Field label="Job title *" error={errors.jobTitle} className="sm:col-span-2">
                  <Input value={form.jobTitle} onChange={(e) => update('jobTitle', e.target.value)} />
                </Field>
                <Field label="Department">
                  <Select value={form.departmentId} onChange={(e) => update('departmentId', e.target.value)}>
                    <option value="">Not specified</option>
                    {lookups?.departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Designation">
                  <Select value={form.designationId} onChange={(e) => update('designationId', e.target.value)}>
                    <option value="">Not specified</option>
                    {designationOptions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Employment type">
                  <Select value={form.employmentTypeId} onChange={(e) => update('employmentTypeId', e.target.value)}>
                    <option value="">Not specified</option>
                    {lookups?.employmentTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Work location">
                  <Select value={form.workLocationId} onChange={(e) => update('workLocationId', e.target.value)}>
                    <option value="">Not specified</option>
                    {lookups?.locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Reports to" className="sm:col-span-2">
                  <Input
                    list="offer-reporting-to"
                    placeholder="Start typing an employee name"
                    value={form.reportingTo}
                    onChange={(e) => update('reportingTo', e.target.value)}
                  />
                  <datalist id="offer-reporting-to">
                    {lookups?.employees.map((e) => <option key={e.id} value={e.name} />)}
                  </datalist>
                </Field>
              </fieldset>

              <fieldset className="grid grid-cols-1 sm:grid-cols-3 gap-4" disabled={!canEdit}>
                <legend className="sm:col-span-3 text-xs font-semibold uppercase tracking-wide text-muted mb-1">
                  Compensation
                </legend>
                <Field label={`${template.salaryLabel} *`} error={errors.annualSalary} className="sm:col-span-2">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={form.annualSalary}
                    onChange={(e) => update('annualSalary', e.target.value)}
                  />
                </Field>
                <Field label="Currency" error={errors.currency}>
                  <Input
                    maxLength={3}
                    value={form.currency}
                    onChange={(e) => update('currency', e.target.value.toUpperCase())}
                  />
                </Field>
                <Field label="Signing bonus" error={errors.signingBonus}>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={form.signingBonus}
                    onChange={(e) => update('signingBonus', e.target.value)}
                  />
                </Field>
                {template.showProbation ? (
                  <Field label="Probation (months)" error={errors.probationMonths}>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={form.probationMonths}
                      onChange={(e) => update('probationMonths', e.target.value)}
                    />
                  </Field>
                ) : null}
                {template.showEquity ? (
                  <Field label="Equity / stock options" className={template.showProbation ? '' : 'sm:col-span-2'}>
                    <Input value={form.equityNotes} onChange={(e) => update('equityNotes', e.target.value)} />
                  </Field>
                ) : null}
              </fieldset>

              <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-4" disabled={!canEdit}>
                <legend className="sm:col-span-2 text-xs font-semibold uppercase tracking-wide text-muted mb-1">
                  Dates &amp; terms
                </legend>
                <Field label="Start date *" error={errors.startDate}>
                  <Input type="date" value={form.startDate} onChange={(e) => update('startDate', e.target.value)} />
                </Field>
                <Field label="Offer expires" error={errors.expiryDate}>
                  <Input type="date" value={form.expiryDate} onChange={(e) => update('expiryDate', e.target.value)} />
                </Field>
                <Field label="Additional terms" className="sm:col-span-2">
                  <Textarea
                    rows={4}
                    placeholder={
                      form.template === 'contract'
                        ? 'e.g. The engagement runs for 12 months, ending 30 September 2027, with an option to extend.'
                        : 'Anything specific to this offer'
                    }
                    value={form.additionalTerms}
                    onChange={(e) => update('additionalTerms', e.target.value)}
                  />
                </Field>
              </fieldset>
            </CardBody>
          </Card>
        </div>

        <div className="xl:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Letter</CardTitle>
              <div className="inline-flex rounded-lg border border-base p-0.5 text-xs">
                {(['live', 'pdf'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    disabled={mode === 'pdf' && !offer.fileKey}
                    onClick={() => setPreviewMode(mode)}
                    className={`px-2.5 py-1 rounded-md transition-colors disabled:opacity-40 ${
                      previewMode === mode ? 'bg-accent-600 text-white' : 'text-secondary hover:text-primary'
                    }`}
                  >
                    {mode === 'live' ? 'Live preview' : 'Generated PDF'}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardBody className="space-y-3">
              {previewMode === 'live' ? (
                <div className="max-h-[640px] overflow-y-auto">
                  <OfferLetterPreview data={previewData} />
                </div>
              ) : pdfLoading || !pdfUrl ? (
                <div className="flex items-center justify-center h-[640px] text-secondary text-sm">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading PDF…
                </div>
              ) : (
                <iframe title="Offer letter PDF" src={pdfUrl} className="w-full h-[640px] rounded-lg border border-base" />
              )}
              <p className="text-xs text-muted flex items-center gap-1.5">
                {offer.generatedAt ? (
                  <>
                    <RefreshCw className="h-3 w-3" /> PDF generated {formatDateTime(offer.generatedAt)}
                    {isDraft && dirty ? ' — regenerate to include unsaved changes' : ''}
                  </>
                ) : (
                  'No PDF yet — it is generated when you submit for approval.'
                )}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Approval workflow</CardTitle>
            </CardHeader>
            <CardBody>
              <WorkflowApprovalTimeline
                route={offer.approvalRoute}
                workflow={offer.workflow}
                onConfigure={canConfigureWorkflows ? () => navigate('settings-workflows') : undefined}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Delivery</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">Candidate email</span>
                <span className="text-primary truncate">{offer.candidateEmail ?? 'Not on file'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">Sent</span>
                <span className="text-primary">{offer.sentAt ? formatDateTime(offer.sentAt) : '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">Expires</span>
                <span className="text-primary">{offer.expiryDate ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">Response</span>
                <span className="text-primary">
                  {offer.acceptedAt
                    ? `Accepted ${new Date(offer.acceptedAt).toLocaleDateString()}`
                    : offer.declinedAt
                      ? `Declined ${new Date(offer.declinedAt).toLocaleDateString()}`
                      : '—'}
                </span>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <Modal
        open={dialog === 'submit'}
        onClose={() => setDialog(null)}
        title="Submit offer for approval"
        description="The PDF is generated from the selected template and routed to the approvers below."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() =>
                void runDialog(async () => {
                  if (!(await saveIfNeeded(true))) throw new ApiError('Fix the highlighted fields first.', 400);
                  return submitOfferLetter(offer.id);
                }, 'Offer submitted — approvers have been notified.')
              }
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-base p-3 text-sm">
            <p className="text-primary font-medium">{template.label}</p>
            <p className="text-xs text-muted mt-0.5">
              {form.jobTitle} · {form.currency.toUpperCase()}{' '}
              {numberOrNull(form.annualSalary)?.toLocaleString() ?? '—'} · starts {form.startDate}
            </p>
          </div>
          <WorkflowApprovalTimeline route={offer.approvalRoute} workflow={null} />
          {dialogError ? <p className="text-sm text-error-600">{dialogError}</p> : null}
        </div>
      </Modal>

      <Modal
        open={dialog === 'approve' || dialog === 'reject'}
        onClose={() => setDialog(null)}
        title={dialog === 'approve' ? 'Approve offer' : 'Reject offer'}
        description={
          dialog === 'approve'
            ? `Approving as ${pendingStep?.roleName ?? 'approver'}.`
            : 'The offer returns to the recruiter, who can revise and resubmit it.'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </Button>
            {dialog === 'approve' ? (
              <Button
                variant="primary"
                disabled={busy}
                onClick={() =>
                  void runDialog(
                    () => approveOfferLetter(offer.id, dialogText.trim() || undefined),
                    'Approved.',
                  )
                }
              >
                <ThumbsUp className="h-4 w-4" /> Approve
              </Button>
            ) : (
              <Button
                variant="danger"
                disabled={busy || !dialogText.trim()}
                onClick={() =>
                  void runDialog(() => rejectOfferLetter(offer.id, dialogText.trim()), 'Offer rejected.')
                }
              >
                <ThumbsDown className="h-4 w-4" /> Reject
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-2">
          <Label>{dialog === 'approve' ? 'Comment (optional)' : 'Reason *'}</Label>
          <Textarea
            rows={3}
            value={dialogText}
            placeholder={dialog === 'reject' ? 'e.g. Salary is above the approved band for this level' : ''}
            onChange={(e) => setDialogText(e.target.value)}
          />
          {dialogError ? <p className="text-sm text-error-600">{dialogError}</p> : null}
        </div>
      </Modal>

      <Modal
        open={dialog === 'send'}
        onClose={() => setDialog(null)}
        title={offer.status === 'sent' ? 'Resend offer' : 'Send offer to candidate'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={busy || (deliveryMethod === 'email' && !offer.candidateEmail)}
              onClick={() =>
                void runDialog(
                  () =>
                    sendOfferLetter(offer.id, {
                      deliveryMethod,
                      message: deliveryMethod === 'email' ? dialogText.trim() || undefined : undefined,
                    }),
                  deliveryMethod === 'email'
                    ? `Offer emailed to ${offer.candidateEmail}.`
                    : 'Offer marked as sent.',
                )
              }
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {deliveryMethod === 'email' ? 'Send email' : 'Mark as sent'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            {(
              [
                ['email', 'Email the PDF', offer.candidateEmail ? `To ${offer.candidateEmail}` : 'No email on file'],
                ['manual', 'Already delivered', 'You downloaded the PDF and sent it yourself'],
              ] as const
            ).map(([value, label, hint]) => (
              <label
                key={value}
                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer ${
                  deliveryMethod === value ? 'border-accent-500 bg-accent-50/50 dark:bg-accent-950/30' : 'border-base'
                }`}
              >
                <input
                  type="radio"
                  name="delivery"
                  className="mt-1"
                  checked={deliveryMethod === value}
                  disabled={value === 'email' && !offer.candidateEmail}
                  onChange={() => setDeliveryMethod(value)}
                />
                <span>
                  <span className="block text-sm font-medium text-primary">{label}</span>
                  <span className="block text-xs text-muted">{hint}</span>
                </span>
              </label>
            ))}
          </div>
          {deliveryMethod === 'email' ? (
            <div>
              <Label>Personal note (optional)</Label>
              <Textarea rows={3} value={dialogText} onChange={(e) => setDialogText(e.target.value)} />
            </div>
          ) : null}
          {dialogError ? (
            <p className="text-sm text-error-600">
              {dialogError}
              {/SMTP/i.test(dialogError)
                ? ' — set up outgoing email under Settings, or download the PDF and choose "Already delivered".'
                : ''}
            </p>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={dialog === 'decline'}
        onClose={() => setDialog(null)}
        title="Mark offer as declined"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                void runDialog(
                  () => declineOfferLetter(offer.id, { reason: dialogText.trim() || undefined }),
                  'Offer marked as declined.',
                )
              }
            >
              Mark declined
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <Label>Reason (optional)</Label>
          <Textarea
            rows={3}
            placeholder="e.g. Accepted a competing offer"
            value={dialogText}
            onChange={(e) => setDialogText(e.target.value)}
          />
          {dialogError ? <p className="text-sm text-error-600">{dialogError}</p> : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={dialog === 'accept'}
        title="Mark offer as accepted?"
        description="Record that the candidate accepted. You can then convert them to an employee."
        confirmLabel="Mark accepted"
        tone="primary"
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          const next = await acceptOfferLetter(offer.id);
          setOffer(next);
          setForm(toForm(next));
          setNotice('Offer accepted. Convert the candidate to an employee when ready.');
        }}
      />

      <ConfirmDialog
        open={dialog === 'revise'}
        title="Revise this offer?"
        description="The offer goes back to draft so you can change the terms. Submitting it again starts a new approval run."
        confirmLabel="Revise offer"
        tone="primary"
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          const next = await reviseOfferLetter(offer.id);
          setOffer(next);
          setForm(toForm(next));
          setNotice('Offer reopened as a draft.');
        }}
      />
    </div>
  );
}
