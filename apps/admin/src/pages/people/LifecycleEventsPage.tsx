import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  TrendingUp,
  ArrowRightLeft,
  DollarSign,
  CheckCircle2,
  Ban,
  LogOut,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import type { EmployeeRecord, LifecycleEventType } from '@hrm/shared-types';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { useNav } from '@/context/NavContext';
import { useCompany } from '@/context/CompanyContext';
import { getEmployee } from '@/lib/employees-api';
import { createLifecycleEvent, listLifecycleEvents } from '@/lib/lifecycle-api';
import {
  listDepartments,
  listDesignations,
  listEmploymentTypes,
} from '@/lib/organization-api';
import { ApiError } from '@/lib/tenant-api-client';

type ActionKey =
  | 'promotion'
  | 'transfer'
  | 'salary_revision'
  | 'probation'
  | 'confirmation'
  | 'suspension'
  | 'resignation'
  | 'termination'
  | 'rehire';

const actions: {
  type: ActionKey;
  eventType: LifecycleEventType;
  label: string;
  description: string;
  icon: typeof TrendingUp;
}[] = [
  { type: 'promotion', eventType: 'promotion', label: 'Promotion', description: 'Promote to a higher role', icon: TrendingUp },
  { type: 'transfer', eventType: 'transfer', label: 'Transfer', description: 'Move department or location', icon: ArrowRightLeft },
  { type: 'salary_revision', eventType: 'salary_revision', label: 'Salary Revision', description: 'Adjust compensation', icon: DollarSign },
  { type: 'probation', eventType: 'probation', label: 'Extend Probation', description: 'Update probation end date', icon: CheckCircle2 },
  { type: 'confirmation', eventType: 'confirmation', label: 'Confirmation', description: 'Confirm after probation', icon: CheckCircle2 },
  { type: 'suspension', eventType: 'suspension', label: 'Suspension', description: 'Temporarily suspend employee', icon: Ban },
  { type: 'resignation', eventType: 'resignation', label: 'Resignation', description: 'Voluntary exit', icon: LogOut },
  { type: 'termination', eventType: 'termination', label: 'Termination', description: 'Involuntary exit', icon: LogOut },
  { type: 'rehire', eventType: 'rehire', label: 'Rehire', description: 'Re-engage former employee', icon: RotateCcw },
];

