import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileWarning,
  History,
  Loader2,
  MapPin,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { usePermissions } from '@hrm/portal-ui';
import {
  DynamicReportingFields,
  INCIDENT_SEVERITY_TONES,
  INCIDENT_STATUS_TONES,
  RuleProvenanceBadges,
} from '@/components/health-safety/DynamicReportingFields';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { listAuditLogs } from '@/lib/audit-api';
import { listEmployees } from '@/lib/employees-api';
import {
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_STATUS_LABELS,
  INCIDENT_TYPE_LABELS,
  PARTY_ROLE_LABELS,
  createInjuryEntry,
  getHealthSafetyRequirements,
  getIncident,
  listInjuryLog,
  updateIncident,
} from '@/lib/health-safety-api';
import { ApiError } from '@/lib/tenant-api-client';
import type {
  AuditLogEntry,
  IncidentPartyRole,
  IncidentReportingRuleConfig,
  InjuryLogEntryRecord,
  InjuryMedicalAttention,
  WorkplaceIncidentPartyRecord,
  WorkplaceIncidentRecord,
  WorkplaceIncidentStatus,
} from '@hrm/shared-types';

const STATUS_FLOW: WorkplaceIncidentStatus[] = [
  'reported',
  'under_investigation',
  'resolved',
  'closed',
];

const NEXT_STATUS_ACTIONS: Record<
  WorkplaceIncidentStatus,
  Array<{ target: WorkplaceIncidentStatus; label: string; variant: 'primary' | 'secondary' }>
> = {
  reported: [
    { target: 'under_investigation', label: 'Start Investigation', variant: 'primary' },
    { target: 'resolved', label: 'Mark Resolved', variant: 'secondary' },
  ],
  under_investigation: [
    { target: 'resolved', label: 'Mark Resolved', variant: 'primary' },
    { target: 'closed', label: 'Close Incident', variant: 'secondary' },
  ],
  resolved: [
    { target: 'closed', label: 'Close Incident', variant: 'primary' },
    { target: 'under_investigation', label: 'Reopen Investigation', variant: 'secondary' },
  ],
  closed: [
    { target: 'under_investigation', label: 'Reopen Incident', variant: 'secondary' },
  ],
};

