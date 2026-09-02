import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import type { PermissionAction } from '@hrm/shared-types';
import type { AuthenticatedUser, PermissionClaim } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { SENSITIVE_PERMISSION_ACTIONS } from './rbac.constants';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  hasPermission(
    user: AuthenticatedUser,
    module: string,
    action: PermissionAction,
  ): boolean {
    return user.permissions.some(
      (permission) =>
        permission.module === module && permission.action === action,
    );
  }

  /**
   * Assert permission — reloads from DB for approve/finalize (AUTH_FLOW.md §10).
   */
  async assertPermission(
    user: AuthenticatedUser,
    module: string,
    action: PermissionAction,
  ): Promise<void> {
    const mustReload = SENSITIVE_PERMISSION_ACTIONS.has(action);

    const permissions = mustReload
      ? await this.loadPermissionsFromDb(user.roleId)
      : user.permissions;

    if (!this.matchesPermission(permissions, module, action)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Missing permission: ${module}:${action}`,
      });
    }
  }

  private async loadPermissionsFromDb(roleId: string): Promise<PermissionClaim[]> {
    const rows = await this.prisma.unscoped.permission.findMany({
      where: { roleId },
      select: { module: true, action: true },
    });

    return rows.map((row) => ({
      module: row.module,
      action: row.action,
    }));
  }

  private matchesPermission(
    permissions: PermissionClaim[],
    module: string,
    action: PermissionAction,
  ): boolean {
    return permissions.some(
      (permission) =>
        permission.module === module && permission.action === action,
    );
  }
}

export function assertPermissionDeclared(
  permission: { module: string; action: string } | undefined,
  handlerName: string,
): asserts permission is { module: string; action: string } {
  if (!permission) {
    throw new InternalServerErrorException({
      code: 'PERMISSION_NOT_DECLARED',
      message: `Endpoint ${handlerName} must declare @RequirePermission (RULES.md §7)`,
    });
  }
}
