import { useEffect, useRef, useState } from 'react';
import { FileText, Loader2, X } from 'lucide-react';
import type {
  CandidateRecord,
  CandidateSource,
  JobApplicationRecord,
  JobRequisitionRecord,
} from '@hrm/shared-types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FieldError } from '@/components/ui/FieldError';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import {
  RECRUITMENT_FILE_ACCEPT,
  SOURCE_LABELS,
  uploadFileError,
} from '@/components/recruitment/recruitment-ui';
import {
  createCandidate,
  createJobApplication,
  listCandidates,
  uploadApplicationResume,
} from '@/lib/recruitment-api';
import { ApiError } from '@/lib/tenant-api-client';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  source: CandidateSource;
  yearsExperience: string;
  requisitionId: string;
  coverLetter: string;
}

type Errors = Partial<Record<keyof FormState, string>>;

export interface CandidateAddedResult {
  application: JobApplicationRecord;
  reusedExistingCandidate: boolean;
  warning: string | null;
}

export function AddCandidateModal({
  open,
  onClose,
  companyId,
  openRequisitions,
  defaultRequisitionId,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  companyId: string;
  openRequisitions: JobRequisitionRecord[];
  defaultRequisitionId: string | null;
  onAdded: (result: CandidateAddedResult) => void;
}) {
  const [form, setForm] = useState<FormState>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    source: 'website',
    yearsExperience: '',
    requisitionId: '',
    coverLetter: '',
  });
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const preferred =
      openRequisitions.find((r) => r.id === defaultRequisitionId)?.id ??
      openRequisitions[0]?.id ??
      '';
    setForm({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      source: 'website',
      yearsExperience: '',
      requisitionId: preferred,
      coverLetter: '',
    });
    setResumeFile(null);
    setFileError(null);
    setErrors({});
    setSubmitError(null);
  }, [open, openRequisitions, defaultRequisitionId]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const validate = (): Errors => {
    const next: Errors = {};
    if (!form.firstName.trim()) next.firstName = 'Required';
    if (!form.lastName.trim()) next.lastName = 'Required';
    if (!EMAIL_RE.test(form.email.trim())) next.email = 'Enter a valid email address';
    if (form.yearsExperience !== '') {
      const years = Number(form.yearsExperience);
      if (!Number.isInteger(years) || years < 0) next.yearsExperience = 'Whole number, 0 or more';
    }
    if (!form.requisitionId) next.requisitionId = 'Choose an open requisition';
    return next;
  };

  const findExistingCandidate = async (email: string): Promise<CandidateRecord | null> => {
    const matches = await listCandidates(companyId, email);
    return matches.find((c) => c.email.toLowerCase() === email.toLowerCase()) ?? null;
  };

  const handleSubmit = async () => {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    setSubmitError(null);
    const email = form.email.trim().toLowerCase();
    try {
      let candidate: CandidateRecord;
      let reusedExistingCandidate = false;
      try {
        candidate = await createCandidate(companyId, {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email,
          phone: form.phone.trim() || undefined,
          source: form.source,
          yearsExperience:
            form.yearsExperience === '' ? undefined : Number(form.yearsExperience),
        });
      } catch (err) {
        if (!(err instanceof ApiError) || err.status !== 409) throw err;
        const existing = await findExistingCandidate(email);
        if (!existing) throw err;
        candidate = existing;
        reusedExistingCandidate = true;
      }

      const requisition = openRequisitions.find((r) => r.id === form.requisitionId);
      const application = await createJobApplication(companyId, {
        candidateId: candidate.id,
        requisitionId: form.requisitionId,
        postingId: requisition?.posting?.id,
        coverLetter: form.coverLetter.trim() || undefined,
      });

      let warning: string | null = null;
      if (resumeFile) {
        try {
          const resume = await uploadApplicationResume(application.id, resumeFile);
          application.resume = resume;
        } catch (err) {
          warning = `Candidate added, but the CV upload failed: ${
            err instanceof ApiError ? err.message : 'unknown error'
          }. You can upload it from the candidate page.`;
        }
      }

      onAdded({ application, reusedExistingCandidate, warning });
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Failed to add candidate');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? () => undefined : onClose}
      size="lg"
      title="Add candidate"
      description="Creates the candidate profile and an application in the Applied stage. Existing candidates are matched by email."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleSubmit()}
            disabled={saving || openRequisitions.length === 0}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Add to pipeline
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {submitError && (
          <div className="rounded-lg border border-error-200 bg-error-50 dark:bg-error-950/30 px-3 py-2 text-sm text-error-700 dark:text-error-300">
            {submitError}
          </div>
        )}
        {openRequisitions.length === 0 && (
          <div className="rounded-lg border border-warning-200 bg-warning-50 dark:bg-warning-950/30 px-3 py-2 text-sm text-warning-800 dark:text-warning-300">
            There are no open requisitions. Approve or reopen a requisition before adding
            candidates.
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="cand-first">First name</Label>
            <Input
              id="cand-first"
              value={form.firstName}
              onChange={(e) => set('firstName', e.target.value)}
            />
            <FieldError message={errors.firstName} />
          </div>
          <div>
            <Label htmlFor="cand-last">Last name</Label>
            <Input
              id="cand-last"
              value={form.lastName}
              onChange={(e) => set('lastName', e.target.value)}
            />
            <FieldError message={errors.lastName} />
          </div>
          <div>
            <Label htmlFor="cand-email">Email</Label>
            <Input
              id="cand-email"
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
            />
            <FieldError message={errors.email} />
          </div>
          <div>
            <Label htmlFor="cand-phone">Phone</Label>
            <Input
              id="cand-phone"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="cand-source">Source</Label>
            <Select
              id="cand-source"
              value={form.source}
              onChange={(e) => set('source', e.target.value as CandidateSource)}
            >
              {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="cand-exp">Years of experience</Label>
            <Input
              id="cand-exp"
              type="number"
              min={0}
              step={1}
              value={form.yearsExperience}
              onChange={(e) => set('yearsExperience', e.target.value)}
            />
            <FieldError message={errors.yearsExperience} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="cand-req">Applying for</Label>
            <Select
              id="cand-req"
              value={form.requisitionId}
              onChange={(e) => set('requisitionId', e.target.value)}
            >
              {openRequisitions.length === 0 && <option value="">No open requisitions</option>}
              {openRequisitions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.referenceNumber} — {r.title}
                </option>
              ))}
            </Select>
            <FieldError message={errors.requisitionId} />
          </div>
        </div>
        <div>
          <Label htmlFor="cand-cover">Cover letter</Label>
          <Textarea
            id="cand-cover"
            rows={3}
            value={form.coverLetter}
            onChange={(e) => set('coverLetter', e.target.value)}
          />
        </div>
        <div>
          <Label>Resume / CV</Label>
          <div className="flex items-center gap-2 mt-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileText className="h-4 w-4" />
              {resumeFile ? resumeFile.name : 'Choose file'}
            </Button>
            {resumeFile && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Remove selected CV"
                onClick={() => {
                  setResumeFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {fileError ? (
            <FieldError message={fileError} />
          ) : (
            <p className="text-xs text-muted mt-1">PDF, JPG, or PNG up to 10 MB.</p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={RECRUITMENT_FILE_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              const problem = file ? uploadFileError(file) : null;
              setFileError(problem);
              setResumeFile(problem ? null : file);
              if (problem) e.target.value = '';
            }}
          />
        </div>
      </div>
    </Modal>
  );
}
