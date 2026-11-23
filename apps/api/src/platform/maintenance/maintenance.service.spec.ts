import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PlatformSettingCategory } from '@prisma/client';
import { MaintenanceService } from './maintenance.service';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { MaintenanceGuard } from './guards/maintenance.guard';

describe('MaintenanceService', () => {
  let service: MaintenanceService;
  let guard: MaintenanceGuard;
  let prisma: any;
  let auditService: any;

  const mockDbStore: Record<string, any> = {};

  beforeEach(async () => {
    Object.keys(mockDbStore).forEach((key) => delete mockDbStore[key]);

    const platformSettingMock = {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const k = `${where.category_key.category}:${where.category_key.key}`;
        return Promise.resolve(mockDbStore[k] || null);
      }),
      upsert: jest.fn().mockImplementation(({ where, create, update }) => {
        const k = `${where.category_key.category}:${where.category_key.key}`;
        const existing = mockDbStore[k];
        const record = {
          id: existing?.id || 'uuid-' + Math.random().toString(36).slice(2),
          category: where.category_key.category,
          key: where.category_key.key,
          value: existing ? update.value : create.value,
          updatedBy: existing ? update.updatedBy : create.updatedBy,
          createdAt: existing?.createdAt || new Date(),
          updatedAt: new Date(),
        };
        mockDbStore[k] = record;
        return Promise.resolve(record);
      }),
    };

    prisma = {
      platformSetting: platformSettingMock,
      unscoped: {
        platformSetting: platformSettingMock,
      },
    };

    auditService = {
      log: jest.fn().mockResolvedValue({ id: 'audit-log-uuid' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceService,
        MaintenanceGuard,
        { provide: PrismaService, useValue: prisma },
        { provide: PlatformAuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<MaintenanceService>(MaintenanceService);
    guard = module.get<MaintenanceGuard>(MaintenanceGuard);
  });

  describe('Maintenance Configuration & Schedules', () => {
    it('returns default inactive maintenance configuration when unconfigured', async () => {
      const config = await service.getMaintenanceConfig();
      expect(config.enabled).toBe(false);
      expect(config.status).toBe('inactive');
      expect(config.scheduledStart).toBeNull();
      expect(config.scheduledEnd).toBeNull();
    });

    it('requires a typed reason to update maintenance configuration', async () => {
      await expect(
        service.updateMaintenance(
          {
            enabled: true,
            customMessage: 'System maintenance',
            reason: '', // empty reason
          },
          { id: 'user-1', email: 'owner@platform.com' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates maintenance mode, records actor and reason, and writes audit log', async () => {
      const updated = await service.updateMaintenance(
        {
          enabled: true,
          customMessage: 'Emergency hotfix in progress.',
          reason: 'Mitigating critical database connection pool spike',
        },
        { id: 'user-1', email: 'owner@platform.com' },
      );

      expect(updated.enabled).toBe(true);
      expect(updated.status).toBe('active');
      expect(updated.customMessage).toBe('Emergency hotfix in progress.');
      expect(updated.lastChangedBy).toBe('owner@platform.com');
      expect(updated.lastReason).toBe('Mitigating critical database connection pool spike');

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'maintenance.update',
          reason: 'Mitigating critical database connection pool spike',
        }),
      );
    });

    it('calculates scheduled status when maintenance window is in the future', async () => {
      const futureStart = new Date(Date.now() + 3600000).toISOString();
      const futureEnd = new Date(Date.now() + 7200000).toISOString();

      const scheduled = await service.updateMaintenance(
        {
          enabled: false,
          scheduledStart: futureStart,
          scheduledEnd: futureEnd,
          customMessage: 'Scheduled weekend upgrade.',
          reason: 'Planning routine maintenance window',
        },
        { id: 'user-1', email: 'admin@platform.com' },
      );

      expect(scheduled.status).toBe('scheduled');

      const publicStatus = await service.getPublicStatus();
      expect(publicStatus.bannerActive).toBe(true);
      expect(publicStatus.maintenanceActive).toBe(false);
    });

    it('calculates active status when current time is inside the scheduled window', async () => {
      const pastStart = new Date(Date.now() - 60000).toISOString();
      const futureEnd = new Date(Date.now() + 60000).toISOString();

      const active = await service.updateMaintenance(
        {
          enabled: false,
          scheduledStart: pastStart,
          scheduledEnd: futureEnd,
          customMessage: 'Active scheduled window.',
          reason: 'Executing live window',
        },
        { id: 'user-1', email: 'admin@platform.com' },
      );

      expect(active.status).toBe('active');

      const publicStatus = await service.getPublicStatus();
      expect(publicStatus.bannerActive).toBe(true);
      expect(publicStatus.maintenanceActive).toBe(true);
    });
  });

  describe('Global Kill Switches', () => {
    it('returns default baseline kill switches', async () => {
      const switches = await service.getKillSwitches();
      expect(switches.length).toBeGreaterThanOrEqual(6);
      expect(switches.find((s) => s.key === 'outgoing_sms')).toBeDefined();
      expect(switches.find((s) => s.key === 'outgoing_webhooks')).toBeDefined();
      expect(switches.find((s) => s.key === 'new_signups')).toBeDefined();
    });

    it('requires a typed reason to toggle a kill switch', async () => {
      await expect(
        service.toggleKillSwitch(
          'outgoing_sms',
          { enabled: false, reason: '' },
          { id: 'user-1', email: 'owner@platform.com' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for unknown kill switch key', async () => {
      await expect(
        service.toggleKillSwitch(
          'nonexistent_switch',
          { enabled: false, reason: 'Valid reason' },
          { id: 'user-1', email: 'owner@platform.com' },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('kills a risky feature, records actor metadata, and enforces kill switch', async () => {
      const toggled = await service.toggleKillSwitch(
        'outgoing_sms',
        {
          enabled: false, // kill outgoing SMS
          reason: 'Twilio downstream carrier outage in AU/NZ region',
        },
        { id: 'user-1', email: 'owner@platform.com' },
      );

      expect(toggled.enabled).toBe(false);
      expect(toggled.lastChangedBy).toBe('owner@platform.com');
      expect(toggled.lastReason).toBe('Twilio downstream carrier outage in AU/NZ region');

      const isKilled = await service.isFeatureKilled('outgoing_sms');
      expect(isKilled).toBe(true);

      await expect(service.assertFeatureNotKilled('outgoing_sms')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('MaintenanceGuard & OFFLINE_SYNC.md Behavior', () => {
    it('allows requests through when maintenance is inactive', async () => {
      const mockContext: any = {
        switchToHttp: () => ({
          getRequest: () => ({
            path: '/api/v1/attendance/records',
            headers: {},
          }),
        }),
      };

      const canActivate = await guard.canActivate(mockContext);
      expect(canActivate).toBe(true);
    });

    it('allows Platform Control Plane (/api/v1/platform/*) even when maintenance is active', async () => {
      await service.updateMaintenance(
        {
          enabled: true,
          customMessage: 'Maintenance in progress',
          reason: 'Active maintenance for migration',
        },
        { id: 'user-1', email: 'owner@platform.com' },
      );

      const mockContext: any = {
        switchToHttp: () => ({
          getRequest: () => ({
            path: '/api/v1/platform/maintenance',
            headers: {},
          }),
        }),
      };

      const canActivate = await guard.canActivate(mockContext);
      expect(canActivate).toBe(true);
    });

    it('returns 503 with offlineQueueRetained: true for mobile requests during maintenance (OFFLINE_SYNC.md)', async () => {
      await service.updateMaintenance(
        {
          enabled: true,
          customMessage: 'Maintenance active',
          reason: 'Active maintenance for migration',
        },
        { id: 'user-1', email: 'owner@platform.com' },
      );

      const mockContext: any = {
        switchToHttp: () => ({
          getRequest: () => ({
            path: '/api/v1/sync/attendance',
            headers: {
              'x-client-platform': 'mobile',
            },
          }),
        }),
      };

      try {
        await guard.canActivate(mockContext);
        fail('Expected ServiceUnavailableException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ServiceUnavailableException);
        const resp = err.getResponse();
        expect(resp.code).toBe('MAINTENANCE_MODE');
        expect(resp.offlineQueueRetained).toBe(true);
      }
    });

    it('returns standard 503 maintenance response for tenant web clients during maintenance', async () => {
      await service.updateMaintenance(
        {
          enabled: true,
          customMessage: 'System undergoing upgrades.',
          reason: 'Upgrading infrastructure',
        },
        { id: 'user-1', email: 'owner@platform.com' },
      );

      const mockContext: any = {
        switchToHttp: () => ({
          getRequest: () => ({
            path: '/api/v1/employees',
            headers: {},
          }),
        }),
      };

      try {
        await guard.canActivate(mockContext);
        fail('Expected ServiceUnavailableException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ServiceUnavailableException);
        const resp = err.getResponse();
        expect(resp.code).toBe('MAINTENANCE_MODE');
        expect(resp.message).toBe('System undergoing upgrades.');
      }
    });
  });
});
