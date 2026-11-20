import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  ClipboardCheck,
  FileWarning,
  Filter,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import { useAuth, usePermissions } from '@hrm/portal-ui';
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
import { Toggle } from '@/components/ui/Toggle';
import { useCompany } from '@/context/CompanyContext';
import { listEmployees } from '@/lib/employees-api';
import {
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_STATUS_LABELS,
  INCIDENT_TYPE_LABELS,
  PARTY_ROLE_LABELS,
  createIncident,
  createInjuryEntry,
  getHealthSafetyRequirements,
  getHealthSafetySummary,
  listCompliance,
  listIncidents,
  listInjuryLog,
  updateCompliance,
} from '@/lib/health-safety-api';
import { ApiError } from '@/lib/tenant-api-client';
import type {
  HealthSafetyCountryRequirements,
  HealthSafetySummary,
  IncidentPartyRole,
  IncidentReportingRuleConfig,
  InjuryLogEntryRecord,
  SafetyComplianceRecordView,
  WorkplaceIncidentRecord,
  WorkplaceIncidentSeverity,
  WorkplaceIncidentStatus,
  WorkplaceIncidentType,
} from '@hrm/shared-types';

type PageTab = 'incidents' | 'injuries' | 'compliance';

export function HealthSafetyPage() {
  const { companyId } = useCompany();
  const { user } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();

  const canCreate = can('health_safety', 'create');
  const canEdit = can('health_safety', 'edit');

  const [tab, setTab] = useState<PageTab>('incidents');
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<HealthSafetySummary | null>(null);
  const [incidents, setIncidents] = useState<WorkplaceIncidentRecord[]>([]);
  const [injuries, setInjuries] = useState<InjuryLogEntryRecord[]>([]);
  const [compliance, setCompliance] = useState<SafetyComplianceRecordView[]>([]);
  const [requirements, setRequirements] = useState<HealthSafetyCountryRequirements | null>(
    null,
  );
  const [modalReportingConfig, setModalReportingConfig] =
    useState<IncidentReportingRuleConfig | null>(null);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([]);
  const [submitting, setSubmitting] = useState(false);

  // Admin Incident List Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<WorkplaceIncidentStatus | ''>('');
  const [severityFilter, setSeverityFilter] = useState<WorkplaceIncidentSeverity | ''>('');
  const [typeFilter, setTypeFilter] = useState<WorkplaceIncidentType | ''>('');
  const [regulatorOnly, setRegulatorOnly] = useState(false);

  // Report Incident Modal state
  const [reportOpen, setReportOpen] = useState(false);
  const [incidentType, setIncidentType] = useState<WorkplaceIncidentType>('near_miss');
  const [severity, setSeverity] = useState<WorkplaceIncidentSeverity>('medium');
  const [location, setLocation] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [description, setDescription] = useState('');
  const [reporterId, setReporterId] = useState('');
  const [countryDataForm, setCountryDataForm] = useState<Record<string, unknown>>({});
  const [draftParties, setDraftParties] = useState<
    Array<{ employeeId: string; partyRole: IncidentPartyRole }>
  >([]);
  const [newPartyEmployeeId, setNewPartyEmployeeId] = useState('');
  const [newPartyRole, setNewPartyRole] = useState<IncidentPartyRole>('witness');

  // Injury Modal state
  const [injuryOpen, setInjuryOpen] = useState(false);
  const [injuryEmployeeId, setInjuryEmployeeId] = useState('');
  const [injuryType, setInjuryType] = useState('');
  const [bodyPart, setBodyPart] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 200);
    return () => clearTimeout(timer);
  }, [search]);

  const loadIncidentsFiltered = useCallback(async () => {
    if (!companyId) return;
    setListLoading(true);
    try {
      const incidentRows = await listIncidents(companyId, {
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(severityFilter ? { severity: severityFilter } : {}),
        ...(typeFilter ? { incidentType: typeFilter } : {}),
        ...(regulatorOnly ? { regulatorRequiredOnly: true } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        limit: 100,
      });
      setIncidents(incidentRows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load incident list');
    } finally {
      setListLoading(false);
    }
  }, [
    companyId,
    statusFilter,
    severityFilter,
    typeFilter,
    regulatorOnly,
    debouncedSearch,
  ]);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [
        summaryRow,
        incidentRows,
        injuryRows,
        complianceRows,
        reqRow,
        employeeRows,
      ] = await Promise.all([
        getHealthSafetySummary(companyId),
        listIncidents(companyId, { limit: 100 }),
        listInjuryLog(companyId),
        listCompliance(companyId),
        getHealthSafetyRequirements(companyId),
        listEmployees(companyId),
      ]);
      setSummary(summaryRow);
      setIncidents(incidentRows);
      setInjuries(injuryRows);
      setCompliance(complianceRows);
      setRequirements(reqRow);
      setModalReportingConfig(reqRow.incidentReporting);
      setEmployees(
        employeeRows.map((emp) => ({
          id: emp.id,
          name: emp.fullName ?? `${emp.firstName} ${emp.lastName}`,
        })),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load health & safety data');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!loading && companyId) {
      void loadIncidentsFiltered();
    }
  }, [
    companyId,
    loading,
    statusFilter,
    severityFilter,
    typeFilter,
    regulatorOnly,
    debouncedSearch,
    loadIncidentsFiltered,
  ]);

  // Dynamically re-resolve rules when reporter or occurredAt changes in the Report Incident modal
  useEffect(() => {
    if (!reportOpen || !companyId) return;
    const asOfIso = occurredAt ? new Date(occurredAt).toISOString() : undefined;
    void getHealthSafetyRequirements(companyId, {
      ...(reporterId ? { employeeId: reporterId } : {}),
      ...(asOfIso ? { asOf: asOfIso } : {}),
    })
      .then((res) => setModalReportingConfig(res.incidentReporting))
      .catch(() => undefined);
  }, [reportOpen, companyId, reporterId, occurredAt]);

  const openReportModal = () => {
    const defaultReporter =
      user?.employeeId && employees.some((e) => e.id === user.employeeId)
        ? user.employeeId
        : '';
    setReporterId(defaultReporter);
    setIncidentType('near_miss');
    setSeverity('medium');
    setLocation('');
    const now = new Date();
    const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setOccurredAt(localIso);
    setDescription('');
    setCountryDataForm({});
    setDraftParties([]);
    setNewPartyEmployeeId('');
    setError(null);
    setReportOpen(true);
  };

  const handleAddDraftParty = () => {
    if (!newPartyEmployeeId) return;
    setDraftParties((prev) => [
      ...prev.filter((p) => p.employeeId !== newPartyEmployeeId),
      { employeeId: newPartyEmployeeId, partyRole: newPartyRole },
    ]);
    setNewPartyEmployeeId('');
  };

  const activeReportingSchema = modalReportingConfig ?? requirements?.incidentReporting ?? null;
  const isModalRegulatorNotifiable = Boolean(
    activeReportingSchema &&
      (activeReportingSchema.regulatorReportRequiredSeverities.includes(severity) ||
        activeReportingSchema.notifiableIncidentTypes.includes(incidentType)),
  );

  const handleReportIncident = async () => {
    if (
      !companyId ||
      !reporterId ||
      !location.trim() ||
      !occurredAt ||
      !description.trim()
    ) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await createIncident(companyId, {
        incidentType,
        severity,
        location: location.trim(),
        occurredAt: new Date(occurredAt).toISOString(),
        description: description.trim(),
        reportedByEmployeeId: reporterId,
        ...(draftParties.length > 0 ? { parties: draftParties } : {}),
        countrySpecificData: countryDataForm,
      });
      setReportOpen(false);
      navigate(`/talent/health-safety/incidents/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to report incident');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateInjury = async () => {
    if (!companyId || !injuryEmployeeId || !injuryType.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await createInjuryEntry(companyId, {
        employeeId: injuryEmployeeId,
        injuryType: injuryType.trim(),
        bodyPart: bodyPart.trim() || undefined,
        recordedAt: new Date().toISOString(),
      });
      setInjuryOpen(false);
      setInjuryType('');
      setBodyPart('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add injury log entry');
    } finally {
      setSubmitting(false);
    }
  };

  const markCompliant = async (record: SafetyComplianceRecordView) => {
    setSubmitting(true);
    setError(null);
    try {
      await updateCompliance(record.id, {
        status: 'compliant',
        completedAt: new Date().toISOString(),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update compliance');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="h-8 w-8 animate-spin text-accent-600" />
      </div>
    );
  }

  const regulatorName = requirements?.regulatorName ?? null;
  const requireBodyPart = requirements?.injuryLogRequireBodyPart ?? false;

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 dark:bg-accent-950/40">
            <ShieldCheck className="h-5 w-5 text-accent-600 dark:text-accent-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary">Health &amp; Safety</h1>
            <p className="text-sm text-secondary">
              Incident register, country-specific statutory reporting, injury log, and compliance
              {regulatorName ? ` · Regulator: ${regulatorName}` : ''}
            </p>
          </div>
        </div>
        {canCreate && (
          <Button onClick={openReportModal}>
            <Plus className="h-4 w-4" /> Report incident
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-900/50 dark:bg-error-950/30 dark:text-error-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Open incidents', value: summary?.openIncidentCount ?? 0 },
          { label: 'Regulator reports due', value: summary?.regulatorReportsDueCount ?? 0 },
          { label: 'Injuries this year', value: summary?.injuryLogCountThisYear ?? 0 },
          {
            label: 'Compliance',
            value: `${summary?.complianceCompliantPercent ?? 0}%`,
            note: `${summary?.daysIncidentFree ?? 0} days incident-free`,
          },
        ].map((metric) => (
          <Card key={metric.label}>
            <CardBody className="p-4">
              <p className="text-xs text-muted">{metric.label}</p>
              <p className="mt-1 text-2xl font-bold text-primary">{metric.value}</p>
              {'note' in metric && metric.note ? (
                <p className="mt-0.5 text-[11px] text-secondary">{metric.note}</p>
              ) : null}
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-base">
        {(
          [
            ['incidents', 'Incident Register', FileWarning],
            ['injuries', 'Injury Log', AlertTriangle],
            ['compliance', 'Safety Compliance', ClipboardCheck],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === id
                ? 'border-accent-600 text-accent-600'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* =====================================================================
          TAB 1: INCIDENT REPORT LIST (ADMIN VIEW)
         ===================================================================== */}
      {tab === 'incidents' && (
        <div className="space-y-4">
          {/* Filters Toolbar */}
          <div className="surface flex flex-col gap-3 rounded-xl border border-base p-4 shadow-card lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 lg:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search incident #, location, or description…"
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-muted" />
              <Select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as WorkplaceIncidentStatus | '')
                }
                className="w-40"
              >
                <option value="">All statuses</option>
                {Object.entries(INCIDENT_STATUS_LABELS).map(([val, lbl]) => (
                  <option key={val} value={val}>
                    {lbl}
                  </option>
                ))}
              </Select>

              <Select
                value={severityFilter}
                onChange={(e) =>
                  setSeverityFilter(e.target.value as WorkplaceIncidentSeverity | '')
                }
                className="w-36"
              >
                <option value="">All severities</option>
                {Object.entries(INCIDENT_SEVERITY_LABELS).map(([val, lbl]) => (
                  <option key={val} value={val}>
                    {lbl}
                  </option>
                ))}
              </Select>

              <Select
                value={typeFilter}
                onChange={(e) =>
                  setTypeFilter(e.target.value as WorkplaceIncidentType | '')
                }
                className="w-40"
              >
                <option value="">All types</option>
                {Object.entries(INCIDENT_TYPE_LABELS).map(([val, lbl]) => (
                  <option key={val} value={val}>
                    {lbl}
                  </option>
                ))}
              </Select>

              <div className="flex items-center gap-2 rounded-lg border border-base bg-[rgb(var(--bg-muted))]/50 px-3 py-1.5">
                <Toggle
                  checked={regulatorOnly}
                  size="sm"
                  label="Regulator notifiable only"
                  onChange={setRegulatorOnly}
                />
                <span className="text-xs font-medium text-secondary">
                  Regulator only
                </span>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => void loadIncidentsFiltered()}
                disabled={listLoading}
                title="Refresh incident register"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${listLoading ? 'animate-spin' : ''}`}
                />
              </Button>
            </div>
          </div>

          {/* Incident Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Incident Register</CardTitle>
                <p className="mt-0.5 text-xs text-muted">
                  Select any incident to inspect details, complete rule-resolved country reporting fields, or manage investigation workflow.
                </p>
              </div>
              <span className="text-xs text-muted">
                {incidents.length} record(s)
              </span>
            </CardHeader>
            <CardBody className="overflow-x-auto p-0">
              <table className="w-full min-w-[900px] text-left">
                <thead className="bg-[rgb(var(--bg-muted))] text-[11px] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-2.5">Incident</th>
                    <th className="px-4 py-2.5">Reporter &amp; Parties</th>
                    <th className="px-4 py-2.5">When / Where</th>
                    <th className="px-4 py-2.5">Severity</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Regulator Obligation</th>
                    <th className="px-4 py-2.5 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border-base))]">
                  {incidents.map((incident) => {
                    const isOverdue =
                      incident.regulatorReportRequired &&
                      !incident.regulatorReportSubmittedAt &&
                      incident.regulatorReportDueAt != null &&
                      new Date(incident.regulatorReportDueAt).getTime() < Date.now();
                    return (
                      <tr
                        key={incident.id}
                        onClick={() =>
                          navigate(`/talent/health-safety/incidents/${incident.id}`)
                        }
                        className="cursor-pointer transition-colors hover:bg-[rgb(var(--bg-hover))]"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-accent-600 dark:text-accent-400">
                              {incident.incidentNumber}
                            </span>
                            <span className="text-sm font-medium text-primary">
                              {INCIDENT_TYPE_LABELS[incident.incidentType]}
                            </span>
                          </div>
                          <p className="mt-0.5 line-clamp-1 max-w-xs text-xs text-muted">
                            {incident.description}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <p className="font-medium text-primary">
                            {incident.reportedByEmployeeName}
                          </p>
                          {incident.parties.length > 0 && (
                            <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted">
                              <Users className="h-3 w-3" /> {incident.parties.length}{' '}
                              linked
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-secondary">
                          <div className="flex items-center gap-1 font-medium text-primary">
                            <span>{incident.location}</span>
                            {incident.gpsLat != null && incident.gpsLng != null && (
                              <span
                                title="GPS captured"
                                className="inline-flex items-center text-accent-600"
                              >
                                <MapPin className="h-3 w-3" />
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-muted">
                            {new Date(incident.occurredAt).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={INCIDENT_SEVERITY_TONES[incident.severity]} dot>
                            {INCIDENT_SEVERITY_LABELS[incident.severity]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={INCIDENT_STATUS_TONES[incident.status]} dot>
                            {INCIDENT_STATUS_LABELS[incident.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {incident.regulatorReportRequired ? (
                            incident.regulatorReportSubmittedAt ? (
                              <div className="space-y-0.5">
                                <Badge tone="success">Submitted</Badge>
                                {incident.regulatorReferenceNumber && (
                                  <p className="text-[11px] text-muted">
                                    Ref: {incident.regulatorReferenceNumber}
                                  </p>
                                )}
                              </div>
                            ) : isOverdue ? (
                              <Badge tone="error">Overdue</Badge>
                            ) : (
                              <div className="space-y-0.5">
                                <Badge tone="warning">Required</Badge>
                                {incident.regulatorReportDueAt && (
                                  <p className="text-[11px] text-muted">
                                    Due{' '}
                                    {new Date(
                                      incident.regulatorReportDueAt,
                                    ).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            )
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/talent/health-safety/incidents/${incident.id}`);
                            }}
                          >
                            View <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {incidents.length === 0 && (
                <p className="p-10 text-center text-sm text-muted">
                  No incidents match the active filters.
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {/* =====================================================================
          TAB 2: INJURY LOG
         ===================================================================== */}
      {tab === 'injuries' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Injury log</CardTitle>
            {canCreate && (
              <Button size="sm" onClick={() => setInjuryOpen(true)}>
                <Plus className="h-4 w-4" /> Add entry
              </Button>
            )}
          </CardHeader>
          <CardBody className="divide-y divide-[rgb(var(--border-base))]">
            {injuries.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-primary">
                    {entry.employeeName} — {entry.injuryType}
                  </p>
                  <p className="text-xs text-muted">
                    {entry.bodyPart ?? 'Body part not recorded'} ·{' '}
                    {new Date(entry.recordedAt).toLocaleDateString()}
                    {entry.incidentNumber ? ` · ${entry.incidentNumber}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="neutral">{entry.medicalAttention.replace(/_/g, ' ')}</Badge>
                  {entry.incidentId && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        navigate(`/talent/health-safety/incidents/${entry.incidentId}`)
                      }
                    >
                      Incident
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {injuries.length === 0 && (
              <p className="py-8 text-center text-sm text-muted">
                No injury log entries.
              </p>
            )}
          </CardBody>
        </Card>
      )}

      {/* =====================================================================
          TAB 3: SAFETY COMPLIANCE
         ===================================================================== */}
      {tab === 'compliance' && (
        <Card>
          <CardHeader>
            <CardTitle>Safety compliance</CardTitle>
            <p className="mt-1 text-xs text-muted">
              Requirements resolved from the Rule Resolver chain (`health_safety` rules).
            </p>
          </CardHeader>
          <CardBody className="divide-y divide-[rgb(var(--border-base))]">
            {compliance.map((record) => (
              <div
                key={record.id}
                className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center"
              >
                <div>
                  <p className="text-sm font-medium text-primary">{record.title}</p>
                  <p className="text-xs text-muted">
                    {record.requirementType} · due {record.dueDate ?? '—'} ·{' '}
                    {record.status}
                  </p>
                </div>
                {record.status === 'compliant' ? (
                  <Badge tone="success">Compliant</Badge>
                ) : canEdit ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={submitting}
                    onClick={() => void markCompliant(record)}
                  >
                    Mark compliant
                  </Button>
                ) : null}
              </div>
            ))}
            {compliance.length === 0 && (
              <p className="py-8 text-center text-sm text-muted">
                No compliance records.
              </p>
            )}
          </CardBody>
        </Card>
      )}

      {/* =====================================================================
          MODAL: REPORT INCIDENT (WITH RULE-RESOLVED COUNTRY REPORTING FIELDS)
         ===================================================================== */}
      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Report Workplace Incident"
        description="Log a workplace incident with statutory reporting fields resolved dynamically from active country & company rules."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                submitting ||
                !reporterId ||
                !location.trim() ||
                !occurredAt ||
                !description.trim()
              }
              onClick={() => void handleReportIncident()}
            >
              {submitting ? 'Submitting…' : 'Submit Incident Report'}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {isModalRegulatorNotifiable && activeReportingSchema && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              <p className="font-semibold">
                Mandatory Regulator Notification Triggered
              </p>
              <p className="mt-0.5">
                Under{' '}
                <span className="font-semibold">
                  {activeReportingSchema.regulatorName ?? 'applicable statutory'}
                </span>{' '}
                rules, reporting this incident requires regulator notification within{' '}
                <span className="font-semibold">
                  {activeReportingSchema.regulatorReportDeadlineHours} hours
                </span>
                .
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="rep-type">Incident Type</Label>
              <Select
                id="rep-type"
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value as WorkplaceIncidentType)}
              >
                {Object.entries(INCIDENT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="rep-sev">Severity</Label>
              <Select
                id="rep-sev"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as WorkplaceIncidentSeverity)}
              >
                {Object.entries(INCIDENT_SEVERITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="rep-reporter">Reporter</Label>
              <Select
                id="rep-reporter"
                value={reporterId}
                onChange={(e) => setReporterId(e.target.value)}
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
              <Label htmlFor="rep-occurred">Occurred Date &amp; Time</Label>
              <Input
                id="rep-occurred"
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="rep-loc">Location / Work Area</Label>
            <Input
              id="rep-loc"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Warehouse Bay 3, Level 2 Production Floor"
            />
          </div>

          <div>
            <Label htmlFor="rep-desc">Incident Description</Label>
            <Textarea
              id="rep-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what happened, equipment involved, and immediate circumstances…"
            />
          </div>

          {/* Dynamic Rule-Resolver Country-Specific Fields */}
          {activeReportingSchema && activeReportingSchema.reportingFields.length > 0 && (
            <div className="space-y-3 rounded-xl border border-base bg-[rgb(var(--bg-muted))]/35 p-4">
              <div>
                <p className="text-sm font-semibold text-primary">
                  Country-Specific Reporting Fields
                  {activeReportingSchema.regulatorName
                    ? ` (${activeReportingSchema.regulatorName})`
                    : ''}
                </p>
                <div className="mt-1">
                  <RuleProvenanceBadges
                    layers={activeReportingSchema.resolvedLayers}
                    asOf={activeReportingSchema.resolvedAsOf}
                  />
                </div>
              </div>

              <DynamicReportingFields
                fields={activeReportingSchema.reportingFields}
                values={countryDataForm}
                onChange={setCountryDataForm}
                regulatorRequired={isModalRegulatorNotifiable}
                idPrefix="modal-country-field"
              />
            </div>
          )}

          {/* Optional Parties & Witnesses */}
          <div className="space-y-2 rounded-xl border border-base p-3.5">
            <Label className="text-xs font-semibold">
              Involved Parties &amp; Witnesses (Optional)
            </Label>
            <div className="flex flex-wrap gap-2">
              <Select
                value={newPartyEmployeeId}
                onChange={(e) => setNewPartyEmployeeId(e.target.value)}
                className="min-w-[180px] flex-1"
              >
                <option value="">Select colleague…</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </Select>
              <Select
                value={newPartyRole}
                onChange={(e) => setNewPartyRole(e.target.value as IncidentPartyRole)}
                className="w-36"
              >
                <option value="witness">Witness</option>
                <option value="involved">Involved</option>
                <option value="injured">Injured</option>
              </Select>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!newPartyEmployeeId}
                onClick={handleAddDraftParty}
              >
                Add
              </Button>
            </div>
            {draftParties.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {draftParties.map((party) => {
                  const name =
                    employees.find((e) => e.id === party.employeeId)?.name ??
                    party.employeeId;
                  return (
                    <span
                      key={party.employeeId}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-base bg-[rgb(var(--bg-muted))] px-2.5 py-1 text-xs"
                    >
                      <span className="font-medium text-primary">{name}</span>
                      <span className="text-muted">
                        ({PARTY_ROLE_LABELS[party.partyRole]})
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setDraftParties((prev) =>
                            prev.filter((p) => p.employeeId !== party.employeeId),
                          )
                        }
                        className="text-muted hover:text-error-600"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* =====================================================================
          MODAL: ADD STANDALONE INJURY LOG ENTRY
         ===================================================================== */}
      <Modal
        open={injuryOpen}
        onClose={() => setInjuryOpen(false)}
        title="Add injury log entry"
      >
        <div className="space-y-4">
          <div>
            <Label>Employee</Label>
            <Select
              value={injuryEmployeeId}
              onChange={(e) => setInjuryEmployeeId(e.target.value)}
            >
              <option value="">Select employee</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Injury type</Label>
            <Input
              value={injuryType}
              onChange={(e) => setInjuryType(e.target.value)}
            />
          </div>
          <div>
            <Label>
              Body part {requireBodyPart && <span className="text-error-600">*</span>}
            </Label>
            <Input
              value={bodyPart}
              onChange={(e) => setBodyPart(e.target.value)}
              placeholder={
                requireBodyPart ? 'Required by active country rules' : 'Optional'
              }
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setInjuryOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                submitting ||
                !injuryEmployeeId ||
                !injuryType.trim() ||
                (requireBodyPart && !bodyPart.trim())
              }
              onClick={() => void handleCreateInjury()}
            >
              {submitting ? 'Saving…' : 'Save entry'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

