import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  Download,
  FileSignature,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  Paperclip,
  Pencil,
  Phone,
  Star,
  Trash2,
  Upload,
  UserPlus,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type {
  ApplicationStage,
  CandidateDocumentRecord,
  CandidateNoteRecord,
  CandidateRecord,
  CandidateSource,
  JobApplicationRecord,
  OfferLetterRecord,
} from '@hrm/shared-types';
import { usePermissions } from '@hrm/portal-ui';
import { EmployeeFormWizard } from '@/components/people/EmployeeFormWizard';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FieldError } from '@/components/ui/FieldError';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { InterviewRoundsPanel } from '@/components/recruitment/InterviewRoundsPanel';
import { CandidateAvatar } from '@/components/recruitment/CandidateAvatar';
import {
  MANUAL_STAGES,
  RECRUITMENT_FILE_ACCEPT,
  SOURCE_LABELS,
  STAGE_META,
  canMoveApplication,
  uploadFileError,
} from '@/components/recruitment/recruitment-ui';
import { useNav } from '@/context/NavContext';
import {
  createCandidateNote,
  deleteCandidateDocument,
  deleteCandidateNote,
  formatResumeSize,
  getApplicationResumeFileUrl,
  getCandidate,
  getCandidateDocumentFileUrl,
  getJobApplication,
  getOfferLetter,
  listCandidateApplications,
  listCandidateDocuments,
  listCandidateNotes,
  updateApplicationStage,
  updateCandidate,
  uploadApplicationResume,
  uploadCandidateDocument,
} from '@/lib/recruitment-api';
import { ApiError } from '@/lib/tenant-api-client';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/** Opens the tab synchronously so popup blockers allow it, then points it at the signed URL. */
async function openSignedUrl(getUrl: () => Promise<{ url: string }>): Promise<void> {
  const tab = window.open('', '_blank');
  try {
    const { url } = await getUrl();
    if (tab) {
      tab.opener = null;
      tab.location.href = url;
    } else {
      window.location.assign(url);
    }
  } catch (err) {
    tab?.close();
    throw err;
  }
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted uppercase tracking-wide">{label}</div>
      <div className="text-secondary">{children}</div>
    </div>
  );
}

interface CandidateForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  source: CandidateSource;
  yearsExperience: string;
  notes: string;
}

