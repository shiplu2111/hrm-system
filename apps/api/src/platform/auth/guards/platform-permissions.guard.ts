import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import {
  PLATFORM_PERMISSION_KEY,
  RequiredPlatformPermission,
} from '../decorators/require-platform-permission.decorator';

const EXPLICIT_ONLY_PLATFORM_ACTIONS = new Set(['raw_html']);

@Injectable()
export class PlatformPermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const required = this.reflector.getAllAndOverride<RequiredPlatformPermission>(
      PLATFORM_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      platformUser?: {
        roleName: string;
        permissions: Array<{ module: string; action: string }>;
      };
    }>();

    const user = request.platformUser;
    if (!user) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Platform authentication required',
      });
    }

    if (EXPLICIT_ONLY_PLATFORM_ACTIONS.has(required.action)) {
      const hasExplicit = user.permissions.some(
        (p) => p.module === required.module && p.action === required.action,
      );
      if (!hasExplicit) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: `Requires explicit platform permission ${required.module}:${required.action}`,
        });
      }
      return true;
    }

    // Platform Owner has full access to all standard platform operations
    if (user.roleName === 'Platform Owner') {
      return true;
    }

    const has = user.permissions.some(
      (p) =>
        (p.module === required.module ||
          (p.module === 'platform' && p.action === 'manage')) &&
        (p.action === required.action || p.action === 'manage'),
    );

    if (!has) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Requires platform permission ${required.module}:${required.action}`,
      });
    }

    return true;
  }
}
