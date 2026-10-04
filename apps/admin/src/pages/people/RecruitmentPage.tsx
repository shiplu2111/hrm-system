import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  Loader2,
  Plus,
  Search,
  Star,
  UserPlus,
} from 'lucide-react';
import {
  APPLICATION_CLOSED_STAGES,
  APPLICATION_PIPELINE_STAGES,
  type ApplicationStage,
  type JobApplicationRecord,
  type JobRequisitionRecord,
} from '@hrm/shared-types';
import { PermissionGate, usePermissions } from '@hrm/portal-ui';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, Select } from '@/components/ui/Form';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgPageState } from '@/components/org/OrgPageState';
import { AddCandidateModal } from '@/components/recruitment/AddCandidateModal';
import { CandidateAvatar } from '@/components/recruitment/CandidateAvatar';
import {
  MANUAL_STAGES,
  STAGE_META,
  canMoveApplication,
  formatRelativeDays,
} from '@/components/recruitment/recruitment-ui';
import { pathForPage } from '@/config/routes';
import { useNav } from '@/context/NavContext';
import {
  listJobApplications,
  listJobRequisitions,
  updateApplicationStage,
} from '@/lib/recruitment-api';
import { ApiError } from '@/lib/tenant-api-client';

function stageMoveHint(target: ApplicationStage): string {
  return target === 'hired'
    ? 'Hire from the candidate page once the offer is accepted'
    : 'Drop here';
}

function KanbanCard({
  application,
  showRequisition,
  canEdit,
  pending,
  dragging,
  onOpen,
  onMove,
  onDragStart,
  onDragEnd,
}: {
  application: JobApplicationRecord;
  showRequisition: boolean;
  canEdit: boolean;
  pending: boolean;
  dragging: boolean;
  onOpen: () => void;
  onMove: (stage: ApplicationStage) => void;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}) {
  const name = application.candidateName ?? 'Candidate';
  const locked = application.stage === 'hired' || application.hiredEmployeeId != null;
  const draggable = canEdit && !locked && !pending;

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`surface rounded-lg border shadow-card p-3 transition-all ${
        draggable ? 'cursor-grab active:cursor-grabbing' : ''
      } ${dragging ? 'opacity-40' : 'hover:shadow-card-hover'} ${pending ? 'opacity-70' : ''}`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left flex items-start gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 rounded"
      >
        <CandidateAvatar name={name} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-primary truncate">{name}</div>
          <div className="text-xs text-secondary truncate">
            {showRequisition ? application.requisitionTitle : application.candidateEmail}
          </div>
        </div>
        {application.rating != null && application.rating > 0 && (
          <span className="flex items-center gap-0.5 text-xs text-muted shrink-0">
            <Star className="h-3 w-3 text-warning-500 fill-warning-500" />
            {application.rating}
          </span>
        )}
      </button>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" /> in stage {formatRelativeDays(application.stageUpdatedAt)}
        </span>
        <span className="flex items-center gap-1">
          <FileText className="h-3 w-3" />
          {application.resume ? 'CV' : 'No CV'}
        </span>
        {application.yearsExperience != null && <span>{application.yearsExperience} yrs</span>}
      </div>
      {canEdit && !locked && (
        <div className="mt-2.5 flex items-center gap-2">
          <Select
            aria-label={`Move ${name} to stage`}
            className="h-7 text-xs py-0"
            value={application.stage}
            disabled={pending}
            onChange={(e) => onMove(e.target.value as ApplicationStage)}
          >
            {MANUAL_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {STAGE_META[stage].label}
              </option>
            ))}
          </Select>
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-secondary shrink-0" />}
        </div>
      )}
      {locked && (
        <div className="mt-2 text-[11px] text-success-700 dark:text-success-400 flex items-center gap-1">
          <UserPlus className="h-3 w-3" /> Converted to employee
        </div>
      )}
    </div>
  );
}