function EditCandidateModal({
  candidate,
  open,
  onClose,
  onSaved,
}: {
  candidate: CandidateRecord;
  open: boolean;
  onClose: () => void;
  onSaved: (candidate: CandidateRecord) => void;
}) {
  const [form, setForm] = useState<CandidateForm | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof CandidateForm, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email,
      phone: candidate.phone ?? '',
      source: candidate.source,
      yearsExperience: candidate.yearsExperience?.toString() ?? '',
      notes: candidate.notes ?? '',
    });
    setErrors({});
    setSubmitError(null);
  }, [open, candidate]);

  if (!form) return null;
  const set = <K extends keyof CandidateForm>(key: K, value: CandidateForm[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  const handleSave = async () => {
    const next: typeof errors = {};
    if (!form.firstName.trim()) next.firstName = 'Required';
    if (!form.lastName.trim()) next.lastName = 'Required';
    if (!EMAIL_RE.test(form.email.trim())) next.email = 'Enter a valid email address';
    const years = form.yearsExperience === '' ? null : Number(form.yearsExperience);
    if (years != null && (!Number.isInteger(years) || years < 0)) {
      next.yearsExperience = 'Whole number, 0 or more';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    setSubmitError(null);
    try {
      onSaved(
        await updateCandidate(candidate.id, {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          source: form.source,
          yearsExperience: years,
          notes: form.notes.trim() || null,
        }),
      );
    } catch (err) {
      setSubmitError(errorMessage(err, 'Failed to save candidate'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? () => undefined : onClose}
      title="Edit candidate"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void handleSave()} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {submitError && (
          <div className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-700">
            {submitError}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="ec-first">First name</Label>
            <Input id="ec-first" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
            <FieldError message={errors.firstName} />
          </div>
          <div>
            <Label htmlFor="ec-last">Last name</Label>
            <Input id="ec-last" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
            <FieldError message={errors.lastName} />
          </div>
          <div>
            <Label htmlFor="ec-email">Email</Label>
            <Input id="ec-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            <FieldError message={errors.email} />
          </div>
          <div>
            <Label htmlFor="ec-phone">Phone</Label>
            <Input id="ec-phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ec-source">Source</Label>
            <Select
              id="ec-source"
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
            <Label htmlFor="ec-exp">Years of experience</Label>
            <Input
              id="ec-exp"
              type="number"
              min={0}
              step={1}
              value={form.yearsExperience}
              onChange={(e) => set('yearsExperience', e.target.value)}
            />
            <FieldError message={errors.yearsExperience} />
          </div>
        </div>
        <div>
          <Label htmlFor="ec-summary">Profile summary</Label>
          <Textarea
            id="ec-summary"
            rows={3}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Short summary shown on the profile. Use Notes below for the running log."
          />
        </div>
      </div>
    </Modal>
  );
}

function NotesCard({
  candidateId,
  applicationId,
  notes,
  onChange,
}: {
  candidateId: string;
  applicationId: string;
  notes: CandidateNoteRecord[];
  onChange: (notes: CandidateNoteRecord[]) => void;
}) {
  const { user, can } = usePermissions();
  const canEdit = can('recruitment', 'edit');
  const canModerate = can('recruitment', 'approve');
  const [body, setBody] = useState('');
  const [linkToApplication, setLinkToApplication] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CandidateNoteRecord | null>(null);

  const handleAdd = async () => {
    if (!body.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const note = await createCandidateNote(candidateId, {
        body: body.trim(),
        applicationId: linkToApplication ? applicationId : undefined,
      });
      onChange([note, ...notes]);
      setBody('');
    } catch (err) {
      setError(errorMessage(err, 'Failed to add note'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" /> Notes
          <span className="text-xs font-normal text-muted">({notes.length})</span>
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        {error && (
          <div className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-700">
            {error}
          </div>
        )}
        {canEdit && (
          <div className="space-y-2">
            <Textarea
              aria-label="New note"
              rows={3}
              value={body}
              maxLength={5000}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Phone screen summary, references, salary expectations…"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleAdd();
              }}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs text-secondary cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={linkToApplication}
                  onChange={(e) => setLinkToApplication(e.target.checked)}
                />
                Link to this application
              </label>
              <Button
                variant="primary"
                size="sm"
                disabled={saving || !body.trim()}
                onClick={() => void handleAdd()}
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Add note
              </Button>
            </div>
          </div>
        )}
        {notes.length === 0 ? (
          <p className="text-sm text-secondary">No notes yet.</p>
        ) : (
          <ol className="space-y-3">
            {notes.map((note) => {
              const canDelete =
                canEdit && (note.authorUserId === user?.id || canModerate);
              return (
                <li key={note.id} className="rounded-lg border border-base p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs text-muted">
                      <span className="font-medium text-primary">{note.authorName}</span>
                      {' · '}
                      {new Date(note.createdAt).toLocaleString()}
                      {note.applicationLabel && (
                        <span className="block sm:inline sm:before:content-['_·_']">
                          {note.applicationLabel}
                        </span>
                      )}
                    </div>
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Delete note"
                        onClick={() => setDeleting(note)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <p className="text-sm text-secondary whitespace-pre-wrap mt-1.5">{note.body}</p>
                </li>
              );
            })}
          </ol>
        )}
      </CardBody>
      <ConfirmDialog
        open={deleting != null}
        title="Delete note?"
        description="The note is removed for everyone. This is recorded in the audit log."
        confirmLabel="Delete"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await deleteCandidateNote(deleting.id);
          onChange(notes.filter((n) => n.id !== deleting.id));
        }}
      />
    </Card>
  );
}

function DocumentsCard({
  candidateId,
  documents,
  onChange,
}: {
  candidateId: string;
  documents: CandidateDocumentRecord[];
  onChange: (documents: CandidateDocumentRecord[]) => void;
}) {
  const { can } = usePermissions();
  const canEdit = can('recruitment', 'edit');
  const [label, setLabel] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CandidateDocumentRecord | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const resetPicker = () => {
    setFile(null);
    setLabel('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const doc = await uploadCandidateDocument(candidateId, file, label.trim() || undefined);
      onChange([doc, ...documents]);
      resetPicker();
    } catch (err) {
      setError(errorMessage(err, 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Paperclip className="h-4 w-4" /> Documents
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        {error && (
          <div className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-700">
            {error}
          </div>
        )}
        {documents.length === 0 ? (
          <p className="text-sm text-secondary">
            No documents. Add certificates, portfolios, ID copies, or reference letters.
          </p>
        ) : (
          <ul className="space-y-2">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-base">
                <FileText className="h-6 w-6 text-accent-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-primary truncate">{doc.label}</div>
                  <div className="text-xs text-muted truncate">
                    {doc.label !== doc.originalName && `${doc.originalName} · `}
                    {formatResumeSize(doc.sizeBytes)} ·{' '}
                    {new Date(doc.uploadedAt).toLocaleDateString()}
                    {doc.uploadedByName && ` · ${doc.uploadedByName}`}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Download ${doc.label}`}
                  onClick={() =>
                    void openSignedUrl(() => getCandidateDocumentFileUrl(doc.id)).catch((err) =>
                      setError(errorMessage(err, 'Failed to open document')),
                    )
                  }
                >
                  <Download className="h-4 w-4" />
                </Button>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Delete ${doc.label}`}
                    onClick={() => setDeleting(doc)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <div className="pt-3 border-t border-base space-y-2">
            <Input
              aria-label="Document label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (optional), e.g. Degree certificate"
              maxLength={120}
            />
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
                <Paperclip className="h-3.5 w-3.5" />
                <span className="truncate max-w-[10rem]">{file ? file.name : 'Choose file'}</span>
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!file || uploading}
                onClick={() => void handleUpload()}
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                Upload
              </Button>
            </div>
            <p className="text-xs text-muted">PDF, JPG, or PNG up to 10 MB.</p>
            <input
              ref={inputRef}
              type="file"
              accept={RECRUITMENT_FILE_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const picked = e.target.files?.[0] ?? null;
                const problem = picked ? uploadFileError(picked) : null;
                setError(problem);
                setFile(problem ? null : picked);
                if (problem) e.target.value = '';
              }}
            />
          </div>
        )}
      </CardBody>
      <ConfirmDialog
        open={deleting != null}
        title={`Delete ${deleting?.label ?? 'document'}?`}
        description="The file is permanently removed from storage."
        confirmLabel="Delete"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await deleteCandidateDocument(deleting.id);
          onChange(documents.filter((d) => d.id !== deleting.id));
        }}
      />
    </Card>
  );
}

export function CandidateProfilePage() {
  const { navigate, openApplication, openEmployee, openOfferLetter, selectedApplicationId } = useNav();
  const [searchParams, setSearchParams] = useSearchParams();
  const { can } = usePermissions();
  const canEdit = can('recruitment', 'edit');
  const canUploadResume = can('recruitment', 'create');
  const canApprove = can('recruitment', 'approve');
  const canCreateEmployees = can('employee', 'create');

  const [application, setApplication] = useState<JobApplicationRecord | null>(null);
  const [candidate, setCandidate] = useState<CandidateRecord | null>(null);
  const [applications, setApplications] = useState<JobApplicationRecord[]>([]);
  const [notes, setNotes] = useState<CandidateNoteRecord[]>([]);
  const [documents, setDocuments] = useState<CandidateDocumentRecord[]>([]);
  const [offer, setOffer] = useState<OfferLetterRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [stageSaving, setStageSaving] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const offerAccepted = offer?.status === 'accepted';

  const loadOfferStatus = useCallback(async (app: JobApplicationRecord) => {
    if (app.stage !== 'offer' && app.stage !== 'hired') {
      setOffer(null);
      return;
    }
    try {
      setOffer(await getOfferLetter(app.id));
    } catch {
      setOffer(null);
    }
  }, []);

  const load = useCallback(async () => {
    if (!selectedApplicationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const app = await getJobApplication(selectedApplicationId);
      setApplication(app);
      const [cand, apps, noteRows, docRows] = await Promise.all([
        getCandidate(app.candidateId),
        listCandidateApplications(app.companyId, app.candidateId),
        listCandidateNotes(app.candidateId),
        listCandidateDocuments(app.candidateId),
      ]);
      setCandidate(cand);
      setApplications(apps);
      setNotes(noteRows);
      setDocuments(docRows);
      await loadOfferStatus(app);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load candidate'));
    } finally {
      setLoading(false);
    }
  }, [selectedApplicationId, loadOfferStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyApplication = (updated: JobApplicationRecord) => {
    setApplication(updated);
    setApplications((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
  };

  const handleStageChange = async (stage: ApplicationStage) => {
    if (!application || !canMoveApplication(application, stage)) return;
    setStageSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateApplicationStage(application.id, stage);
      applyApplication(updated);
      await loadOfferStatus(updated);
      setNotice(`Moved to ${STAGE_META[stage].label}.`);
    } catch (err) {
      setError(errorMessage(err, 'Failed to change stage'));
    } finally {
      setStageSaving(false);
    }
  };

  const handleRatingChange = async (value: string) => {
    if (!application) return;
    setError(null);
    try {
      applyApplication(
        await updateApplicationStage(application.id, application.stage, Number(value)),
      );
    } catch (err) {
      setError(errorMessage(err, 'Failed to save rating'));
    }
  };

  const handleResumeUpload = async (file: File) => {
    if (!application) return;
    const problem = uploadFileError(file);
    if (problem) {
      setError(problem);
      return;
    }
    setUploadingResume(true);
    setError(null);
    try {
      const resume = await uploadApplicationResume(application.id, file);
      applyApplication({ ...application, resume });
      setNotice(application.resume ? 'CV replaced.' : 'CV uploaded.');
    } catch (err) {
      setError(errorMessage(err, 'CV upload failed'));
    } finally {
      setUploadingResume(false);
      if (resumeInputRef.current) resumeInputRef.current.value = '';
    }
  };

  const canConvert = canApprove && canCreateEmployees;
  const wantsConvert = searchParams.get('convert') === '1';

  useEffect(() => {
    if (!wantsConvert || loading || !application) return;
    setSearchParams(
      (params) => {
        params.delete('convert');
        return params;
      },
      { replace: true },
    );
    const alreadyHired = application.stage === 'hired' || application.hiredEmployeeId != null;
    if (canConvert && offerAccepted && !alreadyHired) setConvertOpen(true);
  }, [wantsConvert, loading, application, canConvert, offerAccepted, setSearchParams]);

  if (!selectedApplicationId) {
    return <div className="p-6 text-secondary">Select a candidate from the recruitment pipeline.</div>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-secondary">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading candidate…
      </div>
    );
  }

  if (!application || !candidate) {
    return <div className="p-6 text-error-600">{error ?? 'Application not found.'}</div>;
  }

  const hired = application.stage === 'hired' || application.hiredEmployeeId != null;
  const showInterviews = ['interview', 'offer', 'hired', 'rejected'].includes(application.stage);
  const otherApplications = applications.filter((a) => a.id !== application.id);

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <button
        type="button"
        onClick={() => navigate('recruitment')}
        className="flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to pipeline
      </button>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <CandidateAvatar name={candidate.fullName} size="lg" />
          <div>
            <h1 className="text-xl font-bold text-primary">{candidate.fullName}</h1>
            <div className="text-sm text-secondary">
              {application.requisitionReference} · {application.requisitionTitle}
            </div>
            <div className="mt-1.5">
              <Badge tone={STAGE_META[application.stage].tone} dot>
                {application.displayStage}
              </Badge>
            </div>
          </div>
        </div>
        {canEdit && !hired && (
          <div className="flex items-center gap-2">
            <Label htmlFor="cand-stage">Stage</Label>
            <Select
              id="cand-stage"
              className="w-44"
              value={application.stage}
              disabled={stageSaving}
              onChange={(e) => void handleStageChange(e.target.value as ApplicationStage)}
            >
              {MANUAL_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {STAGE_META[stage].label}
                </option>
              ))}
            </Select>
            {stageSaving && <Loader2 className="h-4 w-4 animate-spin text-secondary" />}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-error-200 bg-error-50 dark:bg-error-950/30 px-4 py-3 text-sm text-error-700 dark:text-error-300">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-success-200 bg-success-50 dark:bg-success-950/30 px-4 py-3 text-sm text-success-700 dark:text-success-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> {notice}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Contact &amp; profile</CardTitle>
              {canEdit && (
                <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              )}
            </CardHeader>
            <CardBody className="space-y-2.5 text-sm">
              <a
                href={`mailto:${candidate.email}`}
                className="flex items-center gap-2 text-secondary hover:text-accent-600"
              >
                <Mail className="h-3.5 w-3.5" /> {candidate.email}
              </a>
              <div className="flex items-center gap-2 text-secondary">
                <Phone className="h-3.5 w-3.5" /> {candidate.phone ?? 'No phone'}
              </div>
              <div className="flex items-center gap-2 text-secondary">
                <Briefcase className="h-3.5 w-3.5" />
                {candidate.yearsExperience != null
                  ? `${candidate.yearsExperience} years experience`
                  : 'Experience not specified'}
              </div>
              <div className="text-xs text-muted">
                Source: {SOURCE_LABELS[candidate.source]} · Candidate since{' '}
                {new Date(candidate.createdAt).toLocaleDateString()}
              </div>
              {candidate.notes && (
                <p className="text-secondary whitespace-pre-wrap pt-2 border-t border-base">
                  {candidate.notes}
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resume / CV</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              {application.resume ? (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-base">
                  <FileText className="h-8 w-8 text-accent-500" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-primary truncate">
                      {application.resume.originalName}
                    </div>
                    <div className="text-xs text-muted">
                      {formatResumeSize(application.resume.sizeBytes)} · uploaded{' '}
                      {new Date(application.resume.uploadedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label="Download CV"
                    onClick={() =>
                      void openSignedUrl(() => getApplicationResumeFileUrl(application.id)).catch(
                        (err) => setError(errorMessage(err, 'Failed to open CV')),
                      )
                    }
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-secondary">No CV uploaded for this application.</p>
              )}
              {canUploadResume && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploadingResume}
                    onClick={() => resumeInputRef.current?.click()}
                  >
                    {uploadingResume ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    {application.resume ? 'Replace CV' : 'Upload CV'}
                  </Button>
                  <input
                    ref={resumeInputRef}
                    type="file"
                    accept={RECRUITMENT_FILE_ACCEPT}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleResumeUpload(file);
                    }}
                  />
                </>
              )}
            </CardBody>
          </Card>

          <DocumentsCard
            candidateId={candidate.id}
            documents={documents}
            onChange={setDocuments}
          />
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Application</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <DetailRow label="Applied">
                  {new Date(application.appliedAt).toLocaleDateString()}
                </DetailRow>
                <DetailRow label="In current stage since">
                  {new Date(application.stageUpdatedAt).toLocaleDateString()}
                </DetailRow>
                <DetailRow label="Rating">
                  {canEdit ? (
                    <Select
                      aria-label="Rating"
                      className="h-8 w-28 text-sm"
                      value={application.rating != null ? String(application.rating) : ''}
                      onChange={(e) => void handleRatingChange(e.target.value)}
                    >
                      {application.rating == null && <option value="">Not rated</option>}
                      {[0, 1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n === 0 ? '0 — none' : `${n} / 5`}
                        </option>
                      ))}
                    </Select>
                  ) : application.rating != null ? (
                    <span className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 text-warning-500" /> {application.rating}/5
                    </span>
                  ) : (
                    'Not rated'
                  )}
                </DetailRow>
              </div>
              {application.coverLetter && (
                <DetailRow label="Cover letter">
                  <p className="whitespace-pre-wrap">{application.coverLetter}</p>
                </DetailRow>
              )}

              {application.stage === 'offer' && !hired && (
                <div className="pt-3 border-t border-base space-y-3">
                  {offer ? (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-muted">Offer letter</span>
                      <Badge tone={offerAccepted ? 'success' : offer.status === 'declined' || offer.status === 'cancelled' ? 'error' : 'warning'}>
                        {offer.displayStatus}
                      </Badge>
                      <span className="text-xs text-muted">
                        {offer.templateLabel}
                        {offer.annualSalary != null
                          ? ` · ${offer.currency} ${offer.annualSalary.toLocaleString()}`
                          : ''}
                        {` · starts ${offer.startDate}`}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => openOfferLetter(application.id)}>
                      <FileSignature className="h-4 w-4" /> {offer && offer.status !== 'draft' ? 'View offer letter' : 'Prepare offer letter'}
                    </Button>
                    {canConvert && (
                      <Button
                        variant="primary"
                        disabled={!offerAccepted}
                        onClick={() => setConvertOpen(true)}
                      >
                        <UserPlus className="h-4 w-4" /> Convert to employee
                      </Button>
                    )}
                  </div>
                  {canConvert && (
                    <p className="text-xs text-muted">
                      {offerAccepted
                        ? 'Opens the Add Employee form pre-filled from the candidate and accepted offer, then starts onboarding.'
                        : 'Unlocks once the offer letter is approved, sent and marked accepted.'}
                    </p>
                  )}
                </div>
              )}
              {hired && (
                <div className="pt-3 border-t border-base flex flex-wrap items-center gap-2">
                  <Badge tone="success">Hired — employee record created</Badge>
                  {application.hiredEmployeeId && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openEmployee(application.hiredEmployeeId!)}
                    >
                      View employee
                    </Button>
                  )}
                  {offer && (
                    <Button variant="ghost" size="sm" onClick={() => openOfferLetter(application.id)}>
                      <FileSignature className="h-3.5 w-3.5" /> Offer letter
                    </Button>
                  )}
                </div>
              )}

              {otherApplications.length > 0 && (
                <div className="pt-3 border-t border-base">
                  <div className="text-xs text-muted uppercase tracking-wide mb-2">
                    Other applications by this candidate
                  </div>
                  <ul className="space-y-1.5">
                    {otherApplications.map((other) => (
                      <li key={other.id}>
                        <button
                          type="button"
                          onClick={() => openApplication(other.id)}
                          className="w-full flex items-center justify-between gap-2 rounded-md border border-base px-3 py-2 text-left hover:border-accent-300"
                        >
                          <span className="text-primary truncate">
                            {other.requisitionReference} · {other.requisitionTitle}
                          </span>
                          <Badge tone={STAGE_META[other.stage].tone}>{other.displayStage}</Badge>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardBody>
          </Card>

          <NotesCard
            candidateId={candidate.id}
            applicationId={application.id}
            notes={notes}
            onChange={setNotes}
          />

          {showInterviews && (
            <InterviewRoundsPanel
              key={application.id}
              application={application}
              onUpdated={() => void getJobApplication(application.id).then(applyApplication)}
            />
          )}
        </div>
      </div>

      {canConvert && (
        <EmployeeFormWizard
          open={convertOpen}
          onClose={() => setConvertOpen(false)}
          companyId={application.companyId}
          hireApplicationId={application.id}
          onHired={(updated) => {
            applyApplication(updated);
            setNotice(`${candidate.fullName} is now an employee — onboarding has started.`);
          }}
        />
      )}

      <EditCandidateModal
        candidate={candidate}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={(updated) => {
          setCandidate(updated);
          setEditOpen(false);
          setApplication((app) =>
            app ? { ...app, candidateName: updated.fullName, candidateEmail: updated.email } : app,
          );
          setNotice('Candidate details saved.');
        }}
      />
    </div>
  );
}
