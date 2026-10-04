import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  ClipboardList,
  Eye,
  KanbanSquare,
  Loader2,
  Lock,
  Megaphone,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Send,
  ThumbsDown,
  ThumbsUp,
  Users,
} from 'lucide-react';
import type {
  JobRequisitionRecord,
  JobRequisitionStatus,
  RecruitmentLookups,
} from '@hrm/shared-types';
import { PermissionGate, usePermissions } from '@hrm/portal-ui';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgPageState } from '@/components/org/OrgPageState';
import { RequisitionFormModal } from '@/components/recruitment/RequisitionFormModal';
import {
  REQUISITION_STATUS_TONE,
  canActOnWorkflowStep,
} from '@/components/recruitment/recruitment-ui';
import { pathForPage } from '@/config/routes';
import {
  approveJobRequisition,
  closeJobRequisition,
  createJobPosting,
  getRecruitmentLookups,
  listJobRequisitions,
  openJobRequisition,
  publishJobPosting,
  rejectJobRequisition,
  submitJobRequisition,
} from '@/lib/recruitment-api';
import { ApiError } from '@/lib/tenant-api-client';

const STATUS_OPTIONS: { value: JobRequisitionStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Pending approval' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
];

type DecisionMode = 'approve' | 'reject';

function SummaryCard({
  label,
  value,
  hint,
  active,
  onClick,
}: {
  label: string;
  value: number;
  hint?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`surface rounded-xl border p-4 text-left transition-colors hover:border-accent-300 ${
        active ? 'border-accent-500 ring-1 ring-accent-500' : ''
      }`}
    >
      <div className="text-xs font-medium text-secondary uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-2xl font-bold text-primary">{value}</div>
      {hint && <div className="text-xs text-muted mt-0.5">{hint}</div>}
    </button>
  );
}

