import { apiRequest } from './api-client';
import type {
  GlobalKillSwitch,
  MaintenanceConfig,
  PlatformMaintenanceOverview,
  PublicMaintenanceStatus,
  ToggleKillSwitchInput,
  UpdateMaintenanceInput,
} from '@hrm/shared-types';

/**
 * Fetch full maintenance overview: configuration and kill switches
 */
export function getMaintenanceOverview(): Promise<PlatformMaintenanceOverview> {
  return apiRequest<PlatformMaintenanceOverview>('/platform/maintenance');
}

/**
 * Fetch maintenance mode configuration
 */
export function getMaintenanceConfig(): Promise<MaintenanceConfig> {
  return apiRequest<MaintenanceConfig>('/platform/maintenance/config');
}

/**
 * Update maintenance mode (requires typed reason)
 */
export function updateMaintenanceConfig(
  input: UpdateMaintenanceInput,
): Promise<MaintenanceConfig> {
  return apiRequest<MaintenanceConfig>('/platform/maintenance', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

/**
 * Fetch all global kill switches
 */
export function getKillSwitches(): Promise<GlobalKillSwitch[]> {
  return apiRequest<GlobalKillSwitch[]>('/platform/maintenance/kill-switches');
}

/**
 * Toggle a global kill switch state (requires typed reason)
 */
export function toggleKillSwitch(
  key: string,
  input: ToggleKillSwitchInput,
): Promise<GlobalKillSwitch> {
  return apiRequest<GlobalKillSwitch>(`/platform/maintenance/kill-switches/${key}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

/**
 * Fetch public system status
 */
export function getSystemStatus(): Promise<PublicMaintenanceStatus> {
  return apiRequest<PublicMaintenanceStatus>('/system/status');
}
