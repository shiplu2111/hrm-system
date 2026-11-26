import type {
  IncidentSeverity,
  IncidentStatus,
  PublicComponentState,
  PublicDailyUptimeDay,
  PublicIncidentUpdate,
  PublicStatusComponentId,
  PublicStatusIncident,
} from '@hrm/shared-types';

const COMPONENT_LABELS: Record<PublicStatusComponentId, string> = {
  api: 'API',
  web_app: 'Web Application',
  mobile_sync: 'Mobile Sync',
  notifications: 'Notifications',
};

const STATE_RANK: Record<PublicComponentState, number> = {
  operational: 0,
  maintenance: 1,
  degraded: 2,
  outage: 3,
};

/**
 * Picks the more severe of two coarse component states.
 */
export function maxComponentState(
  a: PublicComponentState,
  b: PublicComponentState,
): PublicComponentState {
  return STATE_RANK[a] >= STATE_RANK[b] ? a : b;
}

export function getComponentLabel(id: PublicStatusComponentId): string {
  return COMPONENT_LABELS[id];
}

/**
 * Maps internal infrastructure subsystems onto the 4 coarse public Status components.
 */
export function mapSubsystemToPublicComponent(subsystem: string): PublicStatusComponentId {
  switch (subsystem) {
    case 'web_app':
      return 'web_app';
    case 'mobile_sync':
      return 'mobile_sync';
    case 'notifications':
      return 'notifications';
    case 'api':
    case 'database':
    case 'redis':
    case 'queues':
    case 'storage':
    default:
      return 'api';
  }
}

/**
 * Scrubs internal hostnames, IP/ports, queue names, raw table/provider names, emails,
 * and exception tokens from staff-written status text so public output remains coarse.
 */
export function sanitizePublicText(raw: string | null | undefined, fallback = ''): string {
  if (!raw || typeof raw !== 'string') return fallback;

  let text = raw
    // Emails & URLs
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, 'platform staff')
    .replace(/https?:\/\/[^\s)]+/gi, '[service endpoint]')
    // Host:port and bare internal hostnames / IPv4 addresses
    .replace(/\b(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?\b/gi, 'service node')
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b/g, 'service node')
    .replace(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:internal|local|svc|cluster)\b/gi, 'service node')
    // Known internal queue names & table identifiers
    .replace(
      /\b(?:webhook-delivery|custom-domain|tenant-lifecycle|accounting-sync|subscription-billing|payroll_runs|mobile_sync_logs)\b/gi,
      'background processing',
    )
    .replace(/\bBullMQ\b/gi, 'background worker')
    // Internal engines / cloud providers / regions / storage buckets
    .replace(/\b(?:PostgreSQL|Redis|MinIO|Amazon SES|AWS S3|Twilio|Firebase|FCM|Google Cloud)\b/gi, 'Upstream service')
    .replace(/\b(?:us|eu|ap|sa|ca|me|af)-(?:east|west|north|south|central|southeast|northeast)-\d\b/gi, 'primary region')
    // Raw low-level error tokens or HTTP error dumps
    .replace(/\b(?:ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ECONNRESET|SQLSTATE\[\w+\]|429 quota)\b/gi, 'connectivity issue')
    .replace(/\bP95\b/gi, 'tail')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!text) return fallback;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export interface IncidentRecordLike {
  id: string;
  incidentNumber: string;
  title: string;
  subsystem: string;
  severity: string;
  status: string;
  impact: string;
  startedAt: Date;
  resolvedAt: Date | null;
  durationMinutes: number | null;
  updates: unknown;
  metadata?: unknown;
}

/**
 * Excludes internal operational/signup alerts or entries explicitly marked private by staff.
 */
export function isPublicIncidentRecord(record: IncidentRecordLike): boolean {
  if (record.subsystem === 'signup' || record.incidentNumber.startsWith('INC-SIGNUP-')) {
    return false;
  }
  const meta =
    record.metadata && typeof record.metadata === 'object'
      ? (record.metadata as Record<string, unknown>)
      : {};
  if (meta.internalOnly === true || meta.isPublic === false) {
    return false;
  }
  return true;
}

/**
 * Projects a DB incident record into a sanitized public incident DTO (no createdBy, rootCause, or internal fields).
 */
