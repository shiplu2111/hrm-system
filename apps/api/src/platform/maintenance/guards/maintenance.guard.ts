import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { MaintenanceService } from '../maintenance.service';

@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(
    private readonly maintenanceService: MaintenanceService,
    @Optional() private readonly jwtService?: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const rawPath = request.path || request.url || '';
    const path = rawPath.split('?')[0];

    // 1. Bypass platform root control plane and staff APIs
    if (path.startsWith('/api/v1/platform') || path.startsWith('/platform')) {
      return true;
    }

    // 2. Bypass public status, health, and docs endpoints
    if (
      path.includes('/system/status') ||
      path.includes('/public/status') ||
      path.includes('/public/legal') ||
      path.includes('/public/content') ||
      path.includes('/maintenance/status') ||
      path.includes('/health') ||
      path.includes('/api/docs')
    ) {
      return true;
    }

    const config = await this.maintenanceService.getMaintenanceConfig();
    if (config.status !== 'active') {
      return true;
    }

    // Check if user is an authenticated platform staff member (Super Admin bypass)
    const platformUser = (request as any).platformUser || (request as any).user;
    if (
      platformUser &&
      (platformUser.roleName === 'Platform Owner' ||
        platformUser.roleName === 'Platform Admin' ||
        platformUser.role_name === 'Platform Owner' ||
        platformUser.role_name === 'Platform Admin')
    ) {
      return true;
    }

    // Check platform token in Authorization header if present
    const authHeader = request.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ') && this.jwtService) {
      try {
        const token = authHeader.substring(7);
        const decoded = this.jwtService.decode(token) as any;
        if (
          decoded &&
          (decoded.role_name === 'Platform Owner' ||
            decoded.role_name === 'Platform Admin' ||
            decoded.roleName === 'Platform Owner' ||
            decoded.roleName === 'Platform Admin')
        ) {
          return true;
        }
      } catch {
        // Continue to maintenance block
      }
    }

    // Determine if request originated from the mobile app (OFFLINE_SYNC.md)
    const clientPlatform = (
      request.headers['x-client-platform'] ||
      request.headers['x-client'] ||
      ''
    ).toString().toLowerCase();

    const userAgent = (request.headers['user-agent'] || '').toLowerCase();
    const isMobile =
      clientPlatform === 'mobile' ||
      clientPlatform === 'ios' ||
      clientPlatform === 'android' ||
      userAgent.includes('hrm-mobile') ||
      userAgent.includes('expo') ||
      path.includes('/sync/');

    if (isMobile) {
      throw new ServiceUnavailableException({
        code: 'MAINTENANCE_MODE',
        message:
          config.customMessage ||
          'CMSN-HR is undergoing scheduled maintenance. Offline actions will remain safely queued on your device and will sync automatically once maintenance concludes.',
        scheduledEnd: config.scheduledEnd,
        offlineQueueRetained: true,
      });
    }

    // Standard tenant web app response during active maintenance
    throw new ServiceUnavailableException({
      code: 'MAINTENANCE_MODE',
      message:
        config.customMessage ||
        'CMSN-HR is currently undergoing scheduled maintenance. Normal service will resume shortly.',
      scheduledStart: config.scheduledStart,
      scheduledEnd: config.scheduledEnd,
    });
  }
}
