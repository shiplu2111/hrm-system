import type {
  CreateLifecycleEventInput,
  LifecycleEventRecord,
  LifecycleEventType,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export function listLifecycleEvents(
  employeeId: string,
  eventType?: LifecycleEventType,
): Promise<LifecycleEventRecord[]> {
  const query = eventType
    ? `?eventType=${encodeURIComponent(eventType)}`
    : '';
  return tenantApiRequest<LifecycleEventRecord[]>(
    `/employees/${employeeId}/lifecycle-events${query}`,
  );
}

export function createLifecycleEvent(
  employeeId: string,
  input: CreateLifecycleEventInput,
): Promise<LifecycleEventRecord> {
  return tenantApiRequest<LifecycleEventRecord>(
    `/employees/${employeeId}/lifecycle-events`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function getLifecycleEvent(
  employeeId: string,
  eventId: string,
): Promise<LifecycleEventRecord> {
  return tenantApiRequest<LifecycleEventRecord>(
    `/employees/${employeeId}/lifecycle-events/${eventId}`,
  );
}
