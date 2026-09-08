import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ClipboardCheck,
  FileWarning,
  Loader2,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { useCompany } from '@/context/CompanyContext';
import { listEmployees } from '@/lib/employees-api';
import {
  createIncident,
  createInjuryEntry,
  getHealthSafetyRequirements,
  getHealthSafetySummary,
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_STATUS_LABELS,
  INCIDENT_TYPE_LABELS,
  listCompliance,
  listIncidents,
  listInjuryLog,
  updateCompliance,
  updateIncident,
} from '@/lib/health-safety-api';
import { ApiError } from '@/lib/tenant-api-client';
import type {
  HealthSafetySummary,
  InjuryLogEntryRecord,
  SafetyComplianceRecordView,
  WorkplaceIncidentRecord,
  WorkplaceIncidentSeverity,
  WorkplaceIncidentStatus,
  WorkplaceIncidentType,
} from '@hrm/shared-types';

type PageTab = 'incidents' | 'injuries' | 'compliance';

const severityTone: Record<WorkplaceIncidentSeverity, 'neutral' | 'warning' | 'error'> = {
  low: 'neutral',
  medium: 'warning',
  high: 'error',
  critical: 'error',
};

const statusTone: Record<WorkplaceIncidentStatus, 'info' | 'warning' | 'success' | 'neutral'> = {
  reported: 'info',
  under_investigation: 'warning',
  resolved: 'success',
  closed: 'neutral',
};

