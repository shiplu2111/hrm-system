// health-telemetry.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { HealthTelemetryService } from './health-telemetry.service';
import { PrismaService } from '../../database/prisma.service';
import { NotificationRealtimeService } from '../../realtime/notification-realtime.service';

describe('HealthTelemetryService', () => {
  let service: HealthTelemetryService;
  let prisma: PrismaService;
  let realtime: NotificationRealtimeService;

  const mockPrisma = {
    unscoped: {
      $queryRawUnsafe: jest.fn(),
      mobileSyncLog: {
        findMany: jest.fn(),
      },
      attendanceSyncEvent: {
        count: jest.fn(),
      },
      notificationDelivery: {
        findMany: jest.fn(),
      },
      inAppNotification: {
        count: jest.fn(),
      },
      platformIncident: {
        findMany: jest.fn(),
        count: jest.fn(),
        createMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
    },
  };

  const mockRealtime = {
    getConnectedClientsCount: jest.fn().mockReturnValue(5),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthTelemetryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationRealtimeService, useValue: mockRealtime },
      ],
    }).compile();

    service = module.get<HealthTelemetryService>(HealthTelemetryService);
    prisma = module.get<PrismaService>(PrismaService);
    realtime = module.get<NotificationRealtimeService>(NotificationRealtimeService);
    jest.clearAllMocks();
  });

  describe('API Latency and Error Rate', () => {
    it('returns default healthy stats when no samples recorded', () => {
      const metrics = service.getApiLatencyAndErrorRate();
      expect(metrics.status).toBe('healthy');
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.avgLatencyMs).toBe(0);
      expect(metrics.errorRatePercentage).toBe(0);
    });

    it('calculates average, p95, p99, and error rate accurately', () => {
      // Simulate 10 requests with varied durations
      for (let i = 1; i <= 9; i++) {
        service.recordRequest(i * 10, 200, 'tenant-1');
      }
      // 1 error request (500)
      service.recordRequest(250, 500, 'tenant-1');

      const metrics = service.getApiLatencyAndErrorRate();
      expect(metrics.totalRequests).toBe(10);
      expect(metrics.errorRequests5xx).toBe(1);
      expect(metrics.errorRatePercentage).toBe(10); // 1 / 10 = 10%
      expect(metrics.status).toBe('unhealthy'); // > 5% error rate
      expect(metrics.minLatencyMs).toBe(10);
      expect(metrics.maxLatencyMs).toBe(250);
      expect(metrics.p95LatencyMs).toBeGreaterThan(0);
    });

    it('tracks per-tenant daily API calls', () => {
      const today = new Date().toISOString().slice(0, 10);
      service.recordRequest(50, 200, 'tenant-abc');
      service.recordRequest(60, 200, 'tenant-abc');

      const count = service.getTenantApiCalls('tenant-abc', today);
      expect(count).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Database Connection Health', () => {
    it('queries pg_stat_activity and returns healthy connection stats', async () => {
      mockPrisma.unscoped.$queryRawUnsafe
        .mockResolvedValueOnce([{ '?column?': 1 }]) // SELECT 1
        .mockResolvedValueOnce([{ total: 10, active: 3, idle: 7 }]) // conn stats
        .mockResolvedValueOnce([{ max_connections: '100' }]); // max_connections

      const db = await service.getDatabaseConnectionHealth();
      expect(db.status).toBe('healthy');
      expect(db.totalConnections).toBe(10);
      expect(db.activeConnections).toBe(3);
      expect(db.idleConnections).toBe(7);
      expect(db.maxConnections).toBe(100);
      expect(db.connectionUsagePercentage).toBe(10);
    });

    it('handles database errors gracefully and returns unhealthy status', async () => {
      mockPrisma.unscoped.$queryRawUnsafe.mockRejectedValueOnce(new Error('Connection lost'));

      const db = await service.getDatabaseConnectionHealth();
      expect(db.status).toBe('unhealthy');
      expect(db.totalConnections).toBe(0);
    });
  });

  describe('WebSocket Health', () => {
    it('reports connected clients count from realtime service', () => {
      mockRealtime.getConnectedClientsCount.mockReturnValue(12);
      const ws = service.getWebSocketHealth();
      expect(ws.status).toBe('healthy');
      expect(ws.connectedClients).toBe(12);
      expect(ws.namespace).toBe('/realtime');
    });

    it('reports idle status when 0 clients connected', () => {
      mockRealtime.getConnectedClientsCount.mockReturnValue(0);
      const ws = service.getWebSocketHealth();
      expect(ws.status).toBe('idle');
      expect(ws.connectedClients).toBe(0);
    });
  });

  describe('Mobile Sync Health (OFFLINE_SYNC.md section 4)', () => {
    it('computes success rate and anomaly counts from mobile sync logs', async () => {
      mockPrisma.unscoped.mobileSyncLog.findMany.mockResolvedValueOnce([
        {
          totalEvents: 10,
          createdCount: 8,
          duplicateCount: 1,
          rejectedCount: 1,
          reasons: ['invalid_timestamp'],
          createdAt: new Date(),
        },
      ]);
      mockPrisma.unscoped.attendanceSyncEvent.count
        .mockResolvedValueOnce(9) // total events
        .mockResolvedValueOnce(1) // time anomalies
        .mockResolvedValueOnce(0); // geofence mismatches

      const syncHealth = await service.getMobileSyncHealth();
      expect(syncHealth.totalEventsSynced).toBe(10);
      expect(syncHealth.createdCount).toBe(8);
      expect(syncHealth.duplicateCount).toBe(1);
      expect(syncHealth.rejectedCount).toBe(1);
      expect(syncHealth.successRatePercentage).toBe(90); // 9 / 10 = 90%
      expect(syncHealth.timeAnomalyCount).toBe(1);
      expect(syncHealth.topRejectionReasons).toEqual([{ reason: 'invalid_timestamp', count: 1 }]);
    });
  });

  describe('Storage Health', () => {
    it('verifies platform storage driver, available space and latency', async () => {
      const storage = await service.getStorageHealth();
      expect(storage.status).toBe('healthy');
      expect(storage.driver).toBeDefined();
      expect(storage.totalSpaceBytes).toBeGreaterThan(0);
      expect(storage.availableSpaceBytes).toBeGreaterThan(0);
      expect(storage.readLatencyMs).toBeGreaterThan(0);
      expect(storage.writeLatencyMs).toBeGreaterThan(0);
      expect(storage.isHealthy).toBe(true);
    });
  });

  describe('Notification Providers Health', () => {
    it('aggregates deliverability across Email, SMS, Push, and In-App channels', async () => {
      mockPrisma.unscoped.notificationDelivery.findMany.mockResolvedValueOnce([
        { channel: 'email', status: 'sent' },
        { channel: 'email', status: 'sent' },
        { channel: 'push', status: 'sent' },
      ]);
      mockPrisma.unscoped.inAppNotification.count.mockResolvedValueOnce(50);

      const notifHealth = await service.getNotificationProvidersHealth();
      expect(notifHealth.status).toBe('healthy');
      expect(notifHealth.channels.length).toBe(4);

      const emailChannel = notifHealth.channels.find((c) => c.channel === 'email')!;
      expect(emailChannel.status).toBe('healthy');
      expect(emailChannel.deliverabilityRate).toBeGreaterThanOrEqual(95);

      const inAppChannel = notifHealth.channels.find((c) => c.channel === 'in_app')!;
      expect(inAppChannel.deliverabilityRate).toBe(100);
      expect(inAppChannel.sentLast24h).toBeGreaterThanOrEqual(50);
    });
  });

  describe('Latency and Error Trends', () => {
    it('generates timeseries trend points for past 24 hours', async () => {
      mockPrisma.unscoped.$queryRawUnsafe
        .mockResolvedValueOnce([{ '?column?': 1 }])
        .mockResolvedValueOnce([{ total: 10, active: 3, idle: 7 }])
        .mockResolvedValueOnce([{ max_connections: '100' }]);

      const trends = await service.getLatencyAndErrorTrends('24h');
      expect(trends.timeRange).toBe('24h');
      expect(trends.points.length).toBe(24);
      expect(trends.summary.avgLatencyMs).toBeGreaterThan(0);
      expect(trends.summary.p95LatencyMs).toBeGreaterThan(0);
      expect(trends.points[0].p95LatencyMs).toBeDefined();
    });
  });

  describe('Recent Incidents', () => {
    it('returns seeded or queried incidents with status counts', async () => {
      mockPrisma.unscoped.platformIncident.findMany
        .mockResolvedValueOnce([]) // initial empty -> triggers seed
        .mockResolvedValueOnce([
          {
            id: 'inc-1',
            incidentNumber: 'INC-2026-081',
            title: 'Elevated latency on auth API',
            subsystem: 'api',
            severity: 'minor',
            status: 'resolved',
            impact: 'P95 latency reached 140ms',
            rootCause: 'Cache warming',
            startedAt: new Date(),
            resolvedAt: new Date(),
            durationMinutes: 12,
            updates: [],
            createdBy: 'system.monitor@cmsnbd.com',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);
      mockPrisma.unscoped.platformIncident.createMany.mockResolvedValueOnce({ count: 3 });

      const result = await service.getRecentIncidents();
      expect(result.incidents.length).toBe(1);
      expect(result.resolvedIncidentsCount).toBe(1);
      expect(result.activeIncidentsCount).toBe(0);
    });
  });
});
