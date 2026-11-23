import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PlatformSettingCategory } from '@prisma/client';
import type {
  GlobalKillSwitch,
  MaintenanceConfig,
  MaintenanceStatus,
  PlatformMaintenanceOverview,
  PublicMaintenanceStatus,
  ToggleKillSwitchInput,
  UpdateMaintenanceInput,
} from '@hrm/shared-types';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';

const SETTING_KEY_CONFIG = 'config';
const SETTING_KEY_KILL_SWITCHES = 'kill_switches';

const DEFAULT_KILL_SWITCHES: GlobalKillSwitch[] = [
  {
    key: 'outgoing_sms',
    name: 'Outgoing SMS Dispatch',
    description: 'Emergency kill switch for Twilio and third-party SMS messaging gateway.',
    category: 'communications',
    enabled: true,
    lastChangedBy: 'System Baseline',
    lastChangedAt: null,
    lastReason: 'Initial operational deployment',
  },
  {
    key: 'outgoing_webhooks',
    name: 'Outgoing Webhooks Delivery',
    description: 'Suspends all automated external webhook triggers and subscriber dispatch queues.',
    category: 'integrations',
    enabled: true,
    lastChangedBy: 'System Baseline',
    lastChangedAt: null,
    lastReason: 'Initial operational deployment',
  },
  {
    key: 'new_signups',
    name: 'New Tenant Signups & Self-Registration',
    description: 'Prevents public registration and new tenant creation during maintenance or platform load spikes.',
    category: 'onboarding',
    enabled: true,
    lastChangedBy: 'System Baseline',
    lastChangedAt: null,
    lastReason: 'Initial operational deployment',
  },
  {
    key: 'file_uploads',
    name: 'File & Document Uploads',
    description: 'Restricts employee document, avatar, and expense attachment uploads.',
    category: 'operations',
    enabled: true,
    lastChangedBy: 'System Baseline',
    lastChangedAt: null,
    lastReason: 'Initial operational deployment',
  },
  {
    key: 'payroll_execution',
    name: 'Payroll Run Execution',
    description: 'Blocks payroll computation, approval, and finalization runs during statutory updates.',
    category: 'payroll',
    enabled: true,
    lastChangedBy: 'System Baseline',
    lastChangedAt: null,
    lastReason: 'Initial operational deployment',
  },
  {
    key: 'external_integrations',
    name: 'Third-Party Banking & Accounting Sync',
    description: 'Halts outbound ledger sync with Xero, QuickBooks, and direct bank rails.',
    category: 'integrations',
    enabled: true,
    lastChangedBy: 'System Baseline',
    lastChangedAt: null,
    lastReason: 'Initial operational deployment',
  },
];

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: PlatformAuditService,
  ) {}

  // ==========================================================================
  // Maintenance Mode Configuration
  // ==========================================================================

  async getMaintenanceConfig(): Promise<MaintenanceConfig> {
    const row = await this.prisma.unscoped.platformSetting.findUnique({
      where: {
        category_key: {
          category: PlatformSettingCategory.maintenance,
          key: SETTING_KEY_CONFIG,
        },
      },
    });

    if (!row) {
      return {
        enabled: false,
        scheduledStart: null,
        scheduledEnd: null,
        customMessage:
          'CMSN-HR is undergoing scheduled maintenance and system optimization.',
        status: 'inactive',
        lastChangedBy: null,
        lastChangedAt: null,
        lastReason: null,
      };
    }

    const val = row.value as any;
    const status = this.calculateStatus(
      val.enabled,
      val.scheduledStart,
      val.scheduledEnd,
    );

    return {
      enabled: Boolean(val.enabled),
      scheduledStart: val.scheduledStart || null,
      scheduledEnd: val.scheduledEnd || null,
      customMessage:
        val.customMessage ||
        'CMSN-HR is undergoing scheduled maintenance and system optimization.',
      status,
      lastChangedBy: val.lastChangedBy || null,
      lastChangedAt: val.lastChangedAt || row.updatedAt.toISOString(),
      lastReason: val.lastReason || null,
    };
  }

  async updateMaintenance(
    dto: UpdateMaintenanceInput,
    user: { id: string; email?: string; firstName?: string },
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<MaintenanceConfig> {
    const reason = dto.reason?.trim();
    if (!reason || reason.length < 3) {
      throw new BadRequestException({
        code: 'REASON_REQUIRED',
        message: 'A typed reason of at least 3 characters is required to update maintenance settings.',
      });
    }

    if (dto.scheduledStart && dto.scheduledEnd) {
      const start = new Date(dto.scheduledStart).getTime();
      const end = new Date(dto.scheduledEnd).getTime();
      if (end <= start) {
        throw new BadRequestException({
          code: 'INVALID_SCHEDULE_WINDOW',
          message: 'Maintenance scheduled end time must be after scheduled start time.',
        });
      }
    }

    const existingRow = await this.prisma.unscoped.platformSetting.findUnique({
      where: {
        category_key: {
          category: PlatformSettingCategory.maintenance,
          key: SETTING_KEY_CONFIG,
        },
      },
    });

    const actorDisplay = user.email || user.firstName || 'Platform Administrator';
    const nowIso = new Date().toISOString();

    const nextConfig = {
      enabled: Boolean(dto.enabled),
      scheduledStart: dto.scheduledStart ? new Date(dto.scheduledStart).toISOString() : null,
      scheduledEnd: dto.scheduledEnd ? new Date(dto.scheduledEnd).toISOString() : null,
      customMessage: dto.customMessage.trim(),
      lastChangedBy: actorDisplay,
      lastChangedAt: nowIso,
      lastReason: reason,
    };

    const savedRow = await this.prisma.unscoped.platformSetting.upsert({
      where: {
        category_key: {
          category: PlatformSettingCategory.maintenance,
          key: SETTING_KEY_CONFIG,
        },
      },
      create: {
        category: PlatformSettingCategory.maintenance,
        key: SETTING_KEY_CONFIG,
        value: nextConfig,
        updatedBy: user.id,
      },
      update: {
        value: nextConfig,
        updatedBy: user.id,
      },
    });

    await this.auditService.log({
      userId: user.id,
      action: 'maintenance.update',
      module: 'platform_maintenance',
      recordId: 'config',
      reason,
      oldValue: existingRow?.value || null,
      newValue: nextConfig,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    const status = this.calculateStatus(
      nextConfig.enabled,
      nextConfig.scheduledStart,
      nextConfig.scheduledEnd,
    );

    return {
      enabled: nextConfig.enabled,
      scheduledStart: nextConfig.scheduledStart,
      scheduledEnd: nextConfig.scheduledEnd,
      customMessage: nextConfig.customMessage,
      status,
      lastChangedBy: nextConfig.lastChangedBy,
      lastChangedAt: nextConfig.lastChangedAt,
      lastReason: nextConfig.lastReason,
    };
  }

  async getPublicStatus(): Promise<PublicMaintenanceStatus> {
    const config = await this.getMaintenanceConfig();
    return {
      status: config.status,
      enabled: config.enabled,
      scheduledStart: config.scheduledStart,
      scheduledEnd: config.scheduledEnd,
      customMessage: config.customMessage,
      bannerActive: config.status !== 'inactive',
      maintenanceActive: config.status === 'active',
    };
  }

  async isMaintenanceActive(): Promise<boolean> {
    const status = await this.getPublicStatus();
    return status.maintenanceActive;
  }

  // ==========================================================================
  // Global Kill Switches
  // ==========================================================================

  async getKillSwitches(): Promise<GlobalKillSwitch[]> {
    const row = await this.prisma.unscoped.platformSetting.findUnique({
      where: {
        category_key: {
          category: PlatformSettingCategory.maintenance,
          key: SETTING_KEY_KILL_SWITCHES,
        },
      },
    });

    if (!row) {
      return DEFAULT_KILL_SWITCHES;
    }

    const storedSwitches = (row.value as unknown as GlobalKillSwitch[]) || [];
    // Ensure all default keys exist even if new ones were added in code
    const storedMap = new Map(storedSwitches.map((s) => [s.key, s]));

    return DEFAULT_KILL_SWITCHES.map((def) => {
      const existing = storedMap.get(def.key);
      if (existing) {
        return {
          ...def,
          enabled: existing.enabled,
          lastChangedBy: existing.lastChangedBy,
          lastChangedAt: existing.lastChangedAt,
          lastReason: existing.lastReason,
        };
      }
      return def;
    });
  }

  async toggleKillSwitch(
    key: string,
    dto: ToggleKillSwitchInput,
    user: { id: string; email?: string; firstName?: string },
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<GlobalKillSwitch> {
    const reason = dto.reason?.trim();
    if (!reason || reason.length < 3) {
      throw new BadRequestException({
        code: 'REASON_REQUIRED',
        message: 'A typed reason of at least 3 characters is required to toggle a platform kill switch.',
      });
    }

    const switches = await this.getKillSwitches();
    const target = switches.find((s) => s.key === key);
    if (!target) {
      throw new NotFoundException({
        code: 'KILL_SWITCH_NOT_FOUND',
        message: `Unknown global kill switch: ${key}`,
      });
    }

    const actorDisplay = user.email || user.firstName || 'Platform Administrator';
    const nowIso = new Date().toISOString();

    const updatedSwitches = switches.map((s) => {
      if (s.key === key) {
        return {
          ...s,
          enabled: Boolean(dto.enabled),
          lastChangedBy: actorDisplay,
          lastChangedAt: nowIso,
          lastReason: reason,
        };
      }
      return s;
    });

    await this.prisma.unscoped.platformSetting.upsert({
      where: {
        category_key: {
          category: PlatformSettingCategory.maintenance,
          key: SETTING_KEY_KILL_SWITCHES,
        },
      },
      create: {
        category: PlatformSettingCategory.maintenance,
        key: SETTING_KEY_KILL_SWITCHES,
        value: updatedSwitches as any,
        updatedBy: user.id,
      },
      update: {
        value: updatedSwitches as any,
        updatedBy: user.id,
      },
    });

    await this.auditService.log({
      userId: user.id,
      action: 'kill_switch.toggle',
      module: 'platform_maintenance',
      recordId: key,
      reason,
      oldValue: { key, enabled: target.enabled },
      newValue: { key, enabled: Boolean(dto.enabled) },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return updatedSwitches.find((s) => s.key === key)!;
  }

  async isFeatureKilled(key: string): Promise<boolean> {
    const switches = await this.getKillSwitches();
    const item = switches.find((s) => s.key === key);
    if (!item) return false;
    return !item.enabled; // If enabled === false, feature is killed
  }

  async assertFeatureNotKilled(key: string): Promise<void> {
    const switches = await this.getKillSwitches();
    const item = switches.find((s) => s.key === key);
    if (item && !item.enabled) {
      throw new ServiceUnavailableException({
        code: 'KILL_SWITCH_ACTIVE',
        message: `Feature "${item.name}" is temporarily disabled by platform administrators: ${item.lastReason || 'Operational safeguard active.'}`,
      });
    }
  }

  async getOverview(): Promise<PlatformMaintenanceOverview> {
    const [maintenance, killSwitches] = await Promise.all([
      this.getMaintenanceConfig(),
      this.getKillSwitches(),
    ]);

    return {
      maintenance,
      killSwitches,
    };
  }

  // ==========================================================================
  // Helper: Status calculation
  // ==========================================================================

  private calculateStatus(
    enabled: boolean,
    scheduledStart?: string | null,
    scheduledEnd?: string | null,
  ): MaintenanceStatus {
    if (enabled) {
      return 'active';
    }

    const now = Date.now();
    const startMs = scheduledStart ? new Date(scheduledStart).getTime() : null;
    const endMs = scheduledEnd ? new Date(scheduledEnd).getTime() : null;

    if (startMs && endMs) {
      if (now >= startMs && now <= endMs) {
        return 'active';
      }
      if (now < startMs) {
        return 'scheduled';
      }
    } else if (startMs) {
      if (now >= startMs) {
        return 'active';
      }
      return 'scheduled';
    }

    return 'inactive';
  }
}
