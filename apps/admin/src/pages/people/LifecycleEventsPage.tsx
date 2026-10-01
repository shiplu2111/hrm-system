import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import type { EmployeeRecord, LifecycleEventRecord } from '@hrm/shared-types';
import { useAuth } from '@hrm/portal-ui';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Timeline, TimelineSection } from '@/components/ui/Timeline';
import { LifecycleActionPanel } from '@/components/people/LifecycleActionPanel';
import { lifecycleEventsToTimelineItems } from '@/lib/lifecycle-display';
import {
  LIFECYCLE_ACTIONS,
  evaluateActionKind,
  type LifecycleActionKind,
} from '@/lib/lifecycle-actions';
import { useNav } from '@/context/NavContext';
import { useCompany } from '@/context/CompanyContext';
import { getEmployee } from '@/lib/employees-api';
import { listLifecycleEvents } from '@/lib/lifecycle-api';
import { ApiError } from '@/lib/tenant-api-client';

export function LifecycleEventsPage() {
  const { navigate, selectedEmployeeId } = useNav();
  const { companyId } = useCompany();
  const { user } = useAuth();
  const [emp, setEmp] = useState<EmployeeRecord | null>(null);
  const [events, setEvents] = useState<LifecycleEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<LifecycleActionKind | null>(null);

  const load = useCallback(async () => {
    if (!selectedEmployeeId) return;
    setLoading(true);
    setError(null);
    try {
      const [employee, history] = await Promise.all([
        getEmployee(selectedEmployeeId),
        listLifecycleEvents(selectedEmployeeId),
      ]);
      setEmp(employee);
      setEvents(history);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [selectedEmployeeId]);

  useEffect(() => {
    void load();
  }, [load]);

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
          <Badge tone={emp.employmentStatus === 'terminated' ? 'error' : 'success'} dot>{emp.employmentStatus}</Badge>
        </CardBody>
      </Card>

      <div>
        <h2 className="text-lg font-bold text-primary mb-1">Lifecycle Actions</h2>
        <p className="text-sm text-secondary">Each action is recorded and written to the audit log.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {LIFECYCLE_ACTIONS.map((action) => {
          const Icon = action.icon;
          const decision = evaluateActionKind(user, action.kind, emp);
          return (
            <button
              key={action.kind}
              type="button"
              disabled={!decision.allowed}
              title={decision.allowed ? undefined : decision.message}
              onClick={() => setActiveAction(action.kind)}
              className="text-left disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Card className={decision.allowed ? 'hover:shadow-card-hover h-full' : 'h-full'}>
                <CardBody className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-accent-50 dark:bg-accent-950/40 text-accent-600 flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-primary">{action.label}</div>
                    <div className="text-xs text-secondary mt-0.5">
                      {decision.allowed ? action.description : decision.message}
                    </div>
                  </div>
                </CardBody>
              </Card>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader><CardTitle>Event History</CardTitle></CardHeader>
        <CardBody>
          {events.length === 0 ? (
            <p className="text-sm text-muted py-4 text-center">No lifecycle events yet.</p>
          ) : (
            <TimelineSection title="Timeline">
              <Timeline items={lifecycleEventsToTimelineItems(events)} />
            </TimelineSection>
          )}
        </CardBody>
      </Card>

      {companyId ? (
        <LifecycleActionPanel
          open={activeAction !== null}
          kind={activeAction}
          employee={emp}
          companyId={companyId}
          onClose={() => setActiveAction(null)}
          onRecorded={() => void load()}
        />
      ) : null}
    </div>
  );
}
