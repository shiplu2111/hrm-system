import { useCallback, useEffect, useState } from 'react';
import { History, Plus, AlertCircle } from 'lucide-react';
import type { LifecycleEventRecord } from '@hrm/shared-types';
import { PermissionGate, usePermission } from '@hrm/portal-ui';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Timeline, TimelineSection } from '@/components/ui/Timeline';
import { useNav } from '@/context/NavContext';
import { listLifecycleEvents } from '@/lib/lifecycle-api';
import { lifecycleEventsToTimelineItems } from '@/lib/lifecycle-display';
import { ApiError } from '@/lib/tenant-api-client';

interface EmployeeProfileLifecycleTabProps {
  employeeId: string;
}

export function EmployeeProfileLifecycleTab({
  employeeId,
}: EmployeeProfileLifecycleTabProps) {
  const { navigate, openLifecycle } = useNav();
  const [events, setEvents] = useState<LifecycleEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canEdit = usePermission('employee', 'edit');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEvents(await listLifecycleEvents(employeeId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load lifecycle history');
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const timelineItems = lifecycleEventsToTimelineItems(events);

  if (loading) {
    return (
      <Card>
        <CardBody className="space-y-6 pl-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-5 w-5 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-secondary">
          {events.length} lifecycle event{events.length === 1 ? '' : 's'} recorded
        </p>
        <PermissionGate module="employee" action="edit">
          <Button
            variant="primary"
            size="md"
            onClick={() => openLifecycle(employeeId)}
          >
            <Plus className="h-4 w-4" /> Record event
          </Button>
        </PermissionGate>
      </div>

      {error ? (
        <div className="flex items-start gap-2 text-sm text-error-700 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : null}

      <Card>
        <CardBody>
          {timelineItems.length === 0 ? (
            <EmptyState
              compact
              icon={History}
              title="No lifecycle history yet"
              description="Promotions, transfers, confirmations, and other employment events will appear here."
              action={
                canEdit
                  ? {
                      label: 'Record first event',
                      onClick: () => openLifecycle(employeeId),
                      icon: Plus,
                    }
                  : undefined
              }
            />
          ) : (
            <TimelineSection title="Employment timeline">
              <Timeline items={timelineItems} />
            </TimelineSection>
          )}
        </CardBody>
      </Card>

      <p className="text-xs text-muted">
        Need to submit a promotion, transfer, or exit? Use{' '}
        <button
          type="button"
          className="text-accent-700 dark:text-accent-300 font-medium hover:underline"
          onClick={() => navigate('emp-lifecycle')}
        >
          Lifecycle actions
        </button>{' '}
        for the full workflow forms.
      </p>
    </div>
  );
}
