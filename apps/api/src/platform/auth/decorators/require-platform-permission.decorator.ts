import { SetMetadata } from '@nestjs/common';

export const PLATFORM_PERMISSION_KEY = 'platform_permission';

export interface RequiredPlatformPermission {
  module: string;
  action: string;
}

export const RequirePlatformPermission = (module: string, action: string) =>
  SetMetadata(PLATFORM_PERMISSION_KEY, { module, action });
