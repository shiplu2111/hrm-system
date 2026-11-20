import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  FileLock2,
  FileText,
  FileWarning,
  Filter,
  History,
  Info,
  Loader2,
  LockKeyhole,
  MessageSquarePlus,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { usePermissions } from '@hrm/portal-ui';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Toggle } from '@/components/ui/Toggle';
import { useCompany } from '@/context/CompanyContext';
import {
  CASE_OUTCOME_LABELS,
  CASE_PRIORITY_LABELS,
  CASE_STATUS_LABELS,
  CASE_TYPE_LABELS,
  DISCIPLINARY_ACTION_LABELS,
  HR_CASE_NEXT_STATUSES,
  INVESTIGATION_RECORD_LABELS,
  addDisciplinaryAction,
  addHrCaseNote,
  addInvestigationRecord,
  createHrCase,
  getEmployeeRelationsSummary,
  getHrCase,
  getHrCaseAuditLogs,
  listHrCases,
  revealHrCaseField,
  transitionHrCaseStatus,
  updateHrCase,
} from '@/lib/employee-relations-api';
import { ApiError } from '@/lib/tenant-api-client';
import type {
  AuditLogEntry,
  DisciplinaryActionType,
  HrCaseDetailRecord,
  HrCaseOutcome,
  HrCasePriority,
  HrCaseStatus,
  HrCaseSummary,
  HrCaseSummaryRecord,
  HrCaseType,
  HrInvestigationRecordType,
} from '@hrm/shared-types';

const statusTone: Record<HrCaseStatus, 'accent' | 'warning' | 'error' | 'success'> = {
  open: 'accent',
  investigating: 'warning',
  resolved: 'success',
  closed: 'success',
};

const priorityTone: Record<HrCasePriority, 'neutral' | 'info' | 'warning' | 'error'> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  critical: 'error',
};

const disciplinaryTone: Record<DisciplinaryActionType, 'neutral' | 'warning' | 'error' | 'accent'> = {
  verbal_warning: 'warning',
  written_warning: 'accent',
  final_warning: 'error',
  suspension: 'error',
  termination: 'error',
  other: 'neutral',
};

const STATUS_STEPS: HrCaseStatus[] = ['open', 'investigating', 'resolved', 'closed'];

