import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  BriefcaseBusiness,
  Check,
  Eye,
  FileLock2,
  Filter,
  Loader2,
  LockKeyhole,
  MessageSquarePlus,
  Plus,
  Search,
  ShieldAlert,
  UserRound,
} from 'lucide-react';
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
  addHrCaseNote,
  addInvestigationRecord,
  createHrCase,
  getEmployeeRelationsSummary,
  getHrCase,
  listHrCases,
  revealHrCaseField,
  transitionHrCaseStatus,
  updateHrCase,
} from '@/lib/employee-relations-api';
import { ApiError } from '@/lib/tenant-api-client';
import type {
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

function formatUpdated(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
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
    'activity' | 'investigation' | 'disciplinary' | 'parties'
  >('activity');
  const [resolution, setResolution] = useState('');
  const [outcome, setOutcome] = useState<HrCaseOutcome>('not_determined');
  const [transitionReason, setTransitionReason] = useState('');
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState('');
  const [revealedDetails, setRevealedDetails] = useState<string | null>(null);
  const [revealedNotes, setRevealedNotes] = useState<Record<string, string>>({});
  const [revealedInvestigations, setRevealedInvestigations] = useState<Record<string, string>>({});
  const [invTitle, setInvTitle] = useState('');
  const [invType, setInvType] = useState<HrInvestigationRecordType>('interview');
  const [invContent, setInvContent] = useState('');
  const [invDate, setInvDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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

  const loadDetail = useCallback(async (caseId: string) => {
    setDetailLoading(true);
    setFormError(null);
    setRevealedDetails(null);
    setRevealedNotes({});
    setRevealedInvestigations({});
    try {
      const detail = await getHrCase(caseId);
      setSelected(detail);
      setOutcome(detail.outcome);
      setResolution('');
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to load case detail');
      setSelected(null);
      setSelectedId(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setSelected(null);
  }, [selectedId, loadDetail]);

  const filteredCases = cases;

  const handleRevealDetails = async () => {
    if (!selected) return;
    try {
      const result = await revealHrCaseField(selected.id, { field: 'details' });
      setRevealedDetails(result.value);
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
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Reveal failed');
    }
  };

  const handleTransition = async (nextStatus: HrCaseStatus) => {
    if (!selected) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const updated = await transitionHrCaseStatus(selected.id, {
        status: nextStatus,
        reason: transitionReason.trim() || undefined,
      });
      setSelected(updated);
      setTransitionReason('');
      await loadList();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Status transition failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddInvestigation = async () => {
    if (!selected || !invTitle.trim() || !invContent.trim()) return;
    setSubmitting(true);
    try {
      await addInvestigationRecord(selected.id, {
        recordType: invType,
        title: invTitle.trim(),
        content: invContent.trim(),
        recordedAt: invDate || undefined,
      });
      setInvTitle('');
      setInvContent('');
      setInvDate('');
      await loadDetail(selected.id);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to add investigation record');
    } finally {
      setSubmitting(false);
    }
  };

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
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddNote = async () => {
    if (!selected || !note.trim()) return;
    setSubmitting(true);
    try {
      await addHrCaseNote(selected.id, note.trim());
      setNote('');
      await loadDetail(selected.id);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to add note');
    } finally {
      setSubmitting(false);
    }
  };

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

  if (selectedId && (selected || detailLoading)) {
    if (detailLoading || !selected) {
      return (
        <div className="flex items-center justify-center p-12 text-secondary">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading confidential case…
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-[1400px] space-y-5 p-4 lg:p-6">
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="inline-flex items-center gap-2 text-sm font-medium text-secondary transition-colors hover:text-accent-600"
        >
          <ArrowLeft className="h-4 w-4" /> Back to confidential cases
        </button>

        {selected.isRestricted && (
          <div className="flex gap-3 rounded-xl border border-amber-300/60 bg-amber-50/70 p-4 text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/25 dark:text-amber-200">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Restricted to HR &amp; Company Owner roles</p>
              <p className="mt-0.5 text-xs opacity-80">
                Viewing confidential fields is audited. Managers do not have access by default.
              </p>
            </div>
          </div>
        )}

        {formError && (
          <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">{formError}</div>
        )}

        <section className="surface rounded-xl border border-base p-5 shadow-card">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <FileLock2 className="h-6 w-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-muted">{selected.caseNumber}</span>
                  <Badge tone={statusTone[selected.status]} dot>{CASE_STATUS_LABELS[selected.status]}</Badge>
                  <Badge tone={priorityTone[selected.priority]}>{CASE_PRIORITY_LABELS[selected.priority]}</Badge>
                </div>
                <h1 className="mt-2 text-xl font-bold text-primary">{selected.title}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-secondary">
                  {selected.hasDetails ? (
                    revealedDetails ? (
                      <p className="max-w-3xl">{revealedDetails}</p>
                    ) : (
                      <>
                        <span className="italic text-muted">Confidential details masked</span>
                        <Button size="sm" variant="secondary" onClick={() => void handleRevealDetails()}>
                          <Eye className="h-4 w-4" /> Reveal details
                        </Button>
                      </>
                    )
                  ) : (
                    <span className="text-muted">No detailed narrative recorded.</span>
                  )}
                </div>
              </div>
            </div>
            <Button size="sm" onClick={() => setDetailTab('activity')}>
              <MessageSquarePlus className="h-4 w-4" /> Add note
            </Button>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="surface overflow-hidden rounded-xl border border-base shadow-card">
            <div className="flex overflow-x-auto border-b border-base px-4">
              {(
                [
                  ['activity', 'Timeline & notes'],
                  ['investigation', 'Investigation'],
                  ['disciplinary', 'Disciplinary actions'],
                  ['parties', 'Involved parties'],
                ] as const
              ).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setDetailTab(tab)}
                  className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${detailTab === tab ? 'border-accent-500 text-accent-600 dark:text-accent-400' : 'border-transparent text-secondary hover:text-primary'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {detailTab === 'activity' && (
              <div className="p-5">
                <div className="mb-6 rounded-lg border border-base bg-[rgb(var(--bg-muted))] p-3">
                  <Textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={3}
                    placeholder="Add a confidential case note…"
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
                <div className="space-y-0">
                  {selected.notes.map((item) => (
                    <TimelineItem
                      key={item.id}
                      date={formatUpdated(item.createdAt)}
                      title="Confidential note"
                      by="HR case team"
                      detail={
                        revealedNotes[item.id] ?? (
                          <button
                            type="button"
                            className="text-accent-600 hover:underline"
                            onClick={() => void handleRevealNote(item.id)}
                          >
                            Reveal note content
                          </button>
                        )
                      }
                    />
                  ))}
                  {!selected.notes.length && (
                    <p className="text-sm text-muted">No notes yet.</p>
                  )}
                </div>
              </div>
            )}

            {detailTab === 'investigation' && (
              <div className="p-5">
                {selected.status !== 'closed' && (
                  <div className="mb-6 rounded-lg border border-base bg-[rgb(var(--bg-muted))] p-4 space-y-3">
                    <p className="text-sm font-medium text-primary">Add investigation record</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label>Record type</Label>
                        <Select value={invType} onChange={(e) => setInvType(e.target.value as HrInvestigationRecordType)}>
                          {Object.entries(INVESTIGATION_RECORD_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <Label>Recorded date</Label>
                        <Input type="date" value={invDate} onChange={(e) => setInvDate(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <Label>Title</Label>
                      <Input value={invTitle} onChange={(e) => setInvTitle(e.target.value)} placeholder="Witness interview" />
                    </div>
                    <div>
                      <Label>Confidential content</Label>
                      <Textarea rows={3} value={invContent} onChange={(e) => setInvContent(e.target.value)} placeholder="Encrypted at rest…" />
                    </div>
                    <Button size="sm" disabled={submitting || !invTitle.trim() || !invContent.trim()} onClick={() => void handleAddInvestigation()}>
                      Save investigation record
                    </Button>
                  </div>
                )}
                <div className="space-y-0">
                  {selected.investigationRecords.map((record) => (
                    <TimelineItem
                      key={record.id}
                      date={formatUpdated(record.recordedAt)}
                      title={record.title}
                      by={INVESTIGATION_RECORD_LABELS[record.recordType]}
                      detail={
                        revealedInvestigations[record.id] ?? (
                          <button type="button" className="text-accent-600 hover:underline" onClick={() => void handleRevealInvestigation(record.id)}>
                            Reveal record content
                          </button>
                        )
                      }
                    />
                  ))}
                  {!selected.investigationRecords.length && (
                    <p className="text-sm text-muted">No investigation records yet.</p>
                  )}
                </div>
              </div>
            )}

            {detailTab === 'disciplinary' && (
              <div className="divide-y divide-[rgb(var(--border-base))]">
                {selected.disciplinaryActions.length === 0 ? (
                  <p className="px-5 py-8 text-sm text-muted">No disciplinary actions recorded.</p>
                ) : (
                  selected.disciplinaryActions.map((action) => (
                    <div key={action.id} className="flex items-center gap-3 px-5 py-4">
                      <div className="rounded-lg bg-slate-100 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <FileLock2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-primary">
                          {DISCIPLINARY_ACTION_LABELS[action.actionType]}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          Effective {action.effectiveDate}
                          {action.letterReference ? ` · Ref ${action.letterReference}` : ''}
                        </p>
                      </div>
                      {action.detailsRestricted && <LockKeyhole className="h-4 w-4 text-muted" />}
                    </div>
                  ))
                )}
              </div>
            )}

            {detailTab === 'parties' && (
              <div className="p-5">
                <div className="mb-4 flex items-center justify-between rounded-lg bg-[rgb(var(--bg-muted))] p-3">
                  <div>
                    <p className="text-sm font-medium text-primary">Anonymize identities</p>
                    <p className="text-xs text-muted">Hide names during shared case review.</p>
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
                        <p className="text-xs text-muted">{party.partyRole.replace(/_/g, ' ')}</p>
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
          </section>

          <aside className="space-y-5">
            <section className="surface rounded-xl border border-base p-5 shadow-card">
              <h2 className="text-sm font-semibold text-primary">Case status</h2>
              <p className="mt-1 text-xs text-muted">Open → Investigating → Resolved → Closed</p>
              <div className="mt-4 space-y-3">
                {HR_CASE_NEXT_STATUSES[selected.status].length === 0 ? (
                  <p className="text-sm text-secondary">This case is closed and cannot be reopened.</p>
                ) : (
                  <>
                    <div>
                      <Label htmlFor="transition-reason">Transition reason (optional)</Label>
                      <Textarea
                        id="transition-reason"
                        rows={2}
                        value={transitionReason}
                        onChange={(e) => setTransitionReason(e.target.value)}
                        placeholder="Document why status is changing…"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {HR_CASE_NEXT_STATUSES[selected.status].map((next) => (
                        <Button
                          key={next}
                          size="sm"
                          variant={next === 'closed' ? 'secondary' : 'primary'}
                          disabled={submitting}
                          onClick={() => void handleTransition(next)}
                        >
                          Move to {CASE_STATUS_LABELS[next]}
                        </Button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </section>
            <section className="surface rounded-xl border border-base p-5 shadow-card">
              <h2 className="text-sm font-semibold text-primary">Case ownership</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <InfoRow label="Case type" value={CASE_TYPE_LABELS[selected.caseType]} />
                <InfoRow label="HR officer" value={selected.assignedOfficerName ?? 'Unassigned'} />
                <InfoRow label="Last updated" value={formatUpdated(selected.updatedAt)} />
                <InfoRow label="Access" value={selected.isRestricted ? 'HR & Owner only' : 'Assigned HR team'} />
              </dl>
            </section>
            <section className="surface rounded-xl border border-base p-5 shadow-card">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-primary">Resolution &amp; outcome</h2>
                {saved && (
                  <span className="inline-flex items-center gap-1 text-xs text-success-600">
                    <Check className="h-3.5 w-3.5" /> Saved
                  </span>
                )}
              </div>
              <div className="mt-4 space-y-4">
                <div>
                  <Label htmlFor="outcome">Outcome</Label>
                  <Select
                    id="outcome"
                    value={outcome}
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
                  <Label htmlFor="resolution">Resolution notes</Label>
                  <Textarea
                    id="resolution"
                    value={resolution}
                    onChange={(event) => {
                      setResolution(event.target.value);
                      setSaved(false);
                    }}
                    rows={5}
                    placeholder="Encrypted when saved…"
                  />
                </div>
                <Button className="w-full" disabled={submitting || selected.status === 'closed'} onClick={() => void handleSaveResolution()}>
                  Save confidential update
                </Button>
              </div>
            </section>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-4 lg:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-primary">Employee Relations</h1>
            <LockKeyhole className="h-4 w-4 text-muted" />
          </div>
          <p className="mt-0.5 text-sm text-secondary">
            Grievances, disciplinary actions, and investigations — HR &amp; Owner access only.
          </p>
        </div>
        <Button onClick={() => setCreateModal(true)}>
          <Plus className="h-4 w-4" /> New confidential case
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

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
                          <span title="Restricted to HR & Owner">
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
            <Input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Formal workload grievance" />
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
      <div>
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