export function LifecycleEventsPage() {
  const { navigate, selectedEmployeeId } = useNav();
  const { companyId } = useCompany();
  const [emp, setEmp] = useState<EmployeeRecord | null>(null);
  const [events, setEvents] = useState<Awaited<ReturnType<typeof listLifecycleEvents>>>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [designations, setDesignations] = useState<{ id: string; name: string }[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<ActionKey | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [form, setForm] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!selectedEmployeeId || !companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [employee, history, depts, desigs, types] = await Promise.all([
        getEmployee(selectedEmployeeId),
        listLifecycleEvents(selectedEmployeeId),
        listDepartments(companyId),
        listDesignations(companyId),
        listEmploymentTypes(companyId),
      ]);
      setEmp(employee);
      setEvents(history);
      setDepartments(depts.map((d) => ({ id: d.id, name: d.name })));
      setDesignations(desigs.map((d) => ({ id: d.id, name: d.name })));
      setEmploymentTypes(types.map((t) => ({ id: t.id, name: t.name })));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [selectedEmployeeId, companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const buildDetails = (action: ActionKey): Record<string, unknown> => {
    const base = notes ? { notes } : {};
    switch (action) {
      case 'promotion':
        return { ...base, newDesignationId: form.newDesignationId, ...(form.newDepartmentId ? { newDepartmentId: form.newDepartmentId } : {}) };
      case 'transfer':
        return {
          ...base,
          ...(form.newDepartmentId ? { newDepartmentId: form.newDepartmentId } : {}),
          ...(form.newManagerId ? { newManagerId: form.newManagerId } : {}),
        };
      case 'salary_revision':
        return { ...base, previousAmount: Number(form.previousAmount), newAmount: Number(form.newAmount), currency: form.currency || 'AUD' };
      case 'probation':
        return { ...base, newProbationEndDate: form.newProbationEndDate };
      case 'confirmation':
        return { ...base, confirmationDate: form.confirmationDate || effectiveDate };
      case 'suspension':
        return { ...base, reason: form.reason };
      case 'resignation':
        return { ...base, ...(form.reason ? { reason: form.reason } : {}), ...(form.lastWorkingDate ? { lastWorkingDate: form.lastWorkingDate } : {}) };
      case 'termination':
        return { ...base, reason: form.reason, ...(form.lastWorkingDate ? { lastWorkingDate: form.lastWorkingDate } : {}) };
      case 'rehire':
        return {
          ...base,
          ...(form.newHireDate ? { newHireDate: form.newHireDate } : {}),
          ...(form.newDepartmentId ? { newDepartmentId: form.newDepartmentId } : {}),
          ...(form.newDesignationId ? { newDesignationId: form.newDesignationId } : {}),
        };
      default:
        return base;
    }
  };

  const handleSubmit = async () => {
    if (!selectedEmployeeId || !activeAction) return;
    const actionMeta = actions.find((a) => a.type === activeAction);
    if (!actionMeta) return;

    setSubmitting(true);
    setError(null);
    try {
      await createLifecycleEvent(selectedEmployeeId, {
        eventType: actionMeta.eventType,
        effectiveDate,
        details: buildDetails(activeAction),
      });
      setActiveAction(null);
      setForm({});
      setNotes('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!selectedEmployeeId) {
    return (
      <div className="p-8 text-center text-secondary text-sm">
        Select an employee from the directory first.
        <div className="mt-4">
          <Button variant="secondary" onClick={() => navigate('emp-directory')}>Go to Directory</Button>
        </div>
      </div>
    );
  }

  if (loading || !emp) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <button type="button" onClick={() => navigate('emp-profile')} className="flex items-center gap-1.5 text-sm text-secondary hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to Profile
      </button>

      {error && (
        <div className="text-sm text-error-600 bg-error-50 dark:bg-error-950/30 rounded-lg px-4 py-2">{error}</div>
      )}

      <Card>
        <CardBody className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-accent-100 dark:bg-accent-900/40 text-accent-700 flex items-center justify-center text-base font-semibold">
            {emp.firstName[0]}{emp.lastName[0]}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-primary">{emp.fullName}</span>
              <Badge tone="neutral">{emp.employeeNumber}</Badge>
            </div>
            <div className="text-sm text-secondary">{emp.designation?.name ?? '—'} · {emp.department?.name ?? '—'}</div>
          </div>
          <Badge tone="success" dot>{emp.employmentStatus}</Badge>
        </CardBody>
      </Card>

      <div>
        <h2 className="text-lg font-bold text-primary mb-1">Lifecycle Actions</h2>
        <p className="text-sm text-secondary">Each action is recorded and written to the audit log.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Card key={action.type} className="hover:shadow-card-hover cursor-pointer" onClick={() => { setActiveAction(action.type); setForm({}); }}>
              <CardBody className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-accent-50 dark:bg-accent-950/40 text-accent-600 flex items-center justify-center">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-primary">{action.label}</div>
                  <div className="text-xs text-secondary mt-0.5">{action.description}</div>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader><CardTitle>Event History</CardTitle></CardHeader>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase">Date</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase">Event</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase hidden md:table-cell">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--border-base))]">
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td className="px-5 py-3 text-secondary">{ev.effectiveDate}</td>
                  <td className="px-5 py-3 font-medium text-primary">{ev.eventType.replace('_', ' ')}</td>
                  <td className="px-5 py-3 text-muted hidden md:table-cell truncate max-w-md">
                    {JSON.stringify(ev.details)}
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr><td colSpan={3} className="px-5 py-8 text-center text-muted">No lifecycle events yet.</td></tr>
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Modal
        open={activeAction !== null}
        onClose={() => setActiveAction(null)}
        title={actions.find((a) => a.type === activeAction)?.label ?? 'Lifecycle Event'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setActiveAction(null)}>Cancel</Button>
            <Button variant="primary" onClick={() => void handleSubmit()} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Effective Date</Label>
            <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
          </div>

          {activeAction === 'promotion' && (
            <>
              <div><Label>New Designation</Label>
                <Select value={form.newDesignationId ?? ''} onChange={(e) => setForm({ ...form, newDesignationId: e.target.value })}>
                  <option value="">Select…</option>
                  {designations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              </div>
              <div><Label>New Department (optional)</Label>
                <Select value={form.newDepartmentId ?? ''} onChange={(e) => setForm({ ...form, newDepartmentId: e.target.value })}>
                  <option value="">Same</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              </div>
            </>
          )}

          {activeAction === 'transfer' && (
            <>
              <div><Label>New Department</Label>
                <Select value={form.newDepartmentId ?? ''} onChange={(e) => setForm({ ...form, newDepartmentId: e.target.value })}>
                  <option value="">Select…</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              </div>
            </>
          )}

          {activeAction === 'salary_revision' && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Previous Amount</Label><Input type="number" value={form.previousAmount ?? ''} onChange={(e) => setForm({ ...form, previousAmount: e.target.value })} /></div>
              <div><Label>New Amount</Label><Input type="number" value={form.newAmount ?? ''} onChange={(e) => setForm({ ...form, newAmount: e.target.value })} /></div>
            </div>
          )}

          {activeAction === 'probation' && (
            <div><Label>New Probation End Date</Label><Input type="date" value={form.newProbationEndDate ?? ''} onChange={(e) => setForm({ ...form, newProbationEndDate: e.target.value })} /></div>
          )}

          {activeAction === 'confirmation' && (
            <div><Label>Confirmation Date</Label><Input type="date" value={form.confirmationDate ?? effectiveDate} onChange={(e) => setForm({ ...form, confirmationDate: e.target.value })} /></div>
          )}

          {(activeAction === 'suspension' || activeAction === 'termination') && (
            <div><Label>Reason</Label><Input value={form.reason ?? ''} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
          )}

          {activeAction === 'resignation' && (
            <>
              <div><Label>Reason (optional)</Label><Input value={form.reason ?? ''} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
              <div><Label>Last Working Date</Label><Input type="date" value={form.lastWorkingDate ?? ''} onChange={(e) => setForm({ ...form, lastWorkingDate: e.target.value })} /></div>
            </>
          )}

          {activeAction === 'rehire' && (
            <>
              <div><Label>New Hire Date</Label><Input type="date" value={form.newHireDate ?? ''} onChange={(e) => setForm({ ...form, newHireDate: e.target.value })} /></div>
              <div><Label>Department</Label>
                <Select value={form.newDepartmentId ?? ''} onChange={(e) => setForm({ ...form, newDepartmentId: e.target.value })}>
                  <option value="">Select…</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              </div>
              <div><Label>Designation</Label>
                <Select value={form.newDesignationId ?? ''} onChange={(e) => setForm({ ...form, newDesignationId: e.target.value })}>
                  <option value="">Select…</option>
                  {designations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              </div>
            </>
          )}

          <div>
            <Label>Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
