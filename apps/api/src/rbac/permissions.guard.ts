import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PermissionAction } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { DataScopeService } from './data-scope.service';
import { PermissionsService, assertPermissionDeclared } from './permissions.service';
import { SENSITIVE_PERMISSION_ACTIONS } from './rbac.constants';
import {
  PERMISSION_KEY,
  SELF_SERVICE_KEY,
  type RequiredPermission,
} from './require-permission.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
    private readonly dataScope: DataScopeService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const required = this.reflector.getAllAndOverride<RequiredPermission>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    assertPermissionDeclared(required, context.getHandler().name);

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Authentication required',
      });
    }

    const alternatives = required.orAnyOf ?? [];
    const viaAlternative = alternatives.some(
      (alt) =>
        !SENSITIVE_PERMISSION_ACTIONS.has(alt.action) &&
        this.permissionsService.hasPermission(user, alt.module, alt.action),
    );

    if (!viaAlternative) {
      await this.permissionsService.assertPermission(
        user,
        required.module,
        required.action as PermissionAction,
      );
    }

    await this.assertScopeAllowsEndpoint(context, user);
    return true;
  }

  private async assertScopeAllowsEndpoint(
    context: ExecutionContext,
    user: AuthenticatedUser,
  ): Promise<void> {
    const selfService = this.reflector.getAllAndOverride<boolean>(SELF_SERVICE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (selfService) return;
    if (!(await this.dataScope.isOwnOnly(user))) return;
    throw new ForbiddenException({
      code: 'OWN_SCOPE_FORBIDDEN',
      message: 'Your role can only use self-service features',
    });
  }
}
