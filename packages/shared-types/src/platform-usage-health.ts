// platform-usage-health.ts
// Shared types for Platform Usage Metering and Health Monitoring

export interface UsageDailyRecord {
  id: string;
  tenantId: string;
  tenantName?: string;
  tenantSubdomain?: string;
  date: string; // ISO date YYYY-MM-DD
  activeEmployees: number;
  storageUsedBytes: number;
  storageUsedMb: number;
  apiCalls: number;
  notificationsTotal: number;
  notificationsEmail: number;
  notificationsSms: number;
  notificationsPush: number;
  notificationsInApp: number;
  attendanceEventsSynced: number;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface UsageDailySummary {
  date: string;
  totalTenantsMetered: number;
  totalActiveEmployees: number;
  totalStorageUsedBytes: number;
  totalStorageUsedMb: number;
  totalApiCalls: number;
  totalNotificationsSent: number;
  notificationsByChannel: {
    email: number;
    sms: number;
    push: number;
    in_app: number;
  };
  totalAttendanceEventsSynced: number;
}

export interface UsageMeteringFilter {
  tenantId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface TriggerUsageMeteringInput {
  date?: string; // Target calculation date YYYY-MM-DD (defaults to yesterday)
  tenantId?: string; // Optional single tenant UUID to meter
}

// ============================================================================
// System Health Monitoring Types
// ============================================================================

export type OverallHealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface ApiLatencyAndErrorRate {
  status: OverallHealthStatus;
  totalRequests: number;
  activeRequests: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  errorRequests5xx: number;
  clientErrors4xx: number;
  errorRatePercentage: number;
  sampleWindowSeconds: number;
}

export interface DatabaseConnectionHealth {
  status: OverallHealthStatus;
  databaseName: string;
  pingLatencyMs: number;
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  maxConnections: number;
  connectionUsagePercentage: number;
}

export interface RedisHealth {
  status: 'connected' | 'degraded' | 'disconnected';
  pingLatencyMs: number;
  usedMemory: string;
  usedMemoryPeak?: string;
  connectedClients: number;
  uptimeDays?: number;
}

export interface QueueHealthItem {
  queueName: string;
  status: 'healthy' | 'congested' | 'error';
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
  queueDepth: number;
}

export interface QueueHealthSummary {
  status: OverallHealthStatus;
  totalQueues: number;
  totalQueueDepth: number;
  totalFailedJobs: number;
  queues: QueueHealthItem[];
}

export interface WebSocketHealth {
  status: 'healthy' | 'idle' | 'unavailable';
  connectedClients: number;
  namespace: string;
  transport: string;
}

export interface MobileSyncHealth {
  status: OverallHealthStatus;
  totalEventsSynced: number;
  createdCount: number;
  duplicateCount: number;
  rejectedCount: number;
  successRatePercentage: number;
  timeAnomalyCount: number;
  geofenceMismatchCount: number;
  topRejectionReasons: Array<{ reason: string; count: number }>;
  lastSyncAt: string | null;
}

export interface PlatformComprehensiveHealth {
  status: OverallHealthStatus;
  timestamp: string;
  uptimeSeconds: number;
  nodeVersion: string;
  environment: string;
  api: ApiLatencyAndErrorRate;
  database: DatabaseConnectionHealth;
  redis: RedisHealth;
  queues: QueueHealthSummary;
  websocket: WebSocketHealth;
  mobileSync: MobileSyncHealth;
}
