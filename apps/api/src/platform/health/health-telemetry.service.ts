// health-telemetry.service.ts
// Platform Health Telemetry Collector: API latency/error rate, DB connections, Redis, BullMQ queues, WebSockets, and Mobile Sync

import { Injectable, Logger } from '@nestjs/common';
import type {
  ApiLatencyAndErrorRate,
  DatabaseConnectionHealth,
  MobileSyncHealth,
  OverallHealthStatus,
  PlatformComprehensiveHealth,
  QueueHealthItem,
  QueueHealthSummary,
  RedisHealth,
  WebSocketHealth,
} from '@hrm/shared-types';
import { PrismaService } from '../../database/prisma.service';
import { getRedisConnection, isRedisConfigured } from '../../queue/redis.connection';
import { NotificationRealtimeService } from '../../realtime/notification-realtime.service';
import { Queue } from 'bullmq';

interface RequestSample {
  timestamp: number;
  durationMs: number;
  statusCode: number;
  isError: boolean;
}

const KNOWN_BULLMQ_QUEUES = [
  'webhook-delivery',
  'custom-domain',
  'tenant-lifecycle',
  'accounting-sync',
  'subscription-billing',
];

@Injectable()
export class HealthTelemetryService {
  private readonly logger = new Logger(HealthTelemetryService.name);
  private readonly startTime = Date.now();

  // In-memory ring buffer for last 1000 requests
  private readonly MAX_SAMPLES = 1000;
  private readonly samples: RequestSample[] = [];
  private activeInFlightRequests = 0;

  // In-memory tenant daily API counters (fallback / accelerator)
  private readonly tenantApiCounters = new Map<string, number>();

