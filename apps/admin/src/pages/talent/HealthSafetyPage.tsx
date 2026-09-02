import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileWarning,
  Filter,
  GraduationCap,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Upload,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Avatar, Toggle } from '@/components/ui/Toggle';

type SafetyTab = 'incidents' | 'training' | 'inspections';
type Severity = 'Low' | 'Medium' | 'High' | 'Critical';
type IncidentStatus = 'Reported' | 'Under Investigation' | 'Resolved';

interface Incident {
  id: string;
  type: string;
  location: string;
  occurredAt: string;
  severity: Severity;
  status: IncidentStatus;
  reportedBy: string;
  description: string;
  employees: string[];
}

interface InspectionItem {
  id: number;
  area: string;
  item: string;
  passed: boolean;
  evidence?: string;
}

const employees = ['Amina Rahman', 'Daniel Kim', 'Ibrahim Khan', 'Maya Patel', 'Noah Williams'];

const initialIncidents: Incident[] = [
  { id: 'INC-1042', type: 'Near miss', location: 'Warehouse · Bay 3', occurredAt: '2026-08-24 14:35', severity: 'Medium', status: 'Under Investigation', reportedBy: 'Maya Patel', description: 'Pallet shifted while being lifted; area was isolated immediately.', employees: ['Daniel Kim'] },
  { id: 'INC-1041', type: 'Slip / trip', location: 'Head Office · Level 2', occurredAt: '2026-08-21 09:10', severity: 'Low', status: 'Resolved', reportedBy: 'Amina Rahman', description: 'Wet floor near kitchenette without warning signage.', employees: ['Amina Rahman'] },
  { id: 'INC-1040', type: 'Equipment damage', location: 'Plant · Line A', occurredAt: '2026-08-18 17:45', severity: 'High', status: 'Reported', reportedBy: 'Ibrahim Khan', description: 'Conveyor guard loosened during routine operation.', employees: ['Ibrahim Khan', 'Noah Williams'] },
  { id: 'INC-1039', type: 'First aid', location: 'Warehouse · Loading dock', occurredAt: '2026-08-11 11:20', severity: 'Medium', status: 'Resolved', reportedBy: 'Daniel Kim', description: 'Minor hand abrasion treated by on-site first aider.', employees: ['Daniel Kim'] },
];

const departments = [
  { name: 'Engineering', complete: 96, trained: 48, total: 50 },
  { name: 'Operations', complete: 88, trained: 44, total: 50 },
  { name: 'Sales', complete: 92, trained: 35, total: 38 },
  { name: 'People & Culture', complete: 100, trained: 16, total: 16 },
  { name: 'Warehouse', complete: 78, trained: 39, total: 50 },
];

const initialInspection: InspectionItem[] = [
  { id: 1, area: 'Emergency readiness', item: 'Emergency exits are clear and correctly signed', passed: true },
  { id: 2, area: 'Fire safety', item: 'Extinguishers are accessible and within service date', passed: true },
  { id: 3, area: 'Equipment', item: 'Machine guards are secure and undamaged', passed: false },
  { id: 4, area: 'Housekeeping', item: 'Walkways are clear of spills and obstructions', passed: true },
  { id: 5, area: 'PPE', item: 'Required PPE is available and in usable condition', passed: false },
  { id: 6, area: 'First aid', item: 'First-aid kits are stocked and seals are intact', passed: true },
];

const severityTone: Record<Severity, 'neutral' | 'warning' | 'error'> = {
  Low: 'neutral',
  Medium: 'warning',
  High: 'error',
  Critical: 'error',
};

const statusTone: Record<IncidentStatus, 'info' | 'warning' | 'success'> = {
  Reported: 'info',
  'Under Investigation': 'warning',
  Resolved: 'success',
};

const tabs: { id: SafetyTab; label: string; icon: typeof FileWarning }[] = [
  { id: 'incidents', label: 'Incident register', icon: FileWarning },
  { id: 'training', label: 'Training compliance', icon: GraduationCap },
  { id: 'inspections', label: 'Safety inspections', icon: ClipboardCheck },
];

