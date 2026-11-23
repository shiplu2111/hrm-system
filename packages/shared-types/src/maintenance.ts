/**
 * Maintenance Mode and Global Kill Switches Shared Types
 * SYSTEM_SETTINGS.md §2, §2a, OFFLINE_SYNC.md, DATABASE_SCHEMA.md §11
 */

export type MaintenanceStatus = 'active' | 'scheduled' | 'inactive';

export interface MaintenanceConfig {
  enabled: boolean;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  customMessage: string;
  status: MaintenanceStatus;
  lastChangedBy: string | null;
  lastChangedAt: string | null;
  lastReason: string | null;
}

export interface UpdateMaintenanceInput {
  enabled: boolean;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  customMessage: string;
  reason: string;
}

export interface PublicMaintenanceStatus {
  status: MaintenanceStatus;
  enabled: boolean;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  customMessage: string;
  bannerActive: boolean;
  maintenanceActive: boolean;
}

export type KillSwitchCategory =
  | 'communications'
  | 'integrations'
  | 'onboarding'
  | 'payroll'
  | 'operations';

export interface GlobalKillSwitch {
  key: string;
  name: string;
  description: string;
  category: KillSwitchCategory;
  enabled: boolean;
  lastChangedBy: string | null;
  lastChangedAt: string | null;
  lastReason: string | null;
}

export interface ToggleKillSwitchInput {
  enabled: boolean;
  reason: string;
}

export interface PlatformMaintenanceOverview {
  maintenance: MaintenanceConfig;
  killSwitches: GlobalKillSwitch[];
}
