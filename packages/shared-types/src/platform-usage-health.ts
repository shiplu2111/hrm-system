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

// ============================================================================
// Usage & Storage against Plan Limits Types
// ============================================================================

export type UsageResourceStatus = 'normal' | 'near_limit' | 'over_limit';

export interface TenantUsageAndLimitItem {
  tenantId: string;
  tenantName: string;
  subdomain: string;
  status: string;
  planId: string;
  planCode: string;
  planName: string;
  hasCustomOverrides: boolean;

  // Active Employees vs Limit
  activeEmployees: number;
  employeeLimit: number | null; // null = Unlimited
  employeeUsagePercent: number | null; // null if unlimited
  isEmployeeNearLimit: boolean; // >= 80% and < 100%
  isEmployeeOverLimit: boolean; // >= 100%

  // Storage vs Limit
  storageUsedBytes: number;
  storageUsedMb: number;
  storageUsedGb: number;
  storageLimitBytes: number | null; // null = Unlimited
  storageLimitGb: number | null;
  storageUsagePercent: number | null;
  isStorageNearLimit: boolean;
  isStorageOverLimit: boolean;

  // API Calls vs Limit
  apiCalls: number;
  apiCallLimit: number | null; // null = Unlimited
  apiCallUsagePercent: number | null;
  isApiNearLimit: boolean;
  isApiOverLimit: boolean;

  // Overall Evaluation
  maxUsagePercent: number; // max percentage of any limited resource
  overallStatus: UsageResourceStatus;
  nearLimitResources: Array<'employees' | 'storage' | 'api_calls'>;
  overLimitResources: Array<'employees' | 'storage' | 'api_calls'>;

  lastMeteredAt: string;
}

export interface TenantUsageOverviewFilter {
  search?: string;
  plan?: string;
  status?: 'all' | 'near_limit' | 'over_limit' | 'normal';
  resource?: 'all' | 'employees' | 'storage' | 'api_calls';
  sortBy?:
    | 'tenantName'
    | 'maxUsagePercent'
    | 'employeePercent'
    | 'storagePercent'
    | 'apiPercent'
    | 'activeEmployees'
    | 'storageUsedBytes'
    | 'apiCalls';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface TenantUsageOverviewSummary {
  totalTenants: number;
  normalCount: number;
  nearLimitCount: number;
  overLimitCount: number;
  totalEmployees: number;
  totalStorageBytes: number;
  totalStorageGb: number;
  totalApiCalls: number;
}

export interface TenantUsageOverviewResponse {
  items: TenantUsageAndLimitItem[];
  total: number;
  page: number;
  limit: number;
  summary: TenantUsageOverviewSummary;
}

export interface TenantUsageTrendPoint {
  date: string;
  activeEmployees: number;
  storageUsedBytes: number;
  storageUsedGb: number;
  storageUsedMb: number;
  apiCalls: number;
  // If specific tenant trend:
  employeeLimit?: number | null;
  storageLimitGb?: number | null;
  apiCallLimit?: number | null;
  employee80Threshold?: number | null;
  storage80Threshold?: number | null;
  api80Threshold?: number | null;
}

export interface TenantUsageTrendsResponse {
  tenantId?: string | null;
  tenantName?: string | null;
  planName?: string | null;
  days: number;
  trends: TenantUsageTrendPoint[];
}

export interface TenantUsageExportRow {
  tenantId: string;
  tenantName: string;
  subdomain: string;
  planName: string;
  status: string;
  activeEmployees: number;
  employeeLimit: string;
  employeeUsagePercent: string;
  storageUsedHuman: string;
  storageLimitHuman: string;
  storageUsagePercent: string;
  apiCalls: number;
  apiCallLimit: string;
  apiUsagePercent: string;
  overallStatus: string;
  flaggedResources: string;
  lastMeteredAt: string;
}