function formatUpdated(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const TYPE_FILTER_MAP: Record<string, HrCaseType | undefined> = {
  All: undefined,
  Grievance: 'grievance',
  Complaint: 'complaint',
  Disciplinary: 'disciplinary',
  Investigation: 'investigation',
};

export function EmployeeRelationsPage() {
  const { companyId } = useCompany();
  const { can } = usePermissions();
  const canCreate = can('employee_relations', 'create');
  const canEdit = can('employee_relations', 'edit');
  const canViewAudit = can('audit', 'view');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<HrCaseSummary | null>(null);
  const [cases, setCases] = useState<HrCaseSummaryRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<HrCaseDetailRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [anonymized, setAnonymized] = useState(true);
  const [detailTab, setDetailTab] = useState<
    'activity' | 'investigation' | 'disciplinary' | 'parties' | 'audit'
  >('activity');

  // Case resolution & outcome state
  const [resolution, setResolution] = useState('');
  const [outcome, setOutcome] = useState<HrCaseOutcome>('not_determined');
  const [saved, setSaved] = useState(false);

  // Status transition modal state
  const [transitionModal, setTransitionModal] = useState(false);
  const [targetStatus, setTargetStatus] = useState<HrCaseStatus | null>(null);
  const [transitionReason, setTransitionReason] = useState('');
  const [transitionOutcome, setTransitionOutcome] = useState<HrCaseOutcome>('not_determined');
  const [transitionNotes, setTransitionNotes] = useState('');

  // Quick note state
  const [note, setNote] = useState('');

  // Revealed fields states (audited)
  const [revealedDetails, setRevealedDetails] = useState<string | null>(null);
  const [revealedNotes, setRevealedNotes] = useState<Record<string, string>>({});
  const [revealedInvestigations, setRevealedInvestigations] = useState<Record<string, string>>({});
  const [revealedActions, setRevealedActions] = useState<Record<string, string>>({});

  // Disciplinary action modal state
  const [discModal, setDiscModal] = useState(false);
  const [discType, setDiscType] = useState<DisciplinaryActionType>('written_warning');
  const [discEffectiveDate, setDiscEffectiveDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [discLetterRef, setDiscLetterRef] = useState('');
  const [discDetails, setDiscDetails] = useState('');

  // Investigation record modal state
  const [invModal, setInvModal] = useState(false);
  const [invTitle, setInvTitle] = useState('');
  const [invType, setInvType] = useState<HrInvestigationRecordType>('interview');
  const [invContent, setInvContent] = useState('');
  const [invDate, setInvDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Audit trail state
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);

  // Common UI states
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Create Case modal state
  const [createModal, setCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<HrCaseType>('grievance');
  const [newPriority, setNewPriority] = useState<HrCasePriority>('medium');
  const [newDetails, setNewDetails] = useState('');

  const loadList = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [summaryRow, caseRows] = await Promise.all([
        getEmployeeRelationsSummary(companyId),
        listHrCases(companyId, {
          search: query.trim() || undefined,
          caseType: TYPE_FILTER_MAP[typeFilter],
        }),
      ]);
      setSummary(summaryRow);
      setCases(caseRows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load employee relations data');
    } finally {
      setLoading(false);
    }
  }, [companyId, query, typeFilter]);

  const loadAuditLogs = useCallback(async (caseId: string) => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const logs = await getHrCaseAuditLogs(caseId);
      setAuditLogs(logs);
    } catch (err) {
      setAuditError(err instanceof ApiError ? err.message : 'Failed to load case audit trail');
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (caseId: string) => {
    setDetailLoading(true);
    setFormError(null);
    setRevealedDetails(null);
    setRevealedNotes({});
    setRevealedInvestigations({});
    setRevealedActions({});
    try {
      const detail = await getHrCase(caseId);
      setSelected(detail);
      setOutcome(detail.outcome);
      setResolution('');
      void loadAuditLogs(caseId);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to load case detail');
      setSelected(null);
      setSelectedId(null);
    } finally {
      setDetailLoading(false);
    }
  }, [loadAuditLogs]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setSelected(null);
  }, [selectedId, loadDetail]);

  const filteredCases = cases;

  // Reveal handlers (audited under AUDIT_LOG.md)
  const handleRevealDetails = async () => {
    if (!selected) return;
    try {
      const result = await revealHrCaseField(selected.id, { field: 'details' });
      setRevealedDetails(result.value);
      void loadAuditLogs(selected.id);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Reveal failed');
    }
  };

  const handleRevealNote = async (noteId: string) => {
    if (!selected) return;
    try {
      const result = await revealHrCaseField(selected.id, {
        field: 'noteContent',
        noteId,
      });
      setRevealedNotes((current) => ({ ...current, [noteId]: result.value }));
      void loadAuditLogs(selected.id);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Reveal failed');
    }
  };

  const handleRevealInvestigation = async (recordId: string) => {
    if (!selected) return;
    try {
      const result = await revealHrCaseField(selected.id, {
        field: 'investigationContent',
        investigationRecordId: recordId,
      });
      setRevealedInvestigations((current) => ({ ...current, [recordId]: result.value }));
      void loadAuditLogs(selected.id);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Reveal failed');
    }
  };

  const handleRevealDisciplinaryAction = async (actionId: string) => {
    if (!selected) return;
    try {
      const result = await revealHrCaseField(selected.id, {
        field: 'actionDetails',
        actionId,
      });
      setRevealedActions((current) => ({ ...current, [actionId]: result.value }));
      void loadAuditLogs(selected.id);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Reveal failed');
    }
  };

  // Status transition flow
  const openTransitionModal = (nextStatus: HrCaseStatus) => {
    setTargetStatus(nextStatus);
    setTransitionReason('');
    setTransitionOutcome(selected?.outcome ?? 'not_determined');
    setTransitionNotes('');
    setTransitionModal(true);
  };

  const handleExecuteTransition = async () => {
    if (!selected || !targetStatus) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const updated = await transitionHrCaseStatus(selected.id, {
        status: targetStatus,
        reason: transitionReason.trim() || undefined,
      });

      if (
        (targetStatus === 'resolved' || targetStatus === 'closed') &&
        (transitionOutcome !== 'not_determined' || transitionNotes.trim())
      ) {
        await updateHrCase(selected.id, {
          outcome: transitionOutcome,
          resolutionNotes: transitionNotes.trim() || undefined,
        });
      }

      setTransitionModal(false);
      setTransitionReason('');
      await loadDetail(selected.id);
      await loadList();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Status transition failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Disciplinary action addition
  const handleAddDisciplinary = async () => {
    if (!selected || !discEffectiveDate) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await addDisciplinaryAction(selected.id, {
        actionType: discType,
        effectiveDate: discEffectiveDate,
        letterReference: discLetterRef.trim() || undefined,
        details: discDetails.trim() || undefined,
      });
      setDiscModal(false);
      setDiscLetterRef('');
      setDiscDetails('');
      await loadDetail(selected.id);
      await loadAuditLogs(selected.id);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to add disciplinary action');
    } finally {
      setSubmitting(false);
    }
  };

  // Investigation record addition
  const handleAddInvestigation = async () => {
    if (!selected || !invTitle.trim() || !invContent.trim()) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await addInvestigationRecord(selected.id, {
        recordType: invType,
        title: invTitle.trim(),
        content: invContent.trim(),
        recordedAt: invDate || undefined,
      });
      setInvModal(false);
      setInvTitle('');
      setInvContent('');
      await loadDetail(selected.id);
      await loadAuditLogs(selected.id);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to add investigation record');
    } finally {
      setSubmitting(false);
    }
  };

  // Resolution save
  const handleSaveResolution = async () => {
    if (!selected) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const updated = await updateHrCase(selected.id, {
        outcome,
        resolutionNotes: resolution.trim() || undefined,
      });
      setSelected(updated);
      setSaved(true);
      await loadList();
      await loadAuditLogs(selected.id);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to save resolution');
    } finally {
      setSubmitting(false);
    }
  };

  // Note addition
  const handleAddNote = async () => {
    if (!selected || !note.trim()) return;
    setSubmitting(true);
    try {
      await addHrCaseNote(selected.id, note.trim());
      setNote('');
      await loadDetail(selected.id);
      await loadAuditLogs(selected.id);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to add note');
    } finally {
      setSubmitting(false);
    }
  };

  // Case creation
  const handleCreateCase = async () => {
    if (!companyId || !newTitle.trim()) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const created = await createHrCase(companyId, {
        title: newTitle.trim(),
        caseType: newType,
        priority: newPriority,
        details: newDetails.trim() || undefined,
        isRestricted: true,
      });
      setCreateModal(false);
      setNewTitle('');
      setNewDetails('');
      await loadList();
      setSelectedId(created.id);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to create case');
    } finally {
      setSubmitting(false);
    }
  };

  if (!companyId) {
    return <div className="p-6 text-sm text-secondary">Select a company to manage employee relations.</div>;
  }

  // =========================================================================
  // CASE DETAIL VIEW
  // =========================================================================
  if (selectedId && (selected || detailLoading)) {
    if (detailLoading || !selected) {
      return (
        <div className="flex items-center justify-center p-12 text-secondary">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading confidential case…
        </div>
      );
    }

    const currentStepIndex = STATUS_STEPS.indexOf(selected.status);

    return (
      <div className="mx-auto max-w-[1400px] space-y-5 p-4 lg:p-6">
        {/* Navigation back */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="inline-flex items-center gap-2 text-sm font-medium text-secondary transition-colors hover:text-accent-600"
          >
            <ArrowLeft className="h-4 w-4" /> Back to confidential cases
          </button>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-base bg-[rgb(var(--bg-muted))] px-3 py-1 text-xs text-muted">
              <LockKeyhole className="h-3 w-3 text-amber-500" />
              Restricted Confidential Case · Gated by Case Access
            </span>
          </div>
        </div>

        {/* Security Warning Notice */}
        {selected.isRestricted && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-300/70 bg-amber-50/80 p-4 text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/25 dark:text-amber-200">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex-1 text-sm">
              <p className="font-semibold">Confidential Employee Relations Record</p>
              <p className="mt-0.5 text-xs opacity-90">
                Access is restricted to authorized officers holding the dedicated{' '}
                <code className="font-mono text-[11px] font-bold">employee_relations:view</code>{' '}
                permission per ROLES_PERMISSIONS.md. All views, status transitions, and narrative reveals are permanently logged to the audit trail per AUDIT_LOG.md.
              </p>
            </div>
          </div>
        )}

        {formError && (
          <div className="flex items-center gap-2 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Header Summary Card */}
        <section className="surface rounded-xl border border-base p-5 shadow-card">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <FileLock2 className="h-6 w-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-muted">{selected.caseNumber}</span>
                  <Badge tone={statusTone[selected.status]} dot>
                    {CASE_STATUS_LABELS[selected.status]}
                  </Badge>
                  <Badge tone={priorityTone[selected.priority]}>
                    {CASE_PRIORITY_LABELS[selected.priority]} priority
                  </Badge>
                  <Badge tone="neutral">
                    {CASE_TYPE_LABELS[selected.caseType]}
                  </Badge>
                </div>
                <h1 className="mt-2 text-xl font-bold text-primary">{selected.title}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-secondary">
                  {selected.hasDetails ? (
                    revealedDetails ? (
                      <div className="mt-1 rounded-lg border border-emerald-300/60 bg-emerald-50/70 p-3 text-emerald-950 dark:border-emerald-800/60 dark:bg-emerald-950/25 dark:text-emerald-200">
                        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                          <ShieldCheck className="h-3.5 w-3.5" /> Confidential Details (Decrypted · Reveal Audited)
                        </div>
                        <p className="mt-1 max-w-3xl whitespace-pre-wrap text-sm leading-relaxed">{revealedDetails}</p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="italic text-muted">Confidential case details masked for privacy</span>
                        <Button size="sm" variant="secondary" onClick={() => void handleRevealDetails()}>
                          <Eye className="h-4 w-4" /> Reveal details
                        </Button>
                      </div>
                    )
                  ) : (
                    <span className="text-muted">No detailed narrative recorded.</span>
                  )}
                </div>
              </div>
            </div>
            {canEdit && selected.status !== 'closed' && (
              <Button size="sm" onClick={() => setDetailTab('activity')}>
                <MessageSquarePlus className="h-4 w-4" /> Add note
              </Button>
            )}
          </div>
        </section>

        {/* Status Lifecycle Progress Stepper (Open → Investigating → Resolved → Closed) */}
        <section className="surface rounded-xl border border-base p-5 shadow-card">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-sm font-semibold text-primary">Case Lifecycle &amp; Status Flow</h2>
              <p className="text-xs text-muted">Open → Investigating → Resolved → Closed per MODULES.md §28</p>
            </div>
            <div className="flex items-center gap-2">
              {selected.closedAt && (
                <span className="text-xs text-muted">
                  Finalized on {formatUpdated(selected.closedAt)}
                </span>
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            {STATUS_STEPS.map((step, idx) => {
              const isCompleted = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;

              return (
                <div key={step} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all ${
                        isCompleted
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : isCurrent
                            ? 'border-2 border-accent-600 bg-accent-50 text-accent-700 ring-4 ring-accent-100 dark:bg-accent-950/40 dark:text-accent-300 dark:ring-accent-900/30'
                            : 'border border-base bg-[rgb(var(--bg-muted))] text-muted'
                      }`}
                    >
                      {isCompleted ? <Check className="h-4 w-4 stroke-[3]" /> : idx + 1}
                    </div>
                    <span
                      className={`mt-2 text-xs font-medium ${
                        isCurrent
                          ? 'font-bold text-accent-700 dark:text-accent-300'
                          : isCompleted
                            ? 'font-medium text-primary'
                            : 'text-muted'
                      }`}
                    >
                      {CASE_STATUS_LABELS[step]}
                    </span>
                    {isCurrent && (
                      <span className="mt-0.5 text-[10px] font-semibold text-accent-600 uppercase tracking-wider">
                        Current
                      </span>
                    )}
                  </div>
                  {idx < STATUS_STEPS.length - 1 && (
                    <div
                      className={`mx-3 mb-6 h-0.5 flex-1 transition-colors ${
                        idx < currentStepIndex ? 'bg-emerald-600' : 'bg-[rgb(var(--border-base))]'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Status Action Controls */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-base pt-4">
            <div className="text-xs text-secondary">
              {selected.status === 'closed' ? (
                <span className="flex items-center gap-1.5 font-medium text-muted">
                  <LockKeyhole className="h-3.5 w-3.5 text-muted" />
                  This case is closed and locked. Closed cases cannot be modified.
                </span>
              ) : (
                <span>
                  Allowed transitions:{' '}
                  <strong>
                    {HR_CASE_NEXT_STATUSES[selected.status].map((s) => CASE_STATUS_LABELS[s]).join(', ') || 'None'}
                  </strong>
                </span>
              )}
            </div>

            {canEdit && HR_CASE_NEXT_STATUSES[selected.status].length > 0 && (
              <div className="flex flex-wrap gap-2">
                {HR_CASE_NEXT_STATUSES[selected.status].map((next) => (
                  <Button
                    key={next}
                    size="sm"
                    variant={next === 'closed' ? 'secondary' : 'primary'}
                    disabled={submitting}
                    onClick={() => openTransitionModal(next)}
                  >
                    Move to {CASE_STATUS_LABELS[next]}…
                  </Button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Main Content Layout (Tabs + Sidebar) */}
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="surface overflow-hidden rounded-xl border border-base shadow-card">
            {/* Tab navigation */}
            <div className="flex overflow-x-auto border-b border-base px-4">
              {(
                [
                  ['activity', 'Timeline & notes'],
                  ['investigation', `Investigation (${selected.investigationRecords.length})`],
                  ['disciplinary', `Disciplinary actions (${selected.disciplinaryActions.length})`],
                  ['parties', `Involved parties (${selected.parties.length})`],
                  ['audit', `Audit trail (${auditLogs.length})`],
                ] as const
              ).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setDetailTab(tab)}
                  className={`border-b-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                    detailTab === tab
                      ? 'border-accent-500 text-accent-600 dark:text-accent-400 font-semibold'
                      : 'border-transparent text-secondary hover:text-primary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* TAB 1: Activity & Notes */}
            {detailTab === 'activity' && (
              <div className="p-5">
                {canEdit && selected.status !== 'closed' && (
                  <div className="mb-6 rounded-lg border border-base bg-[rgb(var(--bg-muted))] p-3">
                    <Textarea
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      rows={3}
                      placeholder="Add an encrypted confidential case note…"
                      className="bg-transparent"
                    />
                    <div className="mt-2 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                        <LockKeyhole className="h-3 w-3" /> Encrypted at rest · reveal audited
                      </span>
                      <Button size="sm" onClick={() => void handleAddNote()} disabled={!note.trim() || submitting}>
                        Save note
                      </Button>
                    </div>
                  </div>
                )}
                <div className="space-y-0">
                  {selected.notes.map((item) => (
                    <TimelineItem
                      key={item.id}
                      date={formatUpdated(item.createdAt)}
                      title="Confidential note"
                      by="HR case officer"
                      detail={
                        revealedNotes[item.id] ? (
                          <div className="rounded-lg border border-emerald-300/60 bg-emerald-50/70 p-3 text-emerald-950 dark:border-emerald-800/60 dark:bg-emerald-950/25 dark:text-emerald-200">
                            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                              <ShieldCheck className="h-3.5 w-3.5" /> Decrypted Note (Audited)
                            </div>
                            <p className="mt-1 whitespace-pre-wrap text-sm">{revealedNotes[item.id]}</p>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 text-accent-600 hover:underline font-medium text-xs"
                            onClick={() => void handleRevealNote(item.id)}
                          >
                            <Eye className="h-3.5 w-3.5" /> Reveal confidential note
                          </button>
                        )
                      }
                    />
                  ))}
                  {!selected.notes.length && (
                    <p className="py-6 text-center text-sm text-muted">No case notes recorded yet.</p>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: Investigation Records */}
            {detailTab === 'investigation' && (
              <div className="p-5">
                <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="text-sm font-semibold text-primary">Investigation Records</h3>
                    <p className="text-xs text-muted">
                      Witness interviews, evidence reviews, investigation findings, and legal opinions.
                    </p>
                  </div>
                  {canEdit && selected.status !== 'closed' && (
                    <Button size="sm" onClick={() => setInvModal(true)}>
                      <Plus className="h-4 w-4" /> Add investigation record
                    </Button>
                  )}
                </div>

                <div className="space-y-4">
                  {selected.investigationRecords.map((record) => (
                    <div
                      key={record.id}
                      className="rounded-xl border border-base bg-[rgb(var(--bg-muted))] p-4 transition-all"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge tone="info">
                            {INVESTIGATION_RECORD_LABELS[record.recordType]}
                          </Badge>
                          <span className="font-semibold text-primary">{record.title}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Recorded: {record.recordedAt}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3">
                        {revealedInvestigations[record.id] ? (
                          <div className="rounded-lg border border-emerald-300/60 bg-emerald-50/70 p-3 text-emerald-950 dark:border-emerald-800/60 dark:bg-emerald-950/25 dark:text-emerald-200">
                            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                              <ShieldCheck className="h-3.5 w-3.5" /> Decrypted Content (Reveal Audited)
                            </div>
                            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                              {revealedInvestigations[record.id]}
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between rounded-lg border border-dashed border-base bg-[rgb(var(--bg-base))] px-3 py-2 text-xs">
                            <span className="flex items-center gap-1.5 text-muted">
                              <LockKeyhole className="h-3.5 w-3.5" />
                              Encrypted confidential investigation content
                            </span>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => void handleRevealInvestigation(record.id)}
                            >
                              <Eye className="h-3.5 w-3.5" /> Reveal content
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {!selected.investigationRecords.length && (
                    <div className="py-10 text-center text-sm text-muted">
                      No investigation records filed for this case yet.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: Disciplinary Actions (Verbal/Written Warning, etc.) */}
            {detailTab === 'disciplinary' && (
              <div className="p-5">
                <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="text-sm font-semibold text-primary">Disciplinary Actions</h3>
                    <p className="text-xs text-muted">
                      Track verbal/written warnings, suspension, and statutory actions per MODULES.md §28.
                    </p>
                  </div>
                  {canEdit && selected.status !== 'closed' && (
                    <Button size="sm" onClick={() => setDiscModal(true)}>
                      <Plus className="h-4 w-4" /> Issue disciplinary action
                    </Button>
                  )}
                </div>

                <div className="space-y-4">
                  {selected.disciplinaryActions.map((action) => (
                    <div
                      key={action.id}
                      className="rounded-xl border border-base bg-[rgb(var(--bg-muted))] p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 rounded-lg bg-amber-100 p-2 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                            <FileWarning className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge tone={disciplinaryTone[action.actionType]}>
                                {DISCIPLINARY_ACTION_LABELS[action.actionType]}
                              </Badge>
                              {action.letterReference && (
                                <span className="font-mono text-xs font-semibold text-secondary">
                                  Ref: {action.letterReference}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-muted">
                              Effective date: <strong>{action.effectiveDate}</strong> · Recorded {formatUpdated(action.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Disciplinary Narrative / Details */}
                      <div className="mt-3">
                        {action.detailsRestricted ? (
                          revealedActions[action.id] ? (
                            <div className="rounded-lg border border-emerald-300/60 bg-emerald-50/70 p-3 text-emerald-950 dark:border-emerald-800/60 dark:bg-emerald-950/25 dark:text-emerald-200">
                              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                                <ShieldCheck className="h-3.5 w-3.5" /> Confidential Action Narrative (Decrypted)
                              </div>
                              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                                {revealedActions[action.id]}
                              </p>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between rounded-lg border border-dashed border-base bg-[rgb(var(--bg-base))] px-3 py-2 text-xs">
                              <span className="flex items-center gap-1.5 text-muted">
                                <LockKeyhole className="h-3.5 w-3.5" />
                                Confidential warning details &amp; terms masked
                              </span>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => void handleRevealDisciplinaryAction(action.id)}
                              >
                                <Eye className="h-3.5 w-3.5" /> Reveal details
                              </Button>
                            </div>
                          )
                        ) : (
                          <p className="text-xs italic text-muted">No written narrative attached to this record.</p>
                        )}
                      </div>
                    </div>
                  ))}

                  {!selected.disciplinaryActions.length && (
                    <div className="py-10 text-center text-sm text-muted">
                      No disciplinary action records linked to this case.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: Involved Parties */}
            {detailTab === 'parties' && (
              <div className="p-5">
                <div className="mb-4 flex items-center justify-between rounded-lg bg-[rgb(var(--bg-muted))] p-3">
                  <div>
                    <p className="text-sm font-medium text-primary">Anonymize identities</p>
                    <p className="text-xs text-muted">Mask names during multi-stakeholder case reviews.</p>
                  </div>
                  <Toggle checked={anonymized} onChange={setAnonymized} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {selected.parties.map((party, index) => (
                    <div key={party.id} className="flex items-center gap-3 rounded-lg border border-base p-4">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800">
                        <UserRound className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                          {party.partyRole.replace(/_/g, ' ')}
                        </p>
                        <p className="text-sm font-semibold text-primary">
                          {anonymized && party.isAnonymized
                            ? (party.anonymizedLabel ?? `Protected identity ${String.fromCharCode(65 + index)}`)
                            : (party.employeeName ?? party.anonymizedLabel ?? 'Unknown')}
                        </p>
                        <p className="text-xs text-secondary">
                          {anonymized && party.isAnonymized ? 'Department hidden' : (party.departmentName ?? '—')}
                        </p>
                      </div>
                    </div>
                  ))}
                  {!selected.parties.length && (
                    <p className="text-sm text-muted sm:col-span-2">No parties linked.</p>
                  )}
                </div>
              </div>
            )}

            {/* TAB 5: Audit Trail (AUDIT_LOG.md) */}
            {detailTab === 'audit' && (
              <div className="p-5">
                <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-primary">Immutable Audit Trail</h3>
                      <Badge tone="success" dot>
                        Append-Only (AUDIT_LOG.md)
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      Every creation, status transition, disciplinary warning, note, and confidential reveal is immutably logged.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void loadAuditLogs(selected.id)}
                      disabled={auditLoading}
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${auditLoading ? 'animate-spin' : ''}`} /> Refresh
                    </Button>
                    {canViewAudit && (
                      <a
                        href={`/settings/audit-log?recordId=${selected.id}&module=employee_relations`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-accent-600 hover:underline"
                      >
                        Global audit viewer <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>

                {auditError && (
                  <div className="mb-4 rounded-lg border border-danger-200 bg-danger-50 p-3 text-xs text-danger-700">
                    {auditError}
                  </div>
                )}

                {auditLoading && auditLogs.length === 0 ? (
                  <div className="flex items-center justify-center p-8 text-secondary">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading audit trail…
                  </div>
                ) : (
                  <div className="space-y-3">
                    {auditLogs.map((entry) => {
                      const isExpanded = expandedAuditId === entry.id;
                      const hasPayload = Boolean(entry.oldValue || entry.newValue);

                      // Helper to parse human-friendly description
                      let description = 'Case record updated';
                      let actionTone: 'accent' | 'warning' | 'error' | 'success' | 'neutral' = 'neutral';

                      if (entry.newValue?.statusTransition) {
                        description = `Status transitioned: ${entry.newValue.statusTransition}`;
                        if (entry.newValue.reason) {
                          description += ` (Reason: ${entry.newValue.reason})`;
                        }
                        actionTone = 'accent';
                      } else if (entry.newValue?.sensitiveReveal) {
                        description = `Confidential field revealed: "${entry.newValue.field}" (Security audited)`;
                        actionTone = 'warning';
                      } else if (entry.newValue?.actionType) {
                        description = `Issued disciplinary action: ${
                          DISCIPLINARY_ACTION_LABELS[entry.newValue.actionType as DisciplinaryActionType] ||
                          entry.newValue.actionType
                        } (Effective: ${entry.newValue.effectiveDate})`;
                        actionTone = 'error';
                      } else if (entry.newValue?.investigationRecordId) {
                        description = `Added investigation record: ${entry.newValue.title} (${
                          INVESTIGATION_RECORD_LABELS[entry.newValue.recordType as HrInvestigationRecordType] ||
                          'Record'
                        })`;
                        actionTone = 'info' as any;
                      } else if (entry.newValue?.noteAdded) {
                        description = 'Added confidential case note';
                        actionTone = 'neutral';
                      } else if (entry.newValue?.partiesUpdated) {
                        description = `Updated case parties (${entry.newValue.partiesUpdated} parties)`;
                        actionTone = 'neutral';
                      } else if (entry.action === 'create') {
                        description = 'Created confidential HR case';
                        actionTone = 'success';
                      }

                      return (
                        <div
                          key={entry.id}
                          className="rounded-xl border border-base bg-[rgb(var(--bg-muted))] p-3.5 text-xs transition-colors"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Badge tone={actionTone as any}>
                                {entry.action.toUpperCase()}
                              </Badge>
                              <span className="font-semibold text-primary">{description}</span>
                            </div>
                            <span className="font-mono text-[11px] text-muted">
                              {formatUpdated(entry.createdAt)}
                            </span>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-secondary">
                            <div className="flex items-center gap-2">
                              <span>Actor:</span>
                              <span className="font-medium text-primary">
                                {entry.actor.name
                                  ? `${entry.actor.name} (${entry.actor.email})`
                                  : (entry.actor.email ?? entry.actor.id)}
                              </span>
                            </div>

                            {hasPayload && (
                              <button
                                type="button"
                                onClick={() => setExpandedAuditId(isExpanded ? null : entry.id)}
                                className="inline-flex items-center gap-1 text-accent-600 hover:underline"
                              >
                                {isExpanded ? 'Hide raw diff' : 'Inspect payload diff'}
                                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </button>
                            )}
                          </div>

                          {/* Raw Diff Accordion */}
                          {isExpanded && (
                            <div className="mt-3 rounded-lg border border-base bg-[rgb(var(--bg-base))] p-3">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                  <p className="mb-1 font-semibold text-muted uppercase tracking-wider text-[10px]">
                                    Old Value (Before)
                                  </p>
                                  <pre className="max-h-48 overflow-auto rounded bg-[rgb(var(--bg-muted))] p-2 font-mono text-[11px] text-primary">
                                    {entry.oldValue
                                      ? JSON.stringify(entry.oldValue, null, 2)
                                      : 'null (Initial record)'}
                                  </pre>
                                </div>
                                <div>
                                  <p className="mb-1 font-semibold text-muted uppercase tracking-wider text-[10px]">
                                    New Value (After)
                                  </p>
                                  <pre className="max-h-48 overflow-auto rounded bg-[rgb(var(--bg-muted))] p-2 font-mono text-[11px] text-primary">
                                    {entry.newValue
                                      ? JSON.stringify(entry.newValue, null, 2)
                                      : 'null'}
                                  </pre>
                                </div>
                              </div>
                              <div className="mt-2 flex items-center justify-between border-t border-base pt-2 text-[10px] text-muted">
                                <span>Record ID: {entry.recordId}</span>
                                <span>Module: {entry.module}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {!auditLogs.length && (
                      <p className="py-8 text-center text-sm text-muted">No audit trail entries recorded.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Right Sidebar: Ownership, Metadata & Resolution */}
          <aside className="space-y-5">
            {/* Case Ownership Card */}
            <section className="surface rounded-xl border border-base p-5 shadow-card">
              <h2 className="text-sm font-semibold text-primary">Case Ownership &amp; Access</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <InfoRow label="Case type" value={CASE_TYPE_LABELS[selected.caseType]} />
                <InfoRow label="HR officer" value={selected.assignedOfficerName ?? 'Unassigned'} />
                <InfoRow label="Opened on" value={formatUpdated(selected.openedAt)} />
                <InfoRow label="Last updated" value={formatUpdated(selected.updatedAt)} />
                <InfoRow
                  label="Access gate"
                  value={
                    selected.isRestricted
                      ? 'Restricted (Case Access: employee_relations)'
                      : 'Assigned Case Officers'
                  }
                />
              </dl>
            </section>

            {/* Resolution & Outcome Card */}
            <section className="surface rounded-xl border border-base p-5 shadow-card">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-primary">Resolution &amp; Outcome</h2>
                {saved && (
                  <span className="inline-flex items-center gap-1 text-xs text-success-600">
                    <Check className="h-3.5 w-3.5" /> Saved
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted">
                Document case resolution findings and outcomes.
              </p>
              <div className="mt-4 space-y-4">
                <div>
                  <Label htmlFor="outcome">Formal Outcome</Label>
                  <Select
                    id="outcome"
                    value={outcome}
                    disabled={!canEdit || selected.status === 'closed'}
                    onChange={(event) => {
                      setOutcome(event.target.value as HrCaseOutcome);
                      setSaved(false);
                    }}
                  >
                    {Object.entries(CASE_OUTCOME_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="resolution">Confidential Resolution Notes</Label>
                  <Textarea
                    id="resolution"
                    value={resolution}
                    disabled={!canEdit || selected.status === 'closed'}
                    onChange={(event) => {
                      setResolution(event.target.value);
                      setSaved(false);
                    }}
                    rows={4}
                    placeholder="Document formal resolution. Encrypted at rest when saved…"
                  />
                </div>
                {canEdit && selected.status !== 'closed' && (
                  <Button
                    className="w-full"
                    disabled={submitting}
                    onClick={() => void handleSaveResolution()}
                  >
                    Save resolution findings
                  </Button>
                )}
              </div>
            </section>
          </aside>
        </div>

        {/* =========================================================================
            STATUS TRANSITION MODAL (Open → Investigating → Resolved → Closed)
           ========================================================================= */}
        <Modal
          open={transitionModal}
          onClose={() => setTransitionModal(false)}
          title={`Transition Case to ${targetStatus ? CASE_STATUS_LABELS[targetStatus] : ''}`}
          description={`Move case lifecycle from ${CASE_STATUS_LABELS[selected.status]} to ${targetStatus ? CASE_STATUS_LABELS[targetStatus] : ''}. This transition is permanently audit-logged.`}
          size="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setTransitionModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => void handleExecuteTransition()}
                disabled={submitting}
                variant={targetStatus === 'closed' ? 'secondary' : 'primary'}
              >
                {submitting ? 'Transitioning…' : `Confirm Transition`}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-base bg-[rgb(var(--bg-muted))] p-3 text-xs">
              <span className="font-semibold text-primary">Status Flow:</span>{' '}
              <Badge tone={statusTone[selected.status]}>{CASE_STATUS_LABELS[selected.status]}</Badge>
              {' → '}
              {targetStatus && (
                <Badge tone={statusTone[targetStatus]}>{CASE_STATUS_LABELS[targetStatus]}</Badge>
              )}
            </div>

            <div>
              <Label htmlFor="modal-transition-reason">
                Transition Reason (Recorded in Audit Trail)
              </Label>
              <Textarea
                id="modal-transition-reason"
                rows={3}
                value={transitionReason}
                onChange={(e) => setTransitionReason(e.target.value)}
                placeholder="Explain why this case is advancing or changing status (e.g., Investigation completed, evidence reviewed, informal conciliation reached)…"
              />
            </div>

            {(targetStatus === 'resolved' || targetStatus === 'closed') && (
              <>
                <div className="border-t border-base pt-3">
                  <Label htmlFor="transition-outcome">Case Outcome</Label>
                  <Select
                    id="transition-outcome"
                    value={transitionOutcome}
                    onChange={(e) => setTransitionOutcome(e.target.value as HrCaseOutcome)}
                  >
                    {Object.entries(CASE_OUTCOME_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="transition-notes">Final Resolution Summary (Encrypted)</Label>
                  <Textarea
                    id="transition-notes"
                    rows={3}
                    value={transitionNotes}
                    onChange={(e) => setTransitionNotes(e.target.value)}
                    placeholder="Optional closing summary or resolution notes…"
                  />
                </div>
              </>
            )}
          </div>
        </Modal>

        {/* =========================================================================
            DISCIPLINARY ACTION MODAL (Verbal / Written Warning, etc.)
           ========================================================================= */}
        <Modal
          open={discModal}
          onClose={() => setDiscModal(false)}
          title="Issue Disciplinary Action Record"
          description="Link an official verbal warning, written warning, suspension, or termination to this case."
          size="lg"
          footer={
            <>
              <Button variant="secondary" onClick={() => setDiscModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => void handleAddDisciplinary()}
                disabled={submitting || !discEffectiveDate}
              >
                {submitting ? 'Recording…' : 'Record disciplinary action'}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Action Type</Label>
                <Select
                  value={discType}
                  onChange={(e) => setDiscType(e.target.value as DisciplinaryActionType)}
                >
                  {Object.entries(DISCIPLINARY_ACTION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Effective Date</Label>
                <Input
                  type="date"
                  value={discEffectiveDate}
                  onChange={(e) => setDiscEffectiveDate(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Letter / Notice Reference (Optional)</Label>
              <Input
                value={discLetterRef}
                onChange={(e) => setDiscLetterRef(e.target.value)}
                placeholder="e.g. HR-WARN-2026-003 or DOC-8821"
              />
            </div>

            <div>
              <Label>Confidential Action Details / Grounds</Label>
              <Textarea
                rows={4}
                value={discDetails}
                onChange={(e) => setDiscDetails(e.target.value)}
                placeholder="Details of warning, expectations, timeframes, and consequences. Encrypted at rest — reveal is audit-logged."
              />
            </div>
          </div>
        </Modal>

        {/* =========================================================================
            INVESTIGATION RECORD MODAL
           ========================================================================= */}
        <Modal
          open={invModal}
          onClose={() => setInvModal(false)}
          title="Add Investigation Record"
          description="Record witness statements, evidence reviews, investigation findings, or legal reviews."
          size="lg"
          footer={
            <>
              <Button variant="secondary" onClick={() => setInvModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => void handleAddInvestigation()}
                disabled={submitting || !invTitle.trim() || !invContent.trim()}
              >
                {submitting ? 'Saving…' : 'Save investigation record'}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Record Type</Label>
                <Select
                  value={invType}
                  onChange={(e) => setInvType(e.target.value as HrInvestigationRecordType)}
                >
                  {Object.entries(INVESTIGATION_RECORD_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Date of Record</Label>
                <Input
                  type="date"
                  value={invDate}
                  onChange={(e) => setInvDate(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Record Title</Label>
              <Input
                value={invTitle}
                onChange={(e) => setInvTitle(e.target.value)}
                placeholder="e.g. Witness interview with Team Lead"
              />
            </div>

            <div>
              <Label>Confidential Findings / Content</Label>
              <Textarea
                rows={5}
                value={invContent}
                onChange={(e) => setInvContent(e.target.value)}
                placeholder="Detailed statements, exhibits, or evidence summaries. Encrypted at rest."
              />
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  // =========================================================================
  // CASE LIST VIEW
  // =========================================================================
  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-4 lg:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-primary">Employee Relations</h1>
            <LockKeyhole className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-0.5 text-sm text-secondary">
            Grievances, disciplinary actions, and investigations — Case Access permission required.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateModal(true)}>
            <Plus className="h-4 w-4" /> New confidential case
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Open cases', value: summary?.openCaseCount ?? 0, icon: BriefcaseBusiness },
          { label: 'Investigating', value: summary?.investigatingCount ?? 0, icon: ShieldAlert },
          { label: 'Resolved this quarter', value: summary?.resolvedThisQuarterCount ?? 0, icon: Check },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="surface flex items-center gap-4 rounded-xl border border-base p-4 shadow-card">
            <div className="rounded-lg bg-slate-100 p-2.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{loading ? '…' : value}</p>
              <p className="text-xs text-secondary">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Case List Table Section */}
      <section className="surface overflow-hidden rounded-xl border border-base shadow-card">
        <div className="flex flex-col gap-3 border-b border-base p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search case ID, title, officer…"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted" />
            <Select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="min-w-40">
              <option>All</option>
              <option>Grievance</option>
              <option>Complaint</option>
              <option>Disciplinary</option>
              <option>Investigation</option>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12 text-secondary">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading cases…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[rgb(var(--bg-muted))] text-left text-[11px] uppercase tracking-wide text-secondary">
                <tr>
                  <th className="px-5 py-3">Case</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">HR officer</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3 text-right">Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {filteredCases.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className="cursor-pointer transition-colors hover:bg-[rgb(var(--bg-hover))]"
                  >
                    <td className="px-5 py-4">
                      <p className="font-mono text-xs font-semibold text-secondary">{item.caseNumber}</p>
                      <p className="mt-1 font-medium text-primary">{item.title}</p>
                      <p className="mt-0.5 text-xs text-muted">Updated {formatUpdated(item.updatedAt)}</p>
                    </td>
                    <td className="px-4 py-4 text-secondary">{CASE_TYPE_LABELS[item.caseType]}</td>
                    <td className="px-4 py-4">
                      <Badge tone={statusTone[item.status]} dot>{CASE_STATUS_LABELS[item.status]}</Badge>
                    </td>
                    <td className="px-4 py-4 text-secondary">{item.assignedOfficerName ?? '—'}</td>
                    <td className="px-4 py-4">
                      <Badge tone={priorityTone[item.priority]}>{CASE_PRIORITY_LABELS[item.priority]}</Badge>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end">
                        {item.isRestricted ? (
                          <span title="Restricted to HR & Case Access Holders">
                            <LockKeyhole className="h-4 w-4 text-amber-500" />
                          </span>
                        ) : (
                          <Eye className="h-4 w-4 text-muted" />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredCases.length && (
              <div className="p-10 text-center text-sm text-muted">No confidential cases match this filter.</div>
            )}
          </div>
        )}
        <div className="flex items-center gap-2 border-t border-base bg-[rgb(var(--bg-muted))] px-5 py-3 text-xs text-muted">
          <LockKeyhole className="h-3.5 w-3.5" /> Case access and sensitive field reveals are audited.
        </div>
      </section>

      {/* Modal: New Confidential Case */}
      <Modal
        open={createModal}
        onClose={() => setCreateModal(false)}
        title="New confidential case"
        description="Grievance, complaint, disciplinary, or investigation record."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateModal(false)}>Cancel</Button>
            <Button onClick={() => void handleCreateCase()} disabled={submitting || !newTitle.trim()}>
              {submitting ? 'Creating…' : 'Create case'}
            </Button>
          </>
        }
      >
        {formError && <p className="mb-3 text-sm text-danger-600">{formError}</p>}
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Formal grievance regarding workplace conditions" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Type</Label>
              <Select value={newType} onChange={(event) => setNewType(event.target.value as HrCaseType)}>
                {Object.entries(CASE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={newPriority} onChange={(event) => setNewPriority(event.target.value as HrCasePriority)}>
                {Object.entries(CASE_PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Label>Confidential details</Label>
            <Textarea
              rows={4}
              value={newDetails}
              onChange={(event) => setNewDetails(event.target.value)}
              placeholder="Encrypted at rest — not shown in list views."
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

function TimelineItem({
  date,
  title,
  by,
  detail,
}: {
  date: string;
  title: string;
  by: string;
  detail: ReactNode;
}) {
  return (
    <div className="relative flex gap-4 pb-6 last:pb-0">
      <span className="absolute left-[15px] top-8 h-[calc(100%-24px)] w-px bg-[rgb(var(--border-base))]" />
      <div className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-base bg-[rgb(var(--bg-muted))]">
        <LockKeyhole className="h-3.5 w-3.5 text-muted" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-primary">{title}</p>
        <p className="mt-0.5 text-xs text-secondary">{by}</p>
        <div className="mt-2 text-sm text-secondary">{detail}</div>
        <p className="mt-1.5 text-[11px] text-muted">{date}</p>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-base pb-3 last:border-0 last:pb-0">
      <dt className="text-secondary">{label}</dt>
      <dd className="text-right font-medium text-primary">{value}</dd>
    </div>
  );
}
