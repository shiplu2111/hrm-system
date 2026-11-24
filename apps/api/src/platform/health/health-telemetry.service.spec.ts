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
});