export function HealthSafetyPage() {
  const [activeTab, setActiveTab] = useState<SafetyTab>('incidents');
  const [incidents, setIncidents] = useState(initialIncidents);
  const [reportOpen, setReportOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | IncidentStatus>('All');
  const [severityFilter, setSeverityFilter] = useState<'All' | Severity>('All');
  const [inspection, setInspection] = useState(initialInspection);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [photoName, setPhotoName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);

  const filteredIncidents = useMemo(() => incidents.filter((incident) => {
    const query = search.toLowerCase();
    const matchesSearch = !query || `${incident.id} ${incident.type} ${incident.location} ${incident.reportedBy}`.toLowerCase().includes(query);
    return matchesSearch
      && (statusFilter === 'All' || incident.status === statusFilter)
      && (severityFilter === 'All' || incident.severity === severityFilter);
  }), [incidents, search, severityFilter, statusFilter]);

  const trainingOverall = Math.round(departments.reduce((sum, department) => sum + department.trained, 0)
    / departments.reduce((sum, department) => sum + department.total, 0) * 100);
  const passedCount = inspection.filter((item) => item.passed).length;

  const handleReport = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const occurred = String(form.get('occurredAt') || '').replace('T', ' ');
    const incident: Incident = {
      id: `INC-${1043 + incidents.length - initialIncidents.length}`,
      type: String(form.get('type')),
      location: String(form.get('location')),
      occurredAt: occurred,
      severity: form.get('severity') as Severity,
      status: 'Reported',
      reportedBy: 'Alex Morgan',
      description: String(form.get('description')),
      employees: selectedEmployees,
    };
    setIncidents((current) => [incident, ...current]);
    setSubmitted(true);
    window.setTimeout(() => {
      setReportOpen(false);
      setSubmitted(false);
      setSelectedEmployees([]);
      setPhotoName('');
    }, 700);
  };

  const attachEvidence = (id: number, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setInspection((items) => items.map((item) => item.id === id ? { ...item, evidence: file.name } : item));
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-accent-50 dark:bg-accent-950/40 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-accent-600 dark:text-accent-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-primary">Health & Safety</h1>
              <p className="text-sm text-secondary">Incidents, training compliance and workplace inspections</p>
            </div>
          </div>
        </div>
        <Button onClick={() => setReportOpen(true)}><Plus className="h-4 w-4" /> Report incident</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Open incidents', value: incidents.filter((item) => item.status !== 'Resolved').length, note: 'Requires attention', icon: AlertTriangle, tone: 'text-warning-600 bg-warning-50 dark:bg-warning-950/40' },
          { label: 'Training compliance', value: `${trainingOverall}%`, note: '182 of 204 trained', icon: GraduationCap, tone: 'text-accent-600 bg-accent-50 dark:bg-accent-950/40' },
          { label: 'Inspection score', value: `${Math.round(passedCount / inspection.length * 100)}%`, note: `${passedCount} of ${inspection.length} passed`, icon: ClipboardCheck, tone: 'text-success-600 bg-success-50 dark:bg-success-950/40' },
          { label: 'Days incident-free', value: '12', note: 'Record: 47 days', icon: BarChart3, tone: 'text-sky-600 bg-sky-50 dark:bg-sky-950/40' },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label}>
              <CardBody className="p-4 flex items-start justify-between gap-2">
                <div><p className="text-xs text-muted">{metric.label}</p><p className="text-2xl font-bold text-primary mt-1">{metric.value}</p><p className="text-[11px] text-secondary mt-0.5">{metric.note}</p></div>
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${metric.tone}`}><Icon className="h-4 w-4" /></div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center gap-1 border-b border-base overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.id ? 'border-accent-600 text-accent-600' : 'border-transparent text-secondary hover:text-primary'}`}>
              <Icon className="h-4 w-4" />{tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'incidents' && (
        <Card>
          <CardHeader className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div><CardTitle>Incident register</CardTitle><p className="text-xs text-muted mt-0.5">{filteredIncidents.length} records shown</p></div>
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-48 flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search incidents..." className="h-8 pl-8 text-xs" />
              </div>
              <div className="relative">
                <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none" />
                <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'All' | IncidentStatus)} className="h-8 pl-8 py-0 text-xs">
                  <option>All</option><option>Reported</option><option>Under Investigation</option><option>Resolved</option>
                </Select>
              </div>
              <Select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value as 'All' | Severity)} className="h-8 py-0 text-xs w-32">
                <option>All</option><option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
              </Select>
            </div>
          </CardHeader>
          <CardBody className="p-0 overflow-x-auto">
            <table className="w-full min-w-[860px] text-left">
              <thead className="bg-[rgb(var(--bg-muted))] text-[11px] uppercase tracking-wide text-muted">
                <tr><th className="px-4 py-2.5 font-medium">Incident</th><th className="px-4 py-2.5 font-medium">Location / time</th><th className="px-4 py-2.5 font-medium">Severity</th><th className="px-4 py-2.5 font-medium">People involved</th><th className="px-4 py-2.5 font-medium">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {filteredIncidents.map((incident) => (
                  <tr key={incident.id} className="hover:bg-[rgb(var(--bg-hover))] transition-colors">
                    <td className="px-4 py-3"><p className="text-sm font-medium text-primary">{incident.type}</p><p className="text-xs text-muted">{incident.id} · by {incident.reportedBy}</p></td>
                    <td className="px-4 py-3"><p className="text-xs text-secondary flex items-center gap-1"><MapPin className="h-3 w-3" />{incident.location}</p><p className="text-xs text-muted flex items-center gap-1 mt-1"><Clock3 className="h-3 w-3" />{incident.occurredAt}</p></td>
                    <td className="px-4 py-3"><Badge tone={severityTone[incident.severity]} dot>{incident.severity}</Badge></td>
                    <td className="px-4 py-3"><div className="flex -space-x-1">{incident.employees.map((name) => <Avatar key={name} name={name} size="sm" className="ring-2 ring-[rgb(var(--bg-surface))]" />)}{incident.employees.length === 0 && <span className="text-xs text-muted">None</span>}</div></td>
                    <td className="px-4 py-3"><Badge tone={statusTone[incident.status]} dot>{incident.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredIncidents.length === 0 && <div className="py-10 text-center text-sm text-muted">No incidents match these filters.</div>}
          </CardBody>
        </Card>
      )}

      {activeTab === 'training' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader><CardTitle>Overall compliance</CardTitle></CardHeader>
            <CardBody className="flex flex-col items-center py-7">
              <div className="relative h-36 w-36 rounded-full flex items-center justify-center" style={{ background: `conic-gradient(rgb(var(--accent-600)) ${trainingOverall}%, rgb(var(--bg-muted)) 0)` }}>
                <div className="h-28 w-28 rounded-full surface flex flex-col items-center justify-center"><span className="text-3xl font-bold text-primary">{trainingOverall}%</span><span className="text-xs text-muted">compliant</span></div>
              </div>
              <Badge tone="warning" className="mt-5">22 employees overdue</Badge>
            </CardBody>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader className="flex items-center justify-between"><div><CardTitle>Compliance by department</CardTitle><p className="text-xs text-muted mt-0.5">Mandatory safety induction · 2026 cycle</p></div><Button variant="secondary" size="sm">Send reminders</Button></CardHeader>
            <CardBody className="space-y-4">
              {departments.map((department) => (
                <div key={department.name}>
                  <div className="flex items-center justify-between text-xs mb-1.5"><span className="font-medium text-primary">{department.name}</span><span className="text-secondary">{department.trained}/{department.total} · <strong>{department.complete}%</strong></span></div>
                  <div className="h-2 rounded-full bg-[rgb(var(--bg-muted))] overflow-hidden"><div className={`h-full rounded-full ${department.complete < 85 ? 'bg-warning-500' : 'bg-accent-600'}`} style={{ width: `${department.complete}%` }} /></div>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      )}

      {activeTab === 'inspections' && (
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div><CardTitle>Monthly workplace inspection</CardTitle><p className="text-xs text-muted mt-0.5">Warehouse & operations · Due 31 Aug 2026</p></div>
            <div className="flex items-center gap-2"><Badge tone={passedCount === inspection.length ? 'success' : 'warning'}>{passedCount}/{inspection.length} passed</Badge><Button size="sm">Complete inspection</Button></div>
          </CardHeader>
          <CardBody className="p-0 divide-y divide-[rgb(var(--border-base))]">
            {inspection.map((item) => (
              <div key={item.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className={`h-8 w-8 rounded-lg shrink-0 flex items-center justify-center ${item.passed ? 'bg-success-50 text-success-600 dark:bg-success-950/40' : 'bg-error-50 text-error-600 dark:bg-error-950/40'}`}>
                  {item.passed ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                </div>
                <div className="flex-1"><p className="text-xs text-muted">{item.area}</p><p className="text-sm font-medium text-primary">{item.item}</p>{item.evidence && <p className="text-xs text-accent-600 mt-1 flex items-center gap-1"><Camera className="h-3 w-3" />{item.evidence}</p>}</div>
                <label className="cursor-pointer"><input type="file" accept="image/*" className="hidden" onChange={(event) => attachEvidence(item.id, event)} /><span className="inline-flex h-8 items-center gap-1.5 px-3 rounded-lg text-xs font-medium text-secondary hover:bg-[rgb(var(--bg-hover))]"><Camera className="h-3.5 w-3.5" /> Evidence</span></label>
                <div className="flex items-center gap-2 min-w-24 justify-end"><span className={`text-xs font-medium ${item.passed ? 'text-success-600' : 'text-error-600'}`}>{item.passed ? 'Pass' : 'Fail'}</span><Toggle checked={item.passed} onChange={(passed) => setInspection((items) => items.map((current) => current.id === item.id ? { ...current, passed } : current))} size="sm" /></div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Report a safety incident" description="Capture the facts now. An investigator can add findings later." size="lg">
        {submitted ? (
          <div className="py-12 text-center"><CheckCircle2 className="h-12 w-12 text-success-500 mx-auto" /><h3 className="text-base font-semibold text-primary mt-3">Incident reported</h3><p className="text-sm text-secondary mt-1">The safety team has been notified.</p></div>
        ) : (
          <form onSubmit={handleReport} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label htmlFor="incident-type">Incident type</Label><Select id="incident-type" name="type" required defaultValue=""><option value="" disabled>Select type</option><option>Near miss</option><option>Injury</option><option>First aid</option><option>Slip / trip</option><option>Equipment damage</option><option>Environmental</option></Select></div>
              <div><Label htmlFor="incident-severity">Severity</Label><Select id="incident-severity" name="severity" required defaultValue="Medium"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></Select></div>
              <div><Label htmlFor="incident-location">Location</Label><Input id="incident-location" name="location" required placeholder="e.g. Warehouse · Bay 2" /></div>
              <div><Label htmlFor="incident-time">Date and time</Label><Input id="incident-time" name="occurredAt" type="datetime-local" required /></div>
            </div>
            <div><Label htmlFor="incident-description">Description</Label><Textarea id="incident-description" name="description" required rows={4} placeholder="Describe what happened, immediate actions taken and any hazards..." /></div>
            <div>
              <Label>Involved employees</Label>
              <div className="flex flex-wrap gap-2">{employees.map((employee) => { const selected = selectedEmployees.includes(employee); return <button type="button" key={employee} onClick={() => setSelectedEmployees((current) => selected ? current.filter((name) => name !== employee) : [...current, employee])} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${selected ? 'border-accent-500 bg-accent-50 text-accent-700 dark:bg-accent-950/40 dark:text-accent-300' : 'border-base text-secondary hover:border-strong'}`}><Avatar name={employee} size="sm" />{employee}</button>; })}</div>
            </div>
            <div>
              <Label>Photo evidence</Label>
              <input ref={photoInput} type="file" accept="image/*" className="hidden" onChange={(event) => setPhotoName(event.target.files?.[0]?.name || '')} />
              <button type="button" onClick={() => photoInput.current?.click()} className="w-full border-2 border-dashed border-strong rounded-xl p-4 text-center hover:border-accent-500 transition-colors"><Upload className="h-5 w-5 text-accent-600 mx-auto" /><p className="text-xs font-medium text-primary mt-1">{photoName || 'Attach a photo'}</p><p className="text-[11px] text-muted">PNG or JPG up to 10 MB</p></button>
            </div>
            <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={() => setReportOpen(false)}>Cancel</Button><Button type="submit"><ShieldCheck className="h-4 w-4" /> Submit report</Button></div>
          </form>
        )}
      </Modal>
    </div>
  );
}
