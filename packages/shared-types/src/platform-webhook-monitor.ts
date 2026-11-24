// packages/shared-types/src/platform-webhook-monitor.ts
import type {
  TenantWebhookStatus,
  WebhookDeliveryState,
  WebhookDeliveryStatus,
} from './webhooks';

export interface PlatformWebhookDeliveryItem {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSubdomain: string;
  webhookId: string;
  webhookName: string;
  webhookUrl: string;
  eventType: string;
  eventId: string;
  schemaVersion: string;
  status: WebhookDeliveryStatus;
  deliveryState: WebhookDeliveryState;
  httpStatus: number | null;
  attempts: number;
  maxAttempts: number;
  errorMessage: string | null;
  queuedAt: string;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  payload?: any;
}

export interface PlatformWebhookEndpointItem {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSubdomain: string;
  name: string;
  url: string;
  events: string[];
  status: TenantWebhookStatus;
  description: string | null;
  delivered7d: number;
  failed7d: number;
  retryingNow: number;
  consecutiveFailingDays: number;
  lastDeliveryAt: string | null;
  lastDeliveryStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformWebhookMonitorSummary {
  totalDeliveries24h: number;
  totalDeliveries7d: number;
  successRate24h: number;
  retryingCount: number;
  failedCount24h: number;
  totalActiveEndpoints: number;
  totalDisabledEndpoints: number;
  failingEndpointsCount: number;
}

export interface PlatformWebhookDeliveriesQuery {
  tenantId?: string;
  eventType?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PlatformWebhookEndpointsQuery {
  tenantId?: string;
  status?: string;
  search?: string;
  failingOnly?: boolean;
  page?: number;
  limit?: number;
}

export interface RedeliverWebhookResult {
  delivery: PlatformWebhookDeliveryItem;
  message: string;
}

export interface AutoDisableFailingEndpointsInput {
  failingDays?: number;
  dryRun?: boolean;
}

export interface AutoDisableFailingEndpointsResult {
  thresholdDays: number;
  endpointsEvaluated: number;
  disabledCount: number;
  disabledEndpoints: Array<{
    id: string;
    name: string;
    url: string;
    tenantId: string;
    tenantName: string;
    consecutiveDays: number;
  }>;
  notificationsSent: number;
  dryRun: boolean;
}
