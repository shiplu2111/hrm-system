import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Star,
  Mail,
  Clock,
  Check,
  Loader2,
  Briefcase,
  Megaphone,
  FileText,
  Send,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import type {
  ApplicationStage,
  JobApplicationRecord,
  JobPostingRecord,
  JobRequisitionRecord,
} from '@hrm/shared-types';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgPageState } from '@/components/org/OrgPageState';
import { useNav } from '@/context/NavContext';
import {
  createCandidate,
  createJobApplication,
  createJobPosting,
  createJobRequisition,
  listJobApplications,
  listJobPostings,
  listJobRequisitions,
  approveJobRequisition,
  publishJobPosting,
  rejectJobRequisition,
  submitJobRequisition,
  updateApplicationStage,
  uploadApplicationResume,
} from '@/lib/recruitment-api';
import { ApiError } from '@/lib/tenant-api-client';
import { listDepartments } from '@/lib/organization-api';

const PIPELINE_STAGES: { key: ApplicationStage; label: string; color: string }[] = [
  { key: 'applied', label: 'Applied', color: 'border-t-slate-400' },
  { key: 'screening', label: 'Screening', color: 'border-t-sky-500' },
  { key: 'interview', label: 'Interview', color: 'border-t-accent-500' },
  { key: 'offer', label: 'Offer', color: 'border-t-warning-500' },
  { key: 'hired', label: 'Hired', color: 'border-t-success-500' },
];

