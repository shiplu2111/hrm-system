import { useCallback, useEffect, useState } from 'react';
import { History, AlertCircle } from 'lucide-react';
import type { LifecycleEventRecord } from '@hrm/shared-types';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Timeline, TimelineSection } from '@/components/ui/Timeline';
import { listLifecycleEvents } from '@/lib/lifecycle-api';
import { lifecycleEventsToTimelineItems } from '@/lib/lifecycle-display';
import { ApiError } from '@/lib/tenant-api-client';

interface EmployeeProfileLifecycleTabProps {
  employeeId: string;
  /** Bump to reload after an event is recorded elsewhere on the page. */
  refreshKey?: number;
}

export function EmployeeProfileLifecycleTab({
  employeeId,
  refreshKey = 0,
}: EmployeeProfileLifecycleTabProps) {
  const [events, setEvents] = useState<LifecycleEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  }, [load, refreshKey]);

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
      <p className="text-sm text-secondary">
        {events.length} lifecycle event{events.length === 1 ? '' : 's'} recorded
      </p>

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
              description="Promotions, transfers, salary revisions, and exits recorded from Lifecycle actions will appear here."
            />
          ) : (
            <TimelineSection title="Employment timeline">
              <Timeline items={timelineItems} />
            </TimelineSection>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