export function HealthSafetyIncidentDetailPage() {
  const { incidentId } = useParams<{ incidentId: string }>();
  const navigate = useNavigate();
  const { can } = usePermissions();

  const canCreate = can('health_safety', 'create');
  const canEdit = can('health_safety', 'edit');
  const canViewAudit = can('audit', 'view');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [incident, setIncident] = useState<WorkplaceIncidentRecord | null>(null);
  const [reportingConfig, setReportingConfig] = useState<IncidentReportingRuleConfig | null>(null);
  const [requireBodyPart, setRequireBodyPart] = useState(false);
  const [injuries, setInjuries] = useState<InjuryLogEntryRecord[]>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([]);
  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>([]);

  // Form states
  const [countryForm, setCountryForm] = useState<Record<string, unknown>>({});
  const [investigationNotes, setInvestigationNotes] = useState('');
  const [regulatorRefInput, setRegulatorRefInput] = useState('');

  // Add party modal
  const [partyModalOpen, setPartyModalOpen] = useState(false);
  const [partyEmployeeId, setPartyEmployeeId] = useState('');
  const [partyRole, setPartyRole] = useState<IncidentPartyRole>('witness');

  // Linked injury modal
  const [injuryModalOpen, setInjuryModalOpen] = useState(false);
  const [injuryEmployeeId, setInjuryEmployeeId] = useState('');
  const [injuryType, setInjuryType] = useState('');
  const [injuryBodyPart, setInjuryBodyPart] = useState('');
  const [injuryMedical, setInjuryMedical] = useState<InjuryMedicalAttention>('first_aid');
  const [injuryDaysLost, setInjuryDaysLost] = useState('0');
  const [injuryTreatment, setInjuryTreatment] = useState('');

  const load = useCallback(async () => {
    if (!incidentId) return;
    setLoading(true);
    setError(null);
    try {
      const inc = await getIncident(incidentId);
      setIncident(inc);
      setCountryForm(inc.countrySpecificData ?? {});
      setInvestigationNotes(inc.investigationNotes ?? '');
      setRegulatorRefInput(inc.regulatorReferenceNumber ?? '');

      const [injuryRows, employeeRows, requirements, auditResult] = await Promise.all([
        listInjuryLog(inc.companyId, { incidentId: inc.id }),
        listEmployees(inc.companyId),
        getHealthSafetyRequirements(inc.companyId, {
          employeeId: inc.reportedByEmployeeId,
          asOf: inc.occurredAt,
        }),
        canViewAudit
          ? listAuditLogs({
              module: 'health_safety',
              recordId: inc.id,
              pageSize: 20,
            }).catch(() => ({ entries: [], total: 0 }))
          : Promise.resolve({ entries: [], total: 0 }),
      ]);

      setInjuries(injuryRows);
      setEmployees(
        employeeRows.map((emp) => ({
          id: emp.id,
          name: emp.fullName ?? `${emp.firstName} ${emp.lastName}`,
        })),
      );
      setReportingConfig(inc.resolvedReportingConfig ?? requirements.incidentReporting);
      setRequireBodyPart(requirements.injuryLogRequireBodyPart);
      setAuditEntries(auditResult.entries);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load incident details');
    } finally {
      setLoading(false);
    }
  }, [incidentId, canViewAudit]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleTransitionStatus = async (nextStatus: WorkplaceIncidentStatus) => {
    if (!incident) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await updateIncident(incident.id, { status: nextStatus });
      setNotice(`Incident status updated to ${INCIDENT_STATUS_LABELS[nextStatus]}.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!incident) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await updateIncident(incident.id, {
        investigationNotes,
      });
      setNotice('Investigation notes saved.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save investigation notes');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCountryFields = async () => {
    if (!incident) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await updateIncident(incident.id, {
        countrySpecificData: countryForm,
      });
      setNotice('Country-specific reporting fields saved.');
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to save country reporting fields',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitRegulatorReport = async () => {
    if (!incident) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await updateIncident(incident.id, {
        regulatorReportSubmitted: true,
        regulatorReferenceNumber: regulatorRefInput.trim() || undefined,
        countrySpecificData: countryForm,
      });
      setNotice('Regulator notification recorded and audit logged.');
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to submit regulator report',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleAddParty = async () => {
    if (!incident || !partyEmployeeId) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const existingParties = incident.parties.filter(
        (p) => p.employeeId !== partyEmployeeId,
      );
      const nextParties = [
        ...existingParties.map((p) => ({
          employeeId: p.employeeId,
          partyRole: p.partyRole,
        })),
        { employeeId: partyEmployeeId, partyRole },
      ];
      await updateIncident(incident.id, { parties: nextParties });
      setPartyModalOpen(false);
      setPartyEmployeeId('');
      setNotice('Involved party updated.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update parties');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveParty = async (party: WorkplaceIncidentPartyRecord) => {
    if (!incident) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const nextParties = incident.parties
        .filter((p) => p.employeeId !== party.employeeId)
        .map((p) => ({ employeeId: p.employeeId, partyRole: p.partyRole }));
      await updateIncident(incident.id, { parties: nextParties });
      setNotice(`Removed ${party.employeeName} from incident parties.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove party');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateLinkedInjury = async () => {
    if (!incident || !injuryEmployeeId || !injuryType.trim()) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await createInjuryEntry(incident.companyId, {
        employeeId: injuryEmployeeId,
        incidentId: incident.id,
        injuryType: injuryType.trim(),
        bodyPart: injuryBodyPart.trim() || undefined,
        medicalAttention: injuryMedical,
        daysLost: Number(injuryDaysLost) || 0,
        treatmentSummary: injuryTreatment.trim() || undefined,
        recordedAt: new Date().toISOString(),
      });
      setInjuryModalOpen(false);
      setInjuryEmployeeId('');
      setInjuryType('');
      setInjuryBodyPart('');
      setInjuryTreatment('');
      setInjuryDaysLost('0');
      setNotice('Linked injury entry recorded.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to record injury entry');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-accent-600" />
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <Button variant="secondary" size="sm" onClick={() => navigate('/talent/health-safety')}>
          <ArrowLeft className="h-4 w-4" /> Back to Incident Register
        </Button>
        <div className="surface rounded-xl border border-base p-8 text-center text-sm text-secondary">
          {error ?? 'Incident not found.'}
        </div>
      </div>
    );
  }

  const currentFlowIdx = STATUS_FLOW.indexOf(incident.status);
  const isRegulatorOverdue =
    incident.regulatorReportRequired &&
    !incident.regulatorReportSubmittedAt &&
    incident.regulatorReportDueAt != null &&
    new Date(incident.regulatorReportDueAt).getTime() < Date.now();

  const resolvedFields = reportingConfig?.reportingFields ?? [];
  const regulatorLabel =
    reportingConfig?.regulatorName ?? incident.regulatorName ?? 'Statutory Regulator';
  const regulatorRefLabel =
    reportingConfig?.regulatorReferenceLabel ?? 'Regulator Reference Number';

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-4 lg:p-6">
      {/* Top Breadcrumb + Title */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => navigate('/talent/health-safety')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary hover:text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Incident Register
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold text-primary">
              {incident.incidentNumber} — {INCIDENT_TYPE_LABELS[incident.incidentType]}
            </h1>
            <Badge tone={INCIDENT_SEVERITY_TONES[incident.severity]} dot>
              {INCIDENT_SEVERITY_LABELS[incident.severity]} Severity
            </Badge>
            <Badge tone={INCIDENT_STATUS_TONES[incident.status]} dot>
              {INCIDENT_STATUS_LABELS[incident.status]}
            </Badge>
            {incident.regulatorReportRequired && (
              <Badge
                tone={
                  incident.regulatorReportSubmittedAt
                    ? 'success'
                    : isRegulatorOverdue
                      ? 'error'
                      : 'warning'
                }
              >
                {incident.regulatorReportSubmittedAt
                  ? 'Regulator Notified'
                  : isRegulatorOverdue
                    ? 'Regulator Report Overdue'
                    : 'Regulator Notifiable'}
              </Badge>
            )}
          </div>

          <p className="text-xs text-muted">
            Occurred {new Date(incident.occurredAt).toLocaleString()} · Reported by{' '}
            <span className="font-medium text-secondary">
              {incident.reportedByEmployeeName}
            </span>{' '}
            at <span className="font-medium text-secondary">{incident.location}</span>
          </p>
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            {NEXT_STATUS_ACTIONS[incident.status].map((action) => (
              <Button
                key={action.target}
                variant={action.variant}
                size="sm"
                disabled={saving}
                onClick={() => void handleTransitionStatus(action.target)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Feedback / Error Banners */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-900/50 dark:bg-error-950/30 dark:text-error-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs font-semibold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Lifecycle Stepper */}
      <Card>
        <CardBody className="p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STATUS_FLOW.map((step, idx) => {
              const completed = idx < currentFlowIdx;
              const current = idx === currentFlowIdx;
              return (
                <div
                  key={step}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 ${
                    current
                      ? 'border-accent-500 bg-accent-50/70 dark:bg-accent-950/30'
                      : completed
                        ? 'border-emerald-300/70 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/15'
                        : 'border-base bg-[rgb(var(--bg-muted))]/40'
                  }`}
                >
                  <div
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      current
                        ? 'bg-accent-600 text-white'
                        : completed
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {completed ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-primary">
                      {INCIDENT_STATUS_LABELS[step]}
                    </p>
                    <p className="text-[10px] text-muted">
                      {current
                        ? 'Current stage'
                        : completed
                          ? 'Completed'
                          : 'Upcoming'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* Main 2-Column Layout */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* LEFT COLUMN (2/3 width): Incident Summary, Country-Specific Reporting Fields, Investigation Notes, Linked Injuries */}
        <div className="space-y-5 lg:col-span-2">
          {/* Incident Report Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileWarning className="h-4 w-4 text-accent-600" /> Incident Details
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted">
                    Incident Type
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-primary">
                    {INCIDENT_TYPE_LABELS[incident.incidentType]}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted">
                    Reported By
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-primary">
                    {incident.reportedByEmployeeName}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted">
                    Location
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-primary">
                    <MapPin className="h-3.5 w-3.5 text-muted" /> {incident.location}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted">
                    Occurred At
                  </p>
                  <p className="mt-0.5 text-sm text-secondary">
                    {new Date(incident.occurredAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted">
                    GPS Coordinates
                  </p>
                  {incident.gpsLat != null && incident.gpsLng != null ? (
                    <a
                      href={`https://maps.google.com/?q=${incident.gpsLat},${incident.gpsLng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 text-sm font-medium text-accent-600 hover:underline"
                    >
                      {incident.gpsLat.toFixed(5)}, {incident.gpsLng.toFixed(5)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <p className="mt-0.5 text-sm text-muted">Not captured</p>
                  )}
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted">
                    Resolved At
                  </p>
                  <p className="mt-0.5 text-sm text-secondary">
                    {incident.resolvedAt
                      ? new Date(incident.resolvedAt).toLocaleString()
                      : '—'}
                  </p>
                </div>
              </div>

              <div className="border-t border-base pt-3">
                <p className="text-[11px] uppercase tracking-wider text-muted">
                  Incident Description
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-primary">
                  {incident.description}
                </p>
              </div>
            </CardBody>
          </Card>

          {/* Rule-Resolver Country-Specific Reporting Fields */}
          <Card>
            <CardHeader className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-accent-600" />
                  Country &amp; Statutory Reporting Fields
                </CardTitle>
                <div className="mt-1">
                  <RuleProvenanceBadges
                    layers={reportingConfig?.resolvedLayers}
                    asOf={reportingConfig?.resolvedAsOf ?? incident.occurredAt}
                  />
                </div>
              </div>

              {canEdit && resolvedFields.length > 0 && (
                <Button
                  size="sm"
                  disabled={saving}
                  onClick={() => void handleSaveCountryFields()}
                >
                  <Save className="h-3.5 w-3.5" /> Save Fields
                </Button>
              )}
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="rounded-lg border border-base bg-[rgb(var(--bg-muted))]/50 px-3.5 py-2.5 text-xs text-secondary">
                Fields below are dynamically resolved for{' '}
                <span className="font-semibold text-primary">{regulatorLabel}</span> via the
                Rule Resolver chain (`Global → Country → State → Company → Contract`) active
                on <span className="font-medium">{new Date(incident.occurredAt).toLocaleDateString()}</span>.
              </div>

              <DynamicReportingFields
                fields={resolvedFields}
                values={countryForm}
                onChange={setCountryForm}
                regulatorRequired={incident.regulatorReportRequired}
                readOnly={!canEdit}
                idPrefix="detail-country-field"
              />
            </CardBody>
          </Card>

          {/* Investigation Notes */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Investigation Notes &amp; Corrective Findings</CardTitle>
              {canEdit && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => void handleSaveNotes()}
                >
                  <Save className="h-3.5 w-3.5" /> Save Notes
                </Button>
              )}
            </CardHeader>
            <CardBody>
              <Textarea
                rows={5}
                disabled={!canEdit}
                value={investigationNotes}
                onChange={(e) => setInvestigationNotes(e.target.value)}
                placeholder="Document witness interviews, root cause findings, hazard remediation steps, and supervisor sign-off…"
              />
            </CardBody>
          </Card>

          {/* Linked Injury Log Entries */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" /> Linked Injury Log
                </CardTitle>
                <p className="mt-0.5 text-xs text-muted">
                  Medical attention and lost-time entries linked to {incident.incidentNumber}
                  {requireBodyPart ? ' · Body part required by country rules' : ''}
                </p>
              </div>
              {canCreate && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setInjuryModalOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> Log Injury
                </Button>
              )}
            </CardHeader>
            <CardBody className="divide-y divide-[rgb(var(--border-base))]">
              {injuries.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted">
                  No injury entries linked to this incident.
                </p>
              ) : (
                injuries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-col justify-between gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                  >
                    <div>
                      <p className="text-sm font-semibold text-primary">
                        {entry.employeeName} — {entry.injuryType}
                      </p>
                      <p className="text-xs text-muted">
                        Body part: {entry.bodyPart ?? 'Not recorded'} · Days lost:{' '}
                        {entry.daysLost} · Recorded{' '}
                        {new Date(entry.recordedAt).toLocaleDateString()}
                      </p>
                      {entry.treatmentSummary && (
                        <p className="mt-1 text-xs text-secondary">{entry.treatmentSummary}</p>
                      )}
                    </div>
                    <Badge tone="neutral">{entry.medicalAttention.replace(/_/g, ' ')}</Badge>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>

        {/* RIGHT SIDEBAR COLUMN (1/3 width): Regulator Compliance, Parties & Witnesses, Audit Log */}
        <div className="space-y-5">
          {/* Regulator Compliance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-accent-600" /> Regulator Notification
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">Regulator</span>
                <span className="font-semibold text-primary">{regulatorLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">Notifiable Obligation</span>
                <Badge tone={incident.regulatorReportRequired ? 'warning' : 'neutral'}>
                  {incident.regulatorReportRequired ? 'Mandatory Report' : 'Internal Only'}
                </Badge>
              </div>
              {incident.regulatorReportDueAt && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">Statutory Deadline</span>
                  <span
                    className={`text-xs font-semibold ${
                      isRegulatorOverdue ? 'text-error-600' : 'text-primary'
                    }`}
                  >
                    {new Date(incident.regulatorReportDueAt).toLocaleString()}
                  </span>
                </div>
              )}

              {incident.regulatorReportSubmittedAt ? (
                <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs dark:border-emerald-900/50 dark:bg-emerald-950/30">
                  <p className="font-semibold text-emerald-800 dark:text-emerald-200">
                    Notification Submitted
                  </p>
                  <p className="mt-1 text-emerald-700 dark:text-emerald-300">
                    Submitted {new Date(incident.regulatorReportSubmittedAt).toLocaleString()}
                    {incident.regulatorReportSubmittedByName
                      ? ` by ${incident.regulatorReportSubmittedByName}`
                      : ''}
                  </p>
                  {incident.regulatorReferenceNumber && (
                    <p className="mt-1 font-medium text-emerald-900 dark:text-emerald-100">
                      {regulatorRefLabel}: {incident.regulatorReferenceNumber}
                    </p>
                  )}
                </div>
              ) : (
                incident.regulatorReportRequired &&
                canEdit && (
                  <div className="space-y-3 border-t border-base pt-3">
                    <div>
                      <Label htmlFor="regulator-ref" className="text-xs">
                        {regulatorRefLabel}
                      </Label>
                      <Input
                        id="regulator-ref"
                        value={regulatorRefInput}
                        onChange={(e) => setRegulatorRefInput(e.target.value)}
                        placeholder="Enter statutory filing reference…"
                      />
                    </div>
                    <Button
                      className="w-full"
                      size="sm"
                      disabled={saving}
                      onClick={() => void handleSubmitRegulatorReport()}
                    >
                      <CheckCircle2 className="h-4 w-4" /> Mark Regulator Report Submitted
                    </Button>
                    <p className="text-[11px] text-muted">
                      Submitting validates all required country-specific fields from the active rule.
                    </p>
                  </div>
                )
              )}
            </CardBody>
          </Card>

          {/* Involved Parties & Witnesses */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4 text-accent-600" /> Parties &amp; Witnesses
              </CardTitle>
              {canEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPartyModalOpen(true)}
                >
                  <UserPlus className="h-3.5 w-3.5" /> Add
                </Button>
              )}
            </CardHeader>
            <CardBody className="divide-y divide-[rgb(var(--border-base))]">
              {incident.parties.length === 0 ? (
                <p className="py-3 text-center text-xs text-muted">
                  No additional parties or witnesses linked.
                </p>
              ) : (
                incident.parties.map((party) => (
                  <div
                    key={party.employeeId}
                    className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-primary">
                        {party.employeeName}
                      </p>
                      <Badge
                        tone={party.partyRole === 'injured' ? 'error' : 'neutral'}
                        className="mt-1"
                      >
                        {PARTY_ROLE_LABELS[party.partyRole]}
                      </Badge>
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void handleRemoveParty(party)}
                        className="rounded p-1 text-muted hover:text-error-600"
                        title="Remove party"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          {/* Audit Trail */}
          {canViewAudit && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <History className="h-4 w-4 text-accent-600" /> Audit History
                </CardTitle>
                <a
                  href={`/settings/audit-log?recordId=${incident.id}&module=health_safety`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent-600 hover:underline"
                >
                  Full Log <ExternalLink className="h-3 w-3" />
                </a>
              </CardHeader>
              <CardBody className="divide-y divide-[rgb(var(--border-base))]">
                {auditEntries.length === 0 ? (
                  <p className="py-3 text-center text-xs text-muted">
                    No audit entries recorded yet.
                  </p>
                ) : (
                  auditEntries.map((entry) => (
                    <div key={entry.id} className="py-2.5 text-xs first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between">
                        <Badge tone="neutral" className="capitalize">
                          {entry.action}
                        </Badge>
                        <span className="text-[11px] text-muted">
                          {new Date(entry.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1 text-secondary">
                        By{' '}
                        <span className="font-medium text-primary">
                          {entry.actor?.name ?? entry.actor?.email ?? 'System'}
                        </span>
                      </p>
                    </div>
                  ))
                )}
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      {/* MODAL: ADD INVOLVED PARTY / WITNESS */}
      <Modal
        open={partyModalOpen}
        onClose={() => setPartyModalOpen(false)}
        title="Add Involved Party or Witness"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPartyModalOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={saving || !partyEmployeeId}
              onClick={() => void handleAddParty()}
            >
              {saving ? 'Saving…' : 'Save Party'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="party-emp">Employee</Label>
            <Select
              id="party-emp"
              value={partyEmployeeId}
              onChange={(e) => setPartyEmployeeId(e.target.value)}
            >
              <option value="">Select employee…</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="party-role">Role in Incident</Label>
            <Select
              id="party-role"
              value={partyRole}
              onChange={(e) => setPartyRole(e.target.value as IncidentPartyRole)}
            >
              <option value="witness">Witness</option>
              <option value="involved">Involved</option>
              <option value="injured">Injured</option>
            </Select>
          </div>
        </div>
      </Modal>

      {/* MODAL: ADD LINKED INJURY LOG ENTRY */}
      <Modal
        open={injuryModalOpen}
        onClose={() => setInjuryModalOpen(false)}
        title="Record Linked Injury Entry"
        description={`Attach an injury record directly to ${incident.incidentNumber}.`}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setInjuryModalOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                saving ||
                !injuryEmployeeId ||
                !injuryType.trim() ||
                (requireBodyPart && !injuryBodyPart.trim())
              }
              onClick={() => void handleCreateLinkedInjury()}
            >
              {saving ? 'Saving…' : 'Save Entry'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="inj-emp">Injured Employee</Label>
            <Select
              id="inj-emp"
              value={injuryEmployeeId}
              onChange={(e) => setInjuryEmployeeId(e.target.value)}
            >
              <option value="">Select employee…</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="inj-type">Injury Type</Label>
              <Input
                id="inj-type"
                value={injuryType}
                onChange={(e) => setInjuryType(e.target.value)}
                placeholder="e.g. Sprain, Laceration, Strain"
              />
            </div>
            <div>
              <Label htmlFor="inj-body">
                Body Part {requireBodyPart && <span className="text-error-600">*</span>}
              </Label>
              <Input
                id="inj-body"
                value={injuryBodyPart}
                onChange={(e) => setInjuryBodyPart(e.target.value)}
                placeholder={requireBodyPart ? 'Required by country rule' : 'Optional'}
              />
            </div>
            <div>
              <Label htmlFor="inj-med">Medical Attention</Label>
              <Select
                id="inj-med"
                value={injuryMedical}
                onChange={(e) => setInjuryMedical(e.target.value as InjuryMedicalAttention)}
              >
                <option value="none">None</option>
                <option value="first_aid">First aid</option>
                <option value="clinic">Clinic</option>
                <option value="hospital">Hospital</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="inj-days">Days Lost</Label>
              <Input
                id="inj-days"
                type="number"
                min={0}
                value={injuryDaysLost}
                onChange={(e) => setInjuryDaysLost(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="inj-treat">Treatment Summary</Label>
            <Textarea
              id="inj-treat"
              rows={2}
              value={injuryTreatment}
              onChange={(e) => setInjuryTreatment(e.target.value)}
              placeholder="First aid rendered, clinic follow-up, or work restrictions…"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