export function toPublicIncident(record: IncidentRecordLike): PublicStatusIncident {
  const component = mapSubsystemToPublicComponent(record.subsystem);
  const rawUpdates = Array.isArray(record.updates) ? record.updates : [];
  const updates: PublicIncidentUpdate[] = rawUpdates
    .map((u: any) => ({
      timestamp: typeof u?.timestamp === 'string' ? u.timestamp : record.startedAt.toISOString(),
      status: (u?.status as IncidentStatus) || (record.status as IncidentStatus),
      message: sanitizePublicText(
        u?.message,
        'Platform team is investigating and monitoring service status.',
      ),
    }))
    .slice(-10);

  return {
    id: record.id,
    incidentNumber: record.incidentNumber,
    title: sanitizePublicText(record.title, 'Service Disruption Notice'),
    component,
    componentLabel: getComponentLabel(component),
    severity: (record.severity as IncidentSeverity) || 'minor',
    status: (record.status as IncidentStatus) || 'investigating',
    impact: sanitizePublicText(
      record.impact,
      'Some requests may experience intermittent delays while mitigation is in progress.',
    ),
    startedAt: record.startedAt.toISOString(),
    resolvedAt: record.resolvedAt ? record.resolvedAt.toISOString() : null,
    durationMinutes: record.durationMinutes ?? null,
    updates,
  };
}

function severityToDayState(severity: string): PublicComponentState {
  if (severity === 'critical') return 'outage';
  if (severity === 'maintenance') return 'maintenance';
  return 'degraded';
}

/**
 * Computes deterministic 90-day daily uptime bars (oldest -> today UTC) for one coarse component
 * based on recorded public incidents plus the live state for today.
 */
export function compute90DayUptime(
  componentId: PublicStatusComponentId,
  publicIncidents: IncidentRecordLike[],
  liveTodayState: PublicComponentState,
  now = new Date(),
): { days: PublicDailyUptimeDay[]; uptime90dPercentage: number } {
  const componentIncidents = publicIncidents.filter(
    (inc) => mapSubsystemToPublicComponent(inc.subsystem) === componentId,
  );

  const todayUtcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days: PublicDailyUptimeDay[] = [];
  let sumPercentage = 0;

  for (let offset = 89; offset >= 0; offset--) {
    const dayStartMs = todayUtcMidnight - offset * 86_400_000;
    const dayEndMs = dayStartMs + 86_400_000;
    const dateIso = new Date(dayStartMs).toISOString().slice(0, 10);

    let state: PublicComponentState = 'operational';
    let degradedOrOutageMinutes = 0;
    let incidentCount = 0;

    for (const inc of componentIncidents) {
      const incStartMs = inc.startedAt.getTime();
      const incEndMs = inc.resolvedAt ? inc.resolvedAt.getTime() : now.getTime();

      if (incEndMs <= dayStartMs || incStartMs >= dayEndMs) {
        continue;
      }

      incidentCount++;
      const overlapMinutes = Math.max(
        1,
        Math.round((Math.min(dayEndMs, incEndMs) - Math.max(dayStartMs, incStartMs)) / 60_000),
      );
      const incState = severityToDayState(inc.severity);
      state = maxComponentState(state, incState);

      if (inc.severity !== 'maintenance') {
        degradedOrOutageMinutes = Math.min(1440, degradedOrOutageMinutes + overlapMinutes);
      }
      if (inc.severity === 'major' && overlapMinutes >= 30) {
        state = maxComponentState(state, 'outage');
      }
    }

    if (offset === 0) {
      state = maxComponentState(state, liveTodayState);
      if ((liveTodayState === 'degraded' || liveTodayState === 'outage') && degradedOrOutageMinutes === 0) {
        degradedOrOutageMinutes = 5;
      }
    }

    const uptimePercentage =
      degradedOrOutageMinutes === 0
        ? 100
        : Math.max(0, Math.round(((1440 - degradedOrOutageMinutes) / 1440) * 10_000) / 100);

    sumPercentage += uptimePercentage;
    days.push({
      date: dateIso,
      state,
      uptimePercentage,
      incidentCount,
    });
  }

  const uptime90dPercentage = Math.round((sumPercentage / days.length) * 100) / 100;
  return { days, uptime90dPercentage };
}