function PipelineContent({ companyId }: { companyId: string }) {
  const { openApplication } = useNav();
  const routerNavigate = useNavigate();
  const { can } = usePermissions();
  const canEdit = can('recruitment', 'edit');
  const [searchParams, setSearchParams] = useSearchParams();
  const requisitionFilter = searchParams.get('requisition') ?? 'all';

  const [applications, setApplications] = useState<JobApplicationRecord[]>([]);
  const [requisitions, setRequisitions] = useState<JobRequisitionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning'; text: string } | null>(
    null,
  );
  const [search, setSearch] = useState('');
  const [showClosed, setShowClosed] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<ApplicationStage | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [appRows, reqRows] = await Promise.all([
        listJobApplications(companyId),
        listJobRequisitions(companyId),
      ]);
      setApplications(appRows);
      setRequisitions(reqRows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load the pipeline');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const setRequisitionFilter = useCallback(
    (value: string) => {
      setSearchParams(
        (params) => {
          const next = new URLSearchParams(params);
          if (value === 'all') next.delete('requisition');
          else next.set('requisition', value);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (
      !loading &&
      requisitionFilter !== 'all' &&
      !requisitions.some((r) => r.id === requisitionFilter)
    ) {
      setRequisitionFilter('all');
    }
  }, [loading, requisitionFilter, requisitions, setRequisitionFilter]);

  const openRequisitions = useMemo(
    () => requisitions.filter((r) => r.status === 'open'),
    [requisitions],
  );
  const selectedRequisition = requisitions.find((r) => r.id === requisitionFilter) ?? null;

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return applications.filter((a) => {
      if (requisitionFilter !== 'all' && a.requisitionId !== requisitionFilter) return false;
      if (!term) return true;
      return (
        (a.candidateName ?? '').toLowerCase().includes(term) ||
        (a.candidateEmail ?? '').toLowerCase().includes(term)
      );
    });
  }, [applications, requisitionFilter, search]);

  const byStage = useMemo(() => {
    const groups = new Map<ApplicationStage, JobApplicationRecord[]>();
    for (const app of visible) {
      const list = groups.get(app.stage) ?? [];
      list.push(app);
      groups.set(app.stage, list);
    }
    return groups;
  }, [visible]);

  const closedCount = APPLICATION_CLOSED_STAGES.reduce(
    (sum, stage) => sum + (byStage.get(stage)?.length ?? 0),
    0,
  );
  const columns: readonly ApplicationStage[] = showClosed
    ? [...APPLICATION_PIPELINE_STAGES, ...APPLICATION_CLOSED_STAGES]
    : APPLICATION_PIPELINE_STAGES;

  const draggedApp = draggedId ? applications.find((a) => a.id === draggedId) ?? null : null;

  const moveApplication = async (application: JobApplicationRecord, target: ApplicationStage) => {
    if (!canMoveApplication(application, target)) return;
    const previous = application;
    setError(null);
    setNotice(null);
    setPendingIds((ids) => new Set(ids).add(application.id));
    setApplications((rows) =>
      rows.map((row) =>
        row.id === application.id
          ? {
              ...row,
              stage: target,
              displayStage: STAGE_META[target].label,
              stageUpdatedAt: new Date().toISOString(),
            }
          : row,
      ),
    );
    try {
      const saved = await updateApplicationStage(application.id, target);
      setApplications((rows) => rows.map((row) => (row.id === saved.id ? saved : row)));
      if (target === 'interview') {
        setNotice({
          tone: 'success',
          text: `${saved.candidateName} moved to Interview — interview rounds are ready to schedule.`,
        });
      } else if (target === 'offer') {
        setNotice({
          tone: 'success',
          text: `${saved.candidateName} moved to Offer. Open the candidate to prepare the offer letter.`,
        });
      }
    } catch (err) {
      setApplications((rows) => rows.map((row) => (row.id === previous.id ? previous : row)));
      setError(
        `Couldn't move ${previous.candidateName ?? 'candidate'}: ${
          err instanceof ApiError ? err.message : 'unexpected error'
        }`,
      );
    } finally {
      setPendingIds((ids) => {
        const next = new Set(ids);
        next.delete(application.id);
        return next;
      });
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>, stage: ApplicationStage) => {
    if (!draggedApp || !canMoveApplication(draggedApp, stage)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (dragOverStage !== stage) setDragOverStage(stage);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, stage: ApplicationStage) => {
    event.preventDefault();
    const app = draggedApp;
    setDraggedId(null);
    setDragOverStage(null);
    if (app) void moveApplication(app, stage);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-secondary">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading pipeline…
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Candidate Pipeline</h1>
          <p className="text-sm text-secondary mt-0.5">
            {visible.length} application{visible.length === 1 ? '' : 's'}
            {selectedRequisition
              ? ` for ${selectedRequisition.referenceNumber} · ${selectedRequisition.title}`
              : ` across ${openRequisitions.length} open requisition${
                  openRequisitions.length === 1 ? '' : 's'
                }`}
            {canEdit && ' · drag cards or use the stage menu to move candidates'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => routerNavigate(pathForPage('recruitment-requisitions'))}
          >
            <ClipboardList className="h-4 w-4" /> Requisitions
          </Button>
          <Button
            variant="secondary"
            onClick={() => routerNavigate(pathForPage('recruitment-interviews'))}
          >
            <CalendarDays className="h-4 w-4" /> Interviews
          </Button>
          <PermissionGate module="recruitment" action="create">
            <Button variant="primary" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Add candidate
            </Button>
          </PermissionGate>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-error-200 bg-error-50 dark:bg-error-950/30 px-4 py-3 text-sm text-error-700 dark:text-error-300 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}
      {notice && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm flex items-start gap-2 ${
            notice.tone === 'success'
              ? 'border-success-200 bg-success-50 text-success-700 dark:bg-success-950/30 dark:text-success-300'
              : 'border-warning-200 bg-warning-50 text-warning-800 dark:bg-warning-950/30 dark:text-warning-300'
          }`}
        >
          {notice.tone === 'success' ? (
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          )}
          {notice.text}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="relative lg:w-72">
          <Search className="h-4 w-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            aria-label="Search candidates"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email"
          />
        </div>
        <Select
          aria-label="Filter by requisition"
          className="lg:max-w-md"
          value={requisitionFilter}
          onChange={(e) => setRequisitionFilter(e.target.value)}
        >
          <option value="all">All requisitions</option>
          {requisitions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.referenceNumber} — {r.title}
              {r.status !== 'open' ? ` (${r.displayStatus})` : ''}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-sm text-secondary lg:ml-auto cursor-pointer select-none">
          <input
            type="checkbox"
            className="rounded border-base"
            checked={showClosed}
            onChange={(e) => setShowClosed(e.target.checked)}
          />
          Show rejected &amp; withdrawn ({closedCount})
        </label>
      </div>

      {applications.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="No candidates yet"
          description={
            openRequisitions.length > 0
              ? 'Add a candidate against an open requisition to start the pipeline.'
              : 'Open a requisition first, then add candidates to it.'
          }
          action={
            openRequisitions.length > 0 && can('recruitment', 'create')
              ? { label: 'Add candidate', icon: Plus, onClick: () => setAddOpen(true) }
              : {
                  label: 'Go to requisitions',
                  icon: ClipboardList,
                  onClick: () => routerNavigate(pathForPage('recruitment-requisitions')),
                }
          }
        />
      ) : (
        <div className="flex gap-3 overflow-x-auto scrollbar-thin pb-4" role="list">
          {columns.map((stage) => {
            const meta = STAGE_META[stage];
            const stageApps = byStage.get(stage) ?? [];
            const isTarget = dragOverStage === stage;
            const blocked = draggedApp != null && !canMoveApplication(draggedApp, stage) && draggedApp.stage !== stage;
            return (
              <div
                key={stage}
                role="listitem"
                aria-label={`${meta.label}: ${stageApps.length}`}
                className="flex flex-col w-72 shrink-0"
                onDragOver={(e) => handleDragOver(e, stage)}
                onDragLeave={() => setDragOverStage((s) => (s === stage ? null : s))}
                onDrop={(e) => handleDrop(e, stage)}
              >
                <div
                  className={`surface rounded-t-xl border border-b-0 ${meta.border} border-t-2 px-3 py-2.5 flex items-center justify-between`}
                >
                  <span className="text-sm font-semibold text-primary">{meta.label}</span>
                  <Badge tone="neutral">{stageApps.length}</Badge>
                </div>
                <div
                  className={`surface rounded-b-xl border border-t-0 p-2.5 space-y-2 min-h-[220px] flex-1 transition-colors ${
                    isTarget ? 'bg-accent-50 dark:bg-accent-950/30 ring-2 ring-inset ring-accent-400' : ''
                  } ${blocked ? 'opacity-60' : ''}`}
                >
                  {stageApps.map((app) => (
                    <KanbanCard
                      key={app.id}
                      application={app}
                      showRequisition={requisitionFilter === 'all'}
                      canEdit={canEdit}
                      pending={pendingIds.has(app.id)}
                      dragging={draggedId === app.id}
                      onOpen={() => openApplication(app.id)}
                      onMove={(target) => void moveApplication(app, target)}
                      onDragStart={(event) => {
                        event.dataTransfer.setData('text/plain', app.id);
                        event.dataTransfer.effectAllowed = 'move';
                        setDraggedId(app.id);
                      }}
                      onDragEnd={() => {
                        setDraggedId(null);
                        setDragOverStage(null);
                      }}
                    />
                  ))}
                  {stageApps.length === 0 && (
                    <div className="flex items-center justify-center text-center h-20 px-3 text-xs text-muted border-2 border-dashed border-base rounded-lg">
                      {draggedApp ? stageMoveHint(stage) : 'No candidates'}
                    </div>
                  )}
                  {stage === 'hired' && draggedApp && stageApps.length > 0 && (
                    <p className="text-[11px] text-muted text-center px-2">
                      {stageMoveHint('hired')}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AddCandidateModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        companyId={companyId}
        openRequisitions={openRequisitions}
        defaultRequisitionId={requisitionFilter === 'all' ? null : requisitionFilter}
        onAdded={({ application, reusedExistingCandidate, warning }) => {
          setAddOpen(false);
          setApplications((rows) => [application, ...rows]);
          setRequisitions((rows) =>
            rows.map((r) =>
              r.id === application.requisitionId
                ? { ...r, applicationCount: (r.applicationCount ?? 0) + 1 }
                : r,
            ),
          );
          setNotice(
            warning
              ? { tone: 'warning', text: warning }
              : {
                  tone: 'success',
                  text: reusedExistingCandidate
                    ? `${application.candidateName} already had a profile — added a new application to it.`
                    : `${application.candidateName} added to Applied.`,
                },
          );
        }}
      />
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
          <PipelineContent key={companyId} companyId={companyId} />
        </>
      )}
    </OrgPageState>
  );
}