  // Lazy cache of BullMQ queue instances
  private readonly queueMap = new Map<string, Queue>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: NotificationRealtimeService,
  ) {
    this.initQueues();
  }

  private initQueues() {
    if (!isRedisConfigured()) return;
    try {
      const redis = getRedisConnection();
      for (const name of KNOWN_BULLMQ_QUEUES) {
        if (!this.queueMap.has(name)) {
          this.queueMap.set(name, new Queue(name, { connection: redis }));
        }
      }
    } catch (err: any) {
      this.logger.warn(`Failed to initialize BullMQ queue instances for telemetry: ${err?.message}`);
    }
  }

  /**
   * Called by HealthMetricsInterceptor at request start.
   */
  startRequest() {
    this.activeInFlightRequests++;
  }

  /**
   * Called by HealthMetricsInterceptor when request completes.
   */
  recordRequest(durationMs: number, statusCode: number, tenantId?: string) {
    this.activeInFlightRequests = Math.max(0, this.activeInFlightRequests - 1);
    const isError = statusCode >= 500;

    this.samples.push({
      timestamp: Date.now(),
      durationMs,
      statusCode,
      isError,
    });

    if (this.samples.length > this.MAX_SAMPLES) {
      this.samples.shift();
    }

    // Record per-tenant API call counter
    if (tenantId) {
      const today = new Date().toISOString().slice(0, 10);
      const key = `${tenantId}:${today}`;
      const current = this.tenantApiCounters.get(key) ?? 0;
      this.tenantApiCounters.set(key, current + 1);
    }
  }

  /**
   * Retrieve total API calls for a tenant on a specific date.
   */
  getTenantApiCalls(tenantId: string, dateStr: string): number {
    const key = `${tenantId}:${dateStr}`;
    return this.tenantApiCounters.get(key) ?? 0;
  }

  /**
   * API latency, percentiles, error rate over recent rolling window.
   */
  getApiLatencyAndErrorRate(): ApiLatencyAndErrorRate {
    const totalRequests = this.samples.length;
    if (totalRequests === 0) {
      return {
        status: 'healthy',
        totalRequests: 0,
        activeRequests: this.activeInFlightRequests,
        avgLatencyMs: 0,
        p50LatencyMs: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
        minLatencyMs: 0,
        maxLatencyMs: 0,
        errorRequests5xx: 0,
        clientErrors4xx: 0,
        errorRatePercentage: 0,
        sampleWindowSeconds: 300,
      };
    }

    const sortedDurations = [...this.samples.map((s) => s.durationMs)].sort((a, b) => a - b);
    const sum = sortedDurations.reduce((acc, v) => acc + v, 0);
    const avgLatencyMs = Math.round((sum / totalRequests) * 10) / 10;
    const minLatencyMs = Math.round(sortedDurations[0] * 10) / 10;
    const maxLatencyMs = Math.round(sortedDurations[totalRequests - 1] * 10) / 10;

    const p50Index = Math.floor(totalRequests * 0.5);
    const p95Index = Math.floor(totalRequests * 0.95);
    const p99Index = Math.min(totalRequests - 1, Math.floor(totalRequests * 0.99));

    const p50LatencyMs = Math.round(sortedDurations[p50Index] * 10) / 10;
    const p95LatencyMs = Math.round(sortedDurations[p95Index] * 10) / 10;
    const p99LatencyMs = Math.round(sortedDurations[p99Index] * 10) / 10;

    const errorRequests5xx = this.samples.filter((s) => s.statusCode >= 500).length;
    const clientErrors4xx = this.samples.filter((s) => s.statusCode >= 400 && s.statusCode < 500).length;
    const errorRatePercentage = Math.round((errorRequests5xx / totalRequests) * 10000) / 100;

    let status: OverallHealthStatus = 'healthy';
    if (errorRatePercentage > 5 || p95LatencyMs > 2500) {
      status = 'unhealthy';
    } else if (errorRatePercentage > 1 || p95LatencyMs > 800) {
      status = 'degraded';
    }

    return {
      status,
      totalRequests,
      activeRequests: this.activeInFlightRequests,
      avgLatencyMs,
      p50LatencyMs,
      p95LatencyMs,
      p99LatencyMs,
      minLatencyMs,
      maxLatencyMs,
      errorRequests5xx,
      clientErrors4xx,
      errorRatePercentage,
      sampleWindowSeconds: 300,
    };
  }

  /**
   * Database connection metrics & query latency.
   */
  async getDatabaseConnectionHealth(): Promise<DatabaseConnectionHealth> {
    const t0 = Date.now();
    try {
      await this.prisma.unscoped.$queryRawUnsafe('SELECT 1');
      const pingLatencyMs = Date.now() - t0;

      // Query active/idle connection counts from PostgreSQL pg_stat_activity
      const connStats: any[] = await this.prisma.unscoped.$queryRawUnsafe(`
        SELECT 
          count(*)::int as total,
          count(*) FILTER (WHERE state = 'active')::int as active,
          count(*) FILTER (WHERE state = 'idle')::int as idle
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `);

      // Query max_connections setting
      const maxConnSetting: any[] = await this.prisma.unscoped.$queryRawUnsafe(`
        SHOW max_connections
      `);

      const totalConnections = connStats[0]?.total ?? 1;
      const activeConnections = connStats[0]?.active ?? 1;
      const idleConnections = connStats[0]?.idle ?? 0;
      const maxConnections = parseInt(maxConnSetting[0]?.max_connections ?? '100', 10);
      const connectionUsagePercentage =
        Math.round((totalConnections / Math.max(1, maxConnections)) * 1000) / 10;

      let status: OverallHealthStatus = 'healthy';
      if (connectionUsagePercentage > 85 || pingLatencyMs > 500) {
        status = 'degraded';
      }
      if (connectionUsagePercentage > 95 || pingLatencyMs > 2000) {
        status = 'unhealthy';
      }

      return {
        status,
        databaseName: 'hrms',
        pingLatencyMs,
        activeConnections,
        idleConnections,
        totalConnections,
        maxConnections,
        connectionUsagePercentage,
      };
    } catch (err: any) {
      this.logger.error(`Database health check failed: ${err?.message}`);
      return {
        status: 'unhealthy',
        databaseName: 'hrms',
        pingLatencyMs: Date.now() - t0,
        activeConnections: 0,
        idleConnections: 0,
        totalConnections: 0,
        maxConnections: 100,
        connectionUsagePercentage: 0,
      };
    }
  }

  /**
   * Redis status, memory consumption, and connected clients.
   */
  async getRedisHealth(): Promise<RedisHealth> {
    if (!isRedisConfigured()) {
      return {
        status: 'disconnected',
        pingLatencyMs: 0,
        usedMemory: '0 MB',
        connectedClients: 0,
      };
    }

    const t0 = Date.now();
    try {
      const redis = getRedisConnection();
      await redis.ping();
      const pingLatencyMs = Date.now() - t0;

      const memInfo = await redis.info('memory');
      const clientInfo = await redis.info('clients');
      const serverInfo = await redis.info('server');

      const usedMemHuman = memInfo.match(/used_memory_human:([^\r\n]+)/)?.[1]?.trim() ?? 'N/A';
      const usedMemPeak = memInfo.match(/used_memory_peak_human:([^\r\n]+)/)?.[1]?.trim() ?? 'N/A';
      const connectedClients = parseInt(
        clientInfo.match(/connected_clients:([^\r\n]+)/)?.[1]?.trim() ?? '1',
        10,
      );
      const uptimeDays = parseInt(
        serverInfo.match(/uptime_in_days:([^\r\n]+)/)?.[1]?.trim() ?? '0',
        10,
      );

      return {
        status: pingLatencyMs > 300 ? 'degraded' : 'connected',
        pingLatencyMs,
        usedMemory: usedMemHuman,
        usedMemoryPeak: usedMemPeak,
        connectedClients,
        uptimeDays,
      };
    } catch (err: any) {
      this.logger.warn(`Redis health check error: ${err?.message}`);
      return {
        status: 'disconnected',
        pingLatencyMs: Date.now() - t0,
        usedMemory: 'Unknown',
        connectedClients: 0,
      };
    }
  }

  /**
   * BullMQ queue depth and failed-job counts per queue.
   */
  async getBullMqQueuesHealth(): Promise<QueueHealthSummary> {
    this.initQueues();
    const queues: QueueHealthItem[] = [];
    let totalQueueDepth = 0;
    let totalFailedJobs = 0;

    for (const name of KNOWN_BULLMQ_QUEUES) {
      const q = this.queueMap.get(name);
      if (!q) {
        queues.push({
          queueName: name,
          status: 'healthy',
          waiting: 0,
          active: 0,
          delayed: 0,
          failed: 0,
          completed: 0,
          queueDepth: 0,
        });
        continue;
      }

      try {
        const counts = await q.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed');
        const depth = (counts.waiting ?? 0) + (counts.active ?? 0) + (counts.delayed ?? 0);
        const failed = counts.failed ?? 0;
        totalQueueDepth += depth;
        totalFailedJobs += failed;

        let status: 'healthy' | 'congested' | 'error' = 'healthy';
        if (failed > 10) {
          status = 'error';
        } else if (depth > 50 || failed > 0) {
          status = 'congested';
        }

        queues.push({
          queueName: name,
          status,
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          delayed: counts.delayed ?? 0,
          failed,
          completed: counts.completed ?? 0,
          queueDepth: depth,
        });
      } catch {
        queues.push({
          queueName: name,
          status: 'healthy',
          waiting: 0,
          active: 0,
          delayed: 0,
          failed: 0,
          completed: 0,
          queueDepth: 0,
        });
      }
    }

    let summaryStatus: OverallHealthStatus = 'healthy';
    if (totalFailedJobs > 20) {
      summaryStatus = 'unhealthy';
    } else if (totalFailedJobs > 0 || totalQueueDepth > 100) {
      summaryStatus = 'degraded';
    }

    return {
      status: summaryStatus,
      totalQueues: queues.length,
      totalQueueDepth,
      totalFailedJobs,
      queues,
    };
  }

  /**
   * WebSocket / Realtime Gateway connections count.
   */
  getWebSocketHealth(): WebSocketHealth {
    const connectedClients = this.realtimeService.getConnectedClientsCount();
    return {
      status: connectedClients > 0 ? 'healthy' : 'idle',
      connectedClients,
      namespace: '/realtime',
      transport: 'websocket,polling',
    };
  }

  /**
   * Mobile sync success rate and error diagnostics per OFFLINE_SYNC.md section 4.
   */
  async getMobileSyncHealth(): Promise<MobileSyncHealth> {
    try {
      // 1. Query recorded mobile sync logs (from sync batches)
      const logs = await this.prisma.unscoped.mobileSyncLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
      });

      // 2. Also count total AttendanceSyncEvents
      const [totalSyncEvents, timeAnomalies, geofenceMismatches] = await Promise.all([
        this.prisma.unscoped.attendanceSyncEvent.count(),
        this.prisma.unscoped.attendanceSyncEvent.count({ where: { timeAnomaly: true } }),
        this.prisma.unscoped.attendanceSyncEvent.count({ where: { geofenceMismatch: true } }),
      ]);

      let totalBatchEvents = 0;
      let createdCount = 0;
      let duplicateCount = 0;
      let rejectedCount = 0;
      const reasonsMap = new Map<string, number>();

      for (const log of logs) {
        totalBatchEvents += log.totalEvents;
        createdCount += log.createdCount;
        duplicateCount += log.duplicateCount;
        rejectedCount += log.rejectedCount;

        const reasonsArray = Array.isArray(log.reasons) ? (log.reasons as string[]) : [];
        for (const r of reasonsArray) {
          reasonsMap.set(r, (reasonsMap.get(r) ?? 0) + 1);
        }
      }

      // If no logs recorded yet, synthesize from raw attendance sync events
      if (totalBatchEvents === 0 && totalSyncEvents > 0) {
        totalBatchEvents = totalSyncEvents;
        createdCount = totalSyncEvents;
        duplicateCount = 0;
        rejectedCount = 0;
      }

      const totalCalculated = Math.max(totalBatchEvents, createdCount + duplicateCount + rejectedCount);
      const successfulEvents = createdCount + duplicateCount;
      const successRatePercentage =
        totalCalculated > 0
          ? Math.round((successfulEvents / totalCalculated) * 1000) / 10
          : 100;

      const topRejectionReasons = Array.from(reasonsMap.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      let status: OverallHealthStatus = 'healthy';
      if (successRatePercentage < 90) {
        status = 'unhealthy';
      } else if (successRatePercentage < 98 || rejectedCount > 0) {
        status = 'degraded';
      }

      const lastSync = logs[0]?.createdAt ?? null;

      return {
        status,
        totalEventsSynced: totalCalculated,
        createdCount,
        duplicateCount,
        rejectedCount,
        successRatePercentage,
        timeAnomalyCount: timeAnomalies,
        geofenceMismatchCount: geofenceMismatches,
        topRejectionReasons,
        lastSyncAt: lastSync ? lastSync.toISOString() : null,
      };
    } catch (err: any) {
      this.logger.error(`Failed to calculate mobile sync health: ${err?.message}`);
      return {
        status: 'healthy',
        totalEventsSynced: 0,
        createdCount: 0,
        duplicateCount: 0,
        rejectedCount: 0,
        successRatePercentage: 100,
        timeAnomalyCount: 0,
        geofenceMismatchCount: 0,
        topRejectionReasons: [],
        lastSyncAt: null,
      };
    }
  }

  /**
   * Full comprehensive system health payload combining all metrics.
   */
  async getComprehensiveHealth(): Promise<PlatformComprehensiveHealth> {
    const [api, database, redis, queues, mobileSync] = await Promise.all([
      Promise.resolve(this.getApiLatencyAndErrorRate()),
      this.getDatabaseConnectionHealth(),
      this.getRedisHealth(),
      this.getBullMqQueuesHealth(),
      this.getMobileSyncHealth(),
    ]);

    const websocket = this.getWebSocketHealth();

    // Determine overall status
    const statuses: OverallHealthStatus[] = [
      api.status,
      database.status,
      redis.status === 'connected' ? 'healthy' : redis.status === 'degraded' ? 'degraded' : 'unhealthy',
      queues.status,
      mobileSync.status,
    ];

    let overallStatus: OverallHealthStatus = 'healthy';
    if (statuses.includes('unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (statuses.includes('degraded')) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV ?? 'development',
      api,
      database,
      redis,
      queues,
      websocket,
      mobileSync,
    };
  }
}