const AVATAR_COLORS = [
  'bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300',
  'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300',
  'bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-300',
  'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = name.charCodeAt(i) + hash * 31;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function KanbanCard({
  application,
  onClick,
}: {
  application: JobApplicationRecord;
  onClick: () => void;
}) {
  const name = application.candidateName ?? 'Candidate';
  return (
    <div
      onClick={onClick}
      className="surface rounded-lg border shadow-card p-3 hover:shadow-card-hover hover:-translate-y-0.5 transition-all cursor-pointer"
    >
      <div className="flex items-start gap-2.5">
        <div
          className={`h-8 w-8 rounded-full ${avatarColor(name)} flex items-center justify-center text-xs font-semibold shrink-0`}
        >
          {name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-primary truncate">{name}</div>
          <div className="text-xs text-secondary truncate">
            {application.requisitionTitle}
          </div>
        </div>
        {application.rating != null && application.rating > 0 && (
          <div className="flex items-center gap-0.5">
            <Star className="h-3 w-3 text-warning-500 fill-warning-500" />
            <span className="text-xs text-muted">{application.rating}</span>
          </div>
        )}
      </div>
      <div className="mt-2.5 flex items-center gap-2 text-[11px] text-muted">
        <Clock className="h-3 w-3" />
        {application.yearsExperience != null
          ? `${application.yearsExperience} years`
          : 'Experience n/a'}
        <span>·</span>
        <Mail className="h-3 w-3" />
        {application.resume ? 'CV attached' : 'No CV'}
      </div>
    </div>
  );
}

function RecruitmentContent({ companyId }: { companyId: string }) {
  const { openApplication } = useNav();
  const [requisitions, setRequisitions] = useState<JobRequisitionRecord[]>([]);
  const [postings, setPostings] = useState<JobPostingRecord[]>([]);
  const [applications, setApplications] = useState<JobApplicationRecord[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requisitionFilter, setRequisitionFilter] = useState<string>('all');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [reqOpen, setReqOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [yearsExperience, setYearsExperience] = useState(3);
  const [applicationRequisitionId, setApplicationRequisitionId] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [reqTitle, setReqTitle] = useState('');
  const [reqDepartmentId, setReqDepartmentId] = useState('');
  const [reqDescription, setReqDescription] = useState('');
  const [reqHeadcount, setReqHeadcount] = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reqRows, postingRows, appRows, deptRows] = await Promise.all([
        listJobRequisitions(companyId),
        listJobPostings(companyId),
        listJobApplications(companyId),
        listDepartments(companyId),
      ]);
      setRequisitions(reqRows);
      setPostings(postingRows);
      setApplications(appRows);
      setDepartments(deptRows.map((d) => ({ id: d.id, name: d.name })));
      setApplicationRequisitionId(
        (current) =>
          current ||
          reqRows.find((r) => r.status === 'open')?.id ||
          reqRows[0]?.id ||
          '',
      );
      setReqDepartmentId((current) => current || deptRows[0]?.id || '');
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to load recruitment data',
      );
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredApplications = useMemo(() => {
    if (requisitionFilter === 'all') return applications;
    return applications.filter((a) => a.requisitionId === requisitionFilter);
  }, [applications, requisitionFilter]);

  const openRequisitions = requisitions.filter((r) => r.status === 'open');

  const handleDrop = async (stage: ApplicationStage) => {
    if (!draggedId) return;
    const application = applications.find((a) => a.id === draggedId);
    if (!application || application.stage === stage) {
      setDraggedId(null);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateApplicationStage(draggedId, stage, application.rating ?? undefined);
      await loadData();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to update application stage',
      );
    } finally {
      setSaving(false);
      setDraggedId(null);
    }
  };

  const handleAddCandidate = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !applicationRequisitionId) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const candidate = await createCandidate(companyId, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        yearsExperience,
        source: 'website',
      });

      const application = await createJobApplication(companyId, {
        candidateId: candidate.id,
        requisitionId: applicationRequisitionId,
        postingId: postings.find((p) => p.requisitionId === applicationRequisitionId)?.id,
        coverLetter: coverLetter.trim() || undefined,
      });

      if (resumeFile) {
        await uploadApplicationResume(application.id, resumeFile);
      }

      setAddOpen(false);
      setFirstName('');
      setLastName('');
      setEmail('');
      setCoverLetter('');
      setResumeFile(null);
      await loadData();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to add candidate',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRequisition = async () => {
    if (!reqTitle.trim() || !reqDescription.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createJobRequisition(companyId, {
        title: reqTitle.trim(),
        departmentId: reqDepartmentId || undefined,
        description: reqDescription.trim(),
        headcount: reqHeadcount,
      });
      setReqOpen(false);
      setReqTitle('');
      setReqDescription('');
      await loadData();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to create requisition',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRequisitionAction = async (
    action: 'submit' | 'approve' | 'reject' | 'create-posting' | 'publish',
    requisition: JobRequisitionRecord,
  ) => {
    setSaving(true);
    setError(null);
    try {
      if (action === 'submit') {
        await submitJobRequisition(requisition.id);
      } else if (action === 'approve') {
        await approveJobRequisition(requisition.id);
      } else if (action === 'reject') {
        await rejectJobRequisition(requisition.id);
      } else if (action === 'create-posting') {
        await createJobPosting(companyId, { requisitionId: requisition.id });
      } else if (action === 'publish' && requisition.posting) {
        await publishJobPosting(requisition.posting.id);
      }
      await loadData();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to update requisition',
      );
    } finally {
      setSaving(false);
    }
  };

  const requisitionBadgeTone = (
    status: JobRequisitionRecord['status'],
  ): 'neutral' | 'warning' | 'success' | 'error' => {
    if (status === 'open') return 'success';
    if (status === 'pending_approval') return 'warning';
    if (status === 'cancelled') return 'error';
    return 'neutral';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-secondary">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading recruitment pipeline…
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Recruitment Pipeline</h1>
          <p className="text-sm text-secondary mt-0.5">
            {filteredApplications.length} applications · {openRequisitions.length} open
            requisitions
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setReqOpen(true)}>
            <Briefcase className="h-4 w-4" /> New Requisition
          </Button>
          <Button variant="primary" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Candidate
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-error-200 bg-error-50 dark:bg-error-950/30 px-4 py-3 text-sm text-error-700 dark:text-error-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="h-4 w-4" /> Job Requisitions
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {requisitions.length === 0 && (
              <p className="text-sm text-secondary">No requisitions yet.</p>
            )}
            {requisitions.map((req) => (
              <div key={req.id} className="rounded-lg border border-base p-3">
                <div className="font-medium text-primary">{req.title}</div>
                <div className="text-xs text-muted mt-1">{req.referenceNumber}</div>
                <div className="text-xs text-secondary mt-2 line-clamp-2">
                  {req.description}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge tone={requisitionBadgeTone(req.status)}>
                    {req.displayStatus}
                  </Badge>
                  <span className="text-xs text-muted">
                    {req.applicationCount ?? 0} applicants
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {req.status === 'draft' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={saving}
                      onClick={() => void handleRequisitionAction('submit', req)}
                    >
                      <Send className="h-3.5 w-3.5" /> Submit for Approval
                    </Button>
                  )}
                  {req.status === 'pending_approval' && (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={saving}
                        onClick={() => void handleRequisitionAction('approve', req)}
                      >
                        <ThumbsUp className="h-3.5 w-3.5" /> Approve
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={saving}
                        onClick={() => void handleRequisitionAction('reject', req)}
                      >
                        <ThumbsDown className="h-3.5 w-3.5" /> Reject
                      </Button>
                    </>
                  )}
                  {req.status === 'open' && !req.posting && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={saving}
                      onClick={() =>
                        void handleRequisitionAction('create-posting', req)
                      }
                    >
                      <Megaphone className="h-3.5 w-3.5" /> Create Posting
                    </Button>
                  )}
                  {req.status === 'open' &&
                    req.posting?.status === 'draft' && (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={saving}
                        onClick={() => void handleRequisitionAction('publish', req)}
                      >
                        <Megaphone className="h-3.5 w-3.5" /> Publish Posting
                      </Button>
                    )}
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="h-4 w-4" /> Published Postings
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {postings.filter((p) => p.status === 'published').length === 0 && (
              <p className="text-sm text-secondary">No published postings yet.</p>
            )}
            {postings
              .filter((p) => p.status === 'published')
              .map((posting) => (
                <div key={posting.id} className="rounded-lg border border-base p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-primary">{posting.title}</div>
                      <div className="text-xs text-muted">
                        {posting.requisitionTitle}
                      </div>
                    </div>
                    <Badge tone="success">{posting.displayStatus}</Badge>
                  </div>
                  {posting.summary && (
                    <p className="text-sm text-secondary mt-2">{posting.summary}</p>
                  )}
                </div>
              ))}
          </CardBody>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Label htmlFor="req-filter">Filter by requisition</Label>
        <Select
          id="req-filter"
          value={requisitionFilter}
          onChange={(e) => setRequisitionFilter(e.target.value)}
          className="max-w-md"
        >
          <option value="all">All requisitions</option>
          {requisitions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.referenceNumber} — {r.title}
            </option>
          ))}
        </Select>
        {saving && (
          <span className="text-xs text-secondary flex items-center gap-1">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
          </span>
        )}
      </div>

      <div className="flex gap-4 overflow-x-auto scrollbar-thin pb-4">
        {PIPELINE_STAGES.map((stage) => {
          const stageApps = filteredApplications.filter((a) => a.stage === stage.key);
          return (
            <div
              key={stage.key}
              className="flex flex-col w-72 shrink-0"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => void handleDrop(stage.key)}
            >
              <div
                className={`surface rounded-t-xl border border-b-0 ${stage.color} border-t-2 px-3 py-2.5 flex items-center justify-between`}
              >
                <span className="text-sm font-semibold text-primary">{stage.label}</span>
                <Badge tone="neutral">{stageApps.length}</Badge>
              </div>
              <div className="surface rounded-b-xl border border-t-0 p-2.5 space-y-2 min-h-[200px] flex-1">
                {stageApps.map((app) => (
                  <div
                    key={app.id}
                    draggable
                    onDragStart={() => setDraggedId(app.id)}
                    onDragEnd={() => setDraggedId(null)}
                    className={draggedId === app.id ? 'opacity-50' : ''}
                  >
                    <KanbanCard
                      application={app}
                      onClick={() => openApplication(app.id)}
                    />
                  </div>
                ))}
                {stageApps.length === 0 && (
                  <div className="flex items-center justify-center h-20 text-xs text-muted border-2 border-dashed border-base rounded-lg">
                    Drop here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Candidate">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="c-first">First name</Label>
              <Input
                id="c-first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="c-last">Last name</Label>
              <Input
                id="c-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="c-email">Email</Label>
              <Input
                id="c-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="c-exp">Years of experience</Label>
              <Input
                id="c-exp"
                type="number"
                min={0}
                value={yearsExperience}
                onChange={(e) => setYearsExperience(Number(e.target.value))}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="c-req">Applying for</Label>
              <Select
                id="c-req"
                value={applicationRequisitionId}
                onChange={(e) => setApplicationRequisitionId(e.target.value)}
              >
                {requisitions
                  .filter((r) => r.status === 'open')
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="c-cover">Cover letter / notes</Label>
            <Textarea
              id="c-cover"
              rows={3}
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
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
                {resumeFile ? resumeFile.name : 'Upload CV'}
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={saving || !firstName.trim() || !email.trim()}
              onClick={() => void handleAddCandidate()}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" /> Add to Pipeline
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={reqOpen}
        onClose={() => setReqOpen(false)}
        title="New Job Requisition"
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="r-title">Job title</Label>
            <Input
              id="r-title"
              value={reqTitle}
              onChange={(e) => setReqTitle(e.target.value)}
              placeholder="e.g. Senior Frontend Engineer"
            />
          </div>
          <div>
            <Label htmlFor="r-dept">Department</Label>
            <Select
              id="r-dept"
              value={reqDepartmentId}
              onChange={(e) => setReqDepartmentId(e.target.value)}
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="r-headcount">Headcount</Label>
            <Input
              id="r-headcount"
              type="number"
              min={1}
              value={reqHeadcount}
              onChange={(e) => setReqHeadcount(Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="r-desc">Job description</Label>
            <Textarea
              id="r-desc"
              rows={4}
              value={reqDescription}
              onChange={(e) => setReqDescription(e.target.value)}
            />
          </div>
          <p className="text-xs text-secondary">
            Creates a draft requisition. Submit for HR approval, then create and
            publish a job posting separately once approved.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setReqOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={saving || !reqTitle.trim() || !reqDescription.trim()}
              onClick={() => void handleCreateRequisition()}
            >
              {saving ? 'Creating…' : 'Create Draft Requisition'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export function RecruitmentPage() {
  return (
    <OrgPageState>
      {(companyId) => (
        <>
          <div className="px-4 lg:px-6 pt-4">
            <CompanySelector />
          </div>
          <RecruitmentContent companyId={companyId} />
        </>
      )}
    </OrgPageState>
  );
}
