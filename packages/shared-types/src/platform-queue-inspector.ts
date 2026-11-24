// packages/shared-types/src/platform-queue-inspector.ts
// Shared types and DTOs for Platform BullMQ Job Queue Inspector

export type QueueCategory =
  | 'payroll'
  | 'sync'
  | 'billing'
  | 'integration'
  | 'infrastructure'
  | 'operations'
  | 'notifications'
  | 'other';

export type JobState =
  | 'waiting'
  | 'active'
  | 'completed'
  | 'failed'
  | 'delayed'
  | 'paused'
  | 'unknown';

export type QueueHealthState = 'healthy' | 'warning' | 'degraded' | 'critical';

export interface BullMqQueueCounts {
  waiting: number;
  active: number;
  failed: number;
  completed: number;
  delayed: number;
  paused: number;
  total: number;
}

export interface BullMqQueueSummary {
  name: string;
  displayName: string;
  description: string;
  category: QueueCategory;
  isProminent: boolean;
  isPayroll: boolean;
  isPaused: boolean;
  counts: BullMqQueueCounts;
  health: QueueHealthState;
}

export interface BullMqJobItem {
  id: string;
  queueName: string;
  name: string;
  state: JobState;
  data: Record<string, any>;
  opts: {
    attempts?: number;
    delay?: number;
    priority?: number;
    backoff?: any;
    timestamp?: number;
  };
  progress: number | object | string | null;
  attemptsMade: number;
  maxAttempts: number;
  timestamp: string; // ISO
  processedOn: string | null; // ISO
  finishedOn: string | null; // ISO
  durationMs: number | null;
  failedReason: string | null;
  stacktrace: string[];
  returnValue: any;
  isPayroll: boolean;
  isSync: boolean;
}

export interface QueueJobsQuery {
  queueName?: string;
  state?: JobState | 'all';
  search?: string;
  page?: number;
  limit?: number;
  prominentOnly?: boolean;
}

export interface QueueJobsResponse {
  items: BullMqJobItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  queue?: BullMqQueueSummary;
  allQueues?: BullMqQueueSummary[];
}

export interface RemoveJobInput {
  reason?: string; // MANDATORY for payroll jobs (length >= 5)
}

export interface RetryJobResult {
  success: boolean;
  jobId: string;
  queueName: string;
  newState: JobState;
  message: string;
}

export interface RemoveJobResult {
  success: boolean;
  jobId: string;
  queueName: string;
  reason?: string;
  message: string;
  auditLogId?: string;
}

export interface RetryQueueFailedJobsResult {
  queueName: string;
  retriedCount: number;
  message: string;
}

export interface CleanQueueJobsInput {
  gracePeriodMs?: number;
  limit?: number;
  type: 'completed' | 'failed';
  reason?: string; // MANDATORY for payroll queues if type === 'failed'
}

export interface CleanQueueJobsResult {
  queueName: string;
  cleanedCount: number;
  type: 'completed' | 'failed';
  message: string;
}

export interface QueueSystemOverview {
  totalQueues: number;
  prominentQueuesCount: number;
  activeJobsCount: number;
  waitingJobsCount: number;
  failedJobsCount: number;
  completedJobsCount: number;
  overallStatus: QueueHealthState;
  redisConnected: boolean;
  queues: BullMqQueueSummary[];
}