function RequisitionsContent({ companyId }: { companyId: string }) {
  const routerNavigate = useNavigate();
  const { user, can } = usePermissions();
  const canCreate = can('recruitment', 'create');
  const canEdit = can('recruitment', 'edit');
  const canApprove = can('recruitment', 'approve');

  const [requisitions, setRequisitions] = useState<JobRequisitionRecord[]>([]);
  const [lookups, setLookups] = useState<RecruitmentLookups | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobRequisitionStatus | 'all'>('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<JobRequisitionRecord | null>(null);
  const [viewing, setViewing] = useState<JobRequisitionRecord | null>(null);
  const [closing, setClosing] = useState<JobRequisitionRecord | null>(null);
  const [decision, setDecision] = useState<{
    mode: DecisionMode;
    requisition: JobRequisitionRecord;
  } | null>(null);
  const [decisionComment, setDecisionComment] = useState('');
  const [decisionError, setDecisionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRequisitions(await listJobRequisitions(companyId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load requisitions');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setLookups(null);
    getRecruitmentLookups(companyId)
      .then(setLookups)
      .catch(() =>
        setLookups({
          departments: [],
          designations: [],
          jobLevels: [],
          employmentTypes: [],
          locations: [],
          employees: [],
        }),
      );
  }, [companyId]);

  const replaceRecord = (record: JobRequisitionRecord) => {
    setRequisitions((rows) => {
      const exists = rows.some((r) => r.id === record.id);
      return exists
        ? rows.map((r) => (r.id === record.id ? record : r))
        : [record, ...rows];
    });
    setViewing((current) => (current?.id === record.id ? record : current));
  };

  const runAction = async (
    requisition: JobRequisitionRecord,
    action: () => Promise<JobRequisitionRecord | void>,
    success: string,
  ) => {
    setBusyId(requisition.id);
    setError(null);
    setNotice(null);
    try {
      const result = await action();
      if (result) replaceRecord(result);
      else await load();
      setNotice(success);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  const counts = useMemo(() => {
    const byStatus = (s: JobRequisitionStatus) =>
      requisitions.filter((r) => r.status === s);
    const open = byStatus('open');
    return {
      open: open.length,
      openings: open.reduce((sum, r) => sum + r.headcount, 0),
      pending: byStatus('pending_approval').length,
      draft: byStatus('draft').length,
      applicants: open.reduce((sum, r) => sum + (r.applicationCount ?? 0), 0),
    };
  }, [requisitions]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return requisitions.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (departmentFilter !== 'all') {
        if (departmentFilter === 'none' ? r.departmentId : r.departmentId !== departmentFilter) {
          return false;
        }
      }
      if (!term) return true;
      return (
        r.title.toLowerCase().includes(term) ||
        r.referenceNumber.toLowerCase().includes(term) ||
        (r.requestedByName ?? '').toLowerCase().includes(term)
      );
    });
  }, [requisitions, search, statusFilter, departmentFilter]);

  const departmentOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of requisitions) {
      if (r.departmentId) seen.set(r.departmentId, r.departmentName ?? 'Unknown');
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [requisitions]);

  const openPipeline = (requisitionId: string) =>
    routerNavigate(`${pathForPage('recruitment')}?requisition=${requisitionId}`);

  const toggleStatus = (status: JobRequisitionStatus) =>
    setStatusFilter((current) => (current === status ? 'all' : status));

  const submitDecision = async () => {
    if (!decision) return;
    const { mode, requisition } = decision;
    if (mode === 'reject' && !decisionComment.trim()) {
      setDecisionError('Add a reason so the requester knows what to change.');
      return;
    }
    setBusyId(requisition.id);
    setDecisionError(null);
    try {
      const input = { comment: decisionComment.trim() || undefined };
      const record =
        mode === 'approve'
          ? await approveJobRequisition(requisition.id, input)
          : await rejectJobRequisition(requisition.id, input);
      replaceRecord(record);
      setNotice(
        mode === 'approve'
          ? record.status === 'open'
            ? `${record.referenceNumber} approved and open for applications.`
            : `${record.referenceNumber} approved — waiting on the next approver.`
          : `${record.referenceNumber} rejected.`,
      );
      setDecision(null);
    } catch (err) {
      setDecisionError(err instanceof ApiError ? err.message : 'Failed to record decision');
    } finally {
      setBusyId(null);
    }
  };

  const renderActions = (req: JobRequisitionRecord, layout: 'row' | 'detail') => {
    const busy = busyId === req.id;
    const size = layout === 'row' ? 'sm' : 'md';
    const editable =
      canEdit && (req.status === 'draft' || req.status === 'pending_approval');
    const canDecide =
      req.status === 'pending_approval' &&
      canApprove &&
      canActOnWorkflowStep(req.workflow, user?.roleName ?? '');

    return (
      <div className={`flex flex-wrap gap-1.5 ${layout === 'row' ? 'justify-end' : ''}`}>
        {layout === 'row' && (
          <Button
            variant="ghost"
            size="sm"
            aria-label={`View ${req.referenceNumber}`}
            onClick={() => setViewing(req)}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
        )}
        {editable && (
          <Button
            variant="ghost"
            size={size}
            disabled={busy}
            onClick={() => {
              setEditing(req);
              setFormOpen(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
        )}
        {req.status === 'draft' && canEdit && (
          <Button
            variant="secondary"
            size={size}
            disabled={busy}
            onClick={() =>
              void runAction(
                req,
                () => submitJobRequisition(req.id),
                `${req.referenceNumber} submitted for approval.`,
              )
            }
          >
            <Send className="h-3.5 w-3.5" /> Submit
          </Button>
        )}
        {canDecide && (
          <>
            <Button
              variant="primary"
              size={size}
              disabled={busy}
              onClick={() => {
                setDecision({ mode: 'approve', requisition: req });
                setDecisionComment('');
                setDecisionError(null);
              }}
            >
              <ThumbsUp className="h-3.5 w-3.5" /> Approve
            </Button>
            <Button
              variant="outline"
              size={size}
              disabled={busy}
              onClick={() => {
                setDecision({ mode: 'reject', requisition: req });
                setDecisionComment('');
                setDecisionError(null);
              }}
            >
              <ThumbsDown className="h-3.5 w-3.5" /> Reject
            </Button>
          </>
        )}
        {req.status === 'open' && !req.posting && canCreate && (
          <Button
            variant="secondary"
            size={size}
            disabled={busy}
            onClick={() =>
              void runAction(
                req,
                async () => {
                  await createJobPosting(companyId, { requisitionId: req.id });
                },
                `Draft posting created for ${req.referenceNumber}.`,
              )
            }
          >
            <Megaphone className="h-3.5 w-3.5" /> Create posting
          </Button>
        )}
        {req.status === 'open' && req.posting?.status === 'draft' && canEdit && (
          <Button
            variant="primary"
            size={size}
            disabled={busy}
            onClick={() =>
              void runAction(
                req,
                async () => {
                  await publishJobPosting(req.posting!.id);
                },
                `Posting for ${req.referenceNumber} published.`,
              )
            }
          >
            <Megaphone className="h-3.5 w-3.5" /> Publish
          </Button>
        )}
        {(req.status === 'open' || (req.applicationCount ?? 0) > 0) && (
          <Button variant="ghost" size={size} onClick={() => openPipeline(req.id)}>
            <KanbanSquare className="h-3.5 w-3.5" /> Pipeline
          </Button>
        )}
        {req.status === 'open' && canEdit && (
          <Button variant="ghost" size={size} disabled={busy} onClick={() => setClosing(req)}>
            <Lock className="h-3.5 w-3.5" /> Close
          </Button>
        )}
        {req.status === 'closed' && canEdit && (
          <Button
            variant="ghost"
            size={size}
            disabled={busy}
            onClick={() =>
              void runAction(
                req,
                () => openJobRequisition(req.id),
                `${req.referenceNumber} reopened.`,
              )
            }
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reopen
          </Button>
        )}
        {busy && <Loader2 className="h-4 w-4 animate-spin text-secondary self-center" />}
      </div>
    );
  };

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Job Requisitions</h1>
          <p className="text-sm text-secondary mt-0.5">
            Request, approve, and publish open positions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => routerNavigate(pathForPage('recruitment'))}>
            <KanbanSquare className="h-4 w-4" /> Candidate pipeline
          </Button>
          <PermissionGate module="recruitment" action="create">
            <Button
              variant="primary"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> New requisition
            </Button>
          </PermissionGate>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          label="Open"
          value={counts.open}
          hint={`${counts.openings} opening${counts.openings === 1 ? '' : 's'}`}
          active={statusFilter === 'open'}
          onClick={() => toggleStatus('open')}
        />
        <SummaryCard
          label="Pending approval"
          value={counts.pending}
          active={statusFilter === 'pending_approval'}
          onClick={() => toggleStatus('pending_approval')}
        />
        <SummaryCard
          label="Drafts"
          value={counts.draft}
          active={statusFilter === 'draft'}
          onClick={() => toggleStatus('draft')}
        />
        <SummaryCard label="Applicants (open roles)" value={counts.applicants} />
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

      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                aria-label="Search requisitions"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title, reference, or requester"
              />
            </div>
            <Select
              aria-label="Filter by status"
              className="lg:w-48"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as JobRequisitionStatus | 'all')}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filter by department"
              className="lg:w-56"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <option value="all">All departments</option>
              {departmentOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
              <option value="none">No department</option>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-secondary">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading requisitions…
            </div>
          ) : requisitions.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No requisitions yet"
              description="Create a requisition to request headcount. Once approved, publish a posting and start adding candidates."
              action={
                canCreate
                  ? {
                      label: 'New requisition',
                      icon: Plus,
                      onClick: () => {
                        setEditing(null);
                        setFormOpen(true);
                      },
                    }
                  : undefined
              }
              compact
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No requisitions match these filters"
              action={{
                label: 'Clear filters',
                variant: 'secondary',
                onClick: () => {
                  setSearch('');
                  setStatusFilter('all');
                  setDepartmentFilter('all');
                },
              }}
              compact
            />
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted border-b border-base">
                    <th className="px-5 py-2 font-medium">Requisition</th>
                    <th className="px-3 py-2 font-medium">Department / role</th>
                    <th className="px-3 py-2 font-medium text-right">Openings</th>
                    <th className="px-3 py-2 font-medium text-right">Applicants</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-5 py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((req) => (
                    <tr key={req.id} className="border-b border-base last:border-0 align-top">
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => setViewing(req)}
                          className="font-medium text-primary hover:text-accent-600 text-left"
                        >
                          {req.title}
                        </button>
                        <div className="text-xs text-muted mt-0.5">
                          {req.referenceNumber}
                          {req.requestedByName && ` · Requested by ${req.requestedByName}`}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-secondary">
                        <div>{req.departmentName ?? '—'}</div>
                        <div className="text-xs text-muted">
                          {[req.designationName, req.jobLevelName, req.employmentTypeName, req.locationName]
                            .filter(Boolean)
                            .join(' · ') || 'No role details'}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{req.headcount}</td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {(req.applicationCount ?? 0) > 0 ? (
                          <button
                            type="button"
                            className="text-accent-600 hover:underline"
                            onClick={() => openPipeline(req.id)}
                          >
                            {req.applicationCount}
                          </button>
                        ) : (
                          <span className="text-muted">0</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <Badge tone={REQUISITION_STATUS_TONE[req.status]} dot>
                            {req.displayStatus}
                          </Badge>
                          {req.posting && (
                            <span className="text-xs text-muted flex items-center gap-1">
                              <Megaphone className="h-3 w-3" /> Posting {req.posting.displayStatus.toLowerCase()}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">{renderActions(req, 'row')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <RequisitionFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        companyId={companyId}
        lookups={lookups}
        requisition={editing}
        onSaved={(record) => {
          replaceRecord(record);
          setFormOpen(false);
          setNotice(
            editing
              ? `${record.referenceNumber} updated.`
              : `${record.referenceNumber} created as a draft. Submit it for approval when ready.`,
          );
        }}
      />

      <Modal
        open={viewing != null}
        onClose={() => setViewing(null)}
        size="lg"
        title={viewing ? `${viewing.referenceNumber} · ${viewing.title}` : ''}
      >
        {viewing && (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={REQUISITION_STATUS_TONE[viewing.status]} dot>
                {viewing.displayStatus}
              </Badge>
              <span className="text-xs text-muted flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> {viewing.headcount} opening
                {viewing.headcount === 1 ? '' : 's'} · {viewing.applicationCount ?? 0} applicant
                {(viewing.applicationCount ?? 0) === 1 ? '' : 's'}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              {(
                [
                  ['Department', viewing.departmentName],
                  ['Designation', viewing.designationName],
                  ['Job level', viewing.jobLevelName],
                  ['Employment type', viewing.employmentTypeName],
                  ['Location', viewing.locationName],
                  ['Requested by', viewing.requestedByName],
                  ['Opened', viewing.openedAt && new Date(viewing.openedAt).toLocaleDateString()],
                  ['Closed', viewing.closedAt && new Date(viewing.closedAt).toLocaleDateString()],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted uppercase tracking-wide">{label}</dt>
                  <dd className="text-primary">{value || '—'}</dd>
                </div>
              ))}
            </dl>
            <div>
              <div className="text-xs text-muted uppercase tracking-wide mb-1">Description</div>
              <p className="text-secondary whitespace-pre-wrap">{viewing.description}</p>
            </div>
            {viewing.workflow && (
              <div>
                <div className="text-xs text-muted uppercase tracking-wide mb-2">Approval</div>
                <ol className="space-y-2">
                  {viewing.workflow.steps.map((step) => (
                    <li key={step.order} className="flex items-start gap-3">
                      <Badge
                        tone={
                          step.status === 'approved'
                            ? 'success'
                            : step.status === 'rejected'
                              ? 'error'
                              : step.status === 'pending'
                                ? 'warning'
                                : 'neutral'
                        }
                      >
                        {step.status}
                      </Badge>
                      <div>
                        <div className="text-primary">
                          Step {step.order}: {step.roleName}
                        </div>
                        {step.actedAt && (
                          <div className="text-xs text-muted">
                            {new Date(step.actedAt).toLocaleString()}
                          </div>
                        )}
                        {step.comment && (
                          <div className="text-xs text-secondary mt-0.5">“{step.comment}”</div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <div className="pt-3 border-t border-base">{renderActions(viewing, 'detail')}</div>
          </div>
        )}
      </Modal>

      <Modal
        open={decision != null}
        onClose={() => setDecision(null)}
        title={
          decision
            ? `${decision.mode === 'approve' ? 'Approve' : 'Reject'} ${decision.requisition.referenceNumber}`
            : ''
        }
        description={decision?.requisition.title}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDecision(null)}>
              Cancel
            </Button>
            <Button
              variant={decision?.mode === 'reject' ? 'danger' : 'primary'}
              disabled={busyId != null}
              onClick={() => void submitDecision()}
            >
              {busyId != null && <Loader2 className="h-4 w-4 animate-spin" />}
              {decision?.mode === 'reject' ? 'Reject requisition' : 'Approve'}
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          {decisionError && (
            <div className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-700">
              {decisionError}
            </div>
          )}
          <Label htmlFor="req-decision-comment">
            {decision?.mode === 'reject' ? 'Reason (required)' : 'Comment (optional)'}
          </Label>
          <Textarea
            id="req-decision-comment"
            rows={3}
            value={decisionComment}
            onChange={(e) => setDecisionComment(e.target.value)}
          />
          {decision?.mode === 'reject' && (
            <p className="text-xs text-muted">
              Rejected requisitions are cancelled; the requester must raise a new one.
            </p>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={closing != null}
        title={closing ? `Close ${closing.referenceNumber}?` : ''}
        description={
          <>
            New applications will be blocked. Candidates already in the pipeline stay where
            they are, and you can reopen the requisition later.
          </>
        }
        confirmLabel="Close requisition"
        tone="primary"
        onClose={() => setClosing(null)}
        onConfirm={async () => {
          if (!closing) return;
          const record = await closeJobRequisition(closing.id);
          replaceRecord(record);
          setNotice(`${record.referenceNumber} closed.`);
        }}
      />
    </div>
  );
}

export function JobRequisitionsPage() {
  return (
    <OrgPageState>
      {(companyId) => (
        <>
          <div className="px-4 lg:px-6 pt-4">
            <CompanySelector />
          </div>
          <RequisitionsContent key={companyId} companyId={companyId} />
        </>
      )}
    </OrgPageState>
  );
}