export function HealthSafetyPage() {
  const { companyId } = useCompany();
  const [tab, setTab] = useState<PageTab>('incidents');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<HealthSafetySummary | null>(null);
  const [incidents, setIncidents] = useState<WorkplaceIncidentRecord[]>([]);
  const [injuries, setInjuries] = useState<InjuryLogEntryRecord[]>([]);
  const [compliance, setCompliance] = useState<SafetyComplianceRecordView[]>([]);
  const [regulatorName, setRegulatorName] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([]);
  const [submitting, setSubmitting] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [incidentType, setIncidentType] = useState<WorkplaceIncidentType>('near_miss');
  const [severity, setSeverity] = useState<WorkplaceIncidentSeverity>('medium');
  const [location, setLocation] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [description, setDescription] = useState('');
  const [reporterId, setReporterId] = useState('');

  const [injuryOpen, setInjuryOpen] = useState(false);
  const [injuryEmployeeId, setInjuryEmployeeId] = useState('');
  const [injuryType, setInjuryType] = useState('');
  const [bodyPart, setBodyPart] = useState('');

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [summaryRow, incidentRows, injuryRows, complianceRows, requirements, employeeRows] =
        await Promise.all([
          getHealthSafetySummary(companyId),
          listIncidents(companyId),
          listInjuryLog(companyId),
          listCompliance(companyId),
          getHealthSafetyRequirements(companyId),
          listEmployees(companyId),
        ]);
      setSummary(summaryRow);
      setIncidents(incidentRows);
      setInjuries(injuryRows);
      setCompliance(complianceRows);
      setRegulatorName(requirements.regulatorName);
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

  const handleReportIncident = async () => {
    if (!companyId || !reporterId || !location.trim() || !occurredAt || !description.trim()) return;
    setSubmitting(true);
    try {
      await createIncident(companyId, {
        incidentType,
        severity,
        location: location.trim(),
        occurredAt: new Date(occurredAt).toISOString(),
        description: description.trim(),
        reportedByEmployeeId: reporterId,
      });
      setReportOpen(false);
      setLocation('');
      setDescription('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to report incident');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateInjury = async () => {
    if (!companyId || !injuryEmployeeId || !injuryType.trim()) return;
    setSubmitting(true);
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

  const advanceIncident = async (incident: WorkplaceIncidentRecord) => {
    const next: WorkplaceIncidentStatus =
      incident.status === 'reported'
        ? 'under_investigation'
        : incident.status === 'under_investigation'
          ? 'resolved'
          : 'closed';
    setSubmitting(true);
    try {
      await updateIncident(incident.id, { status: next });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update incident');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent-600" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-accent-50 dark:bg-accent-950/40 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-accent-600 dark:text-accent-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary">Health & Safety</h1>
            <p className="text-sm text-secondary">
              Incidents, injury log and compliance
              {regulatorName ? ` · Regulator: ${regulatorName}` : ''}
            </p>
          </div>
        </div>
        <Button onClick={() => setReportOpen(true)}>
          <Plus className="h-4 w-4" /> Report incident
        </Button>
      </div>

      {error ? <p className="text-sm text-error-600">{error}</p> : null}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
              <p className="text-2xl font-bold text-primary mt-1">{metric.value}</p>
              {'note' in metric && metric.note ? (
                <p className="text-[11px] text-secondary mt-0.5">{metric.note}</p>
              ) : null}
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-1 border-b border-base overflow-x-auto">
        {(
          [
            ['incidents', 'Incidents', FileWarning],
            ['injuries', 'Injury log', AlertTriangle],
            ['compliance', 'Compliance', ClipboardCheck],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
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

      {tab === 'incidents' && (
        <Card>
          <CardHeader>
            <CardTitle>Incident register</CardTitle>
          </CardHeader>
          <CardBody className="p-0 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-[rgb(var(--bg-muted))] text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2.5">Incident</th>
                  <th className="px-4 py-2.5">When / where</th>
                  <th className="px-4 py-2.5">Severity</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Regulator</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {incidents.map((incident) => (
                  <tr key={incident.id}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-primary">
                        {INCIDENT_TYPE_LABELS[incident.incidentType]}
                      </p>
                      <p className="text-xs text-muted">
                        {incident.incidentNumber} · {incident.reportedByEmployeeName}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-secondary">
                      {incident.location}
                      <br />
                      {new Date(incident.occurredAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={severityTone[incident.severity]} dot>
                        {INCIDENT_SEVERITY_LABELS[incident.severity]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone[incident.status]} dot>
                        {INCIDENT_STATUS_LABELS[incident.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {incident.regulatorReportRequired ? (
                        <Badge tone="warning">Required</Badge>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {incident.status !== 'closed' ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={submitting}
                          onClick={() => void advanceIncident(incident)}
                        >
                          Advance
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {incidents.length === 0 ? (
              <p className="p-8 text-sm text-muted text-center">No incidents recorded.</p>
            ) : null}
          </CardBody>
        </Card>
      )}

      {tab === 'injuries' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Injury log</CardTitle>
            <Button size="sm" onClick={() => setInjuryOpen(true)}>
              <Plus className="h-4 w-4" /> Add entry
            </Button>
          </CardHeader>
          <CardBody className="divide-y divide-[rgb(var(--border-base))]">
            {injuries.map((entry) => (
              <div key={entry.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2">
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
                <Badge tone="neutral">{entry.medicalAttention.replace(/_/g, ' ')}</Badge>
              </div>
            ))}
            {injuries.length === 0 ? (
              <p className="py-8 text-sm text-muted text-center">No injury log entries.</p>
            ) : null}
          </CardBody>
        </Card>
      )}

      {tab === 'compliance' && (
        <Card>
          <CardHeader>
            <CardTitle>Safety compliance</CardTitle>
            <p className="text-xs text-muted mt-1">
              Requirements synced from country health_safety rules (not hard-coded).
            </p>
          </CardHeader>
          <CardBody className="divide-y divide-[rgb(var(--border-base))]">
            {compliance.map((record) => (
              <div
                key={record.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <p className="text-sm font-medium text-primary">{record.title}</p>
                  <p className="text-xs text-muted">
                    {record.requirementType} · due{' '}
                    {record.dueDate ?? '—'} · {record.status}
                  </p>
                </div>
                {record.status !== 'compliant' ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={submitting}
                    onClick={() => void markCompliant(record)}
                  >
                    Mark compliant
                  </Button>
                ) : (
                  <Badge tone="success">Compliant</Badge>
                )}
              </div>
            ))}
            {compliance.length === 0 ? (
              <p className="py-8 text-sm text-muted text-center">No compliance records.</p>
            ) : null}
          </CardBody>
        </Card>
      )}

      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Report incident" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Type</Label>
              <Select
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
              <Label>Severity</Label>
              <Select
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
              <Label>Reporter</Label>
              <Select value={reporterId} onChange={(e) => setReporterId(e.target.value)}>
                <option value="">Select employee</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Date & time</Label>
              <Input
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                submitting || !reporterId || !location.trim() || !occurredAt || !description.trim()
              }
              onClick={() => void handleReportIncident()}
            >
              {submitting ? 'Submitting…' : 'Submit report'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={injuryOpen} onClose={() => setInjuryOpen(false)} title="Add injury log entry">
        <div className="space-y-4">
          <div>
            <Label>Employee</Label>
            <Select value={injuryEmployeeId} onChange={(e) => setInjuryEmployeeId(e.target.value)}>
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
            <Input value={injuryType} onChange={(e) => setInjuryType(e.target.value)} />
          </div>
          <div>
            <Label>Body part</Label>
            <Input value={bodyPart} onChange={(e) => setBodyPart(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setInjuryOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={submitting || !injuryEmployeeId || !injuryType.trim()}
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